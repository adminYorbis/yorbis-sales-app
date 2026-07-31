import crypto from 'crypto';
import type { AIReasoningProvider } from '@/application/yie/providers/ai-reasoning-provider';
import type { ICPRepository } from '@/application/yie/knowledge/icp-repository';
import type { SolutionKnowledgeRepository } from '@/application/yie/knowledge/solution-knowledge-repository';
import type { DiscoveryMode, LegacyDiscoveryMode } from '@/domain/yie/enums';
import { mapLegacyModeValue } from '@/domain/yie/enums';
import { selectICP } from '@/domain/yie/icp-selection-policy';
import { inferPlanningIntent, mergeExplicitIntentWithICP } from '@/domain/yie/planning-policies';
import {
  IntentCriterionSchema, PlanningIntentPatchSchema, ProductionInterpretationSchema,
  type PlanningIntentPatch, type ProductionInterpretation,
} from '@/domain/yie/planning-schemas';
import type { DiscoveryPlanningRepository } from './discovery-planning-repository';
import { DiscoverySessionService } from './discovery-session-service';
import { IntentVersionService } from './intent-version-service';
import { SearchPlanningService } from './search-planning-service';
import { ShadowComparisonService } from './shadow-comparison-service';

export type ShadowPlanningInput = {
  rawQuery: string; actorId: string; mode?: DiscoveryMode | LegacyDiscoveryMode;
  priorSessionId?: string | null; explicitICPId?: string | null; patch?: PlanningIntentPatch | null;
  restoreVersion?: number | null; externalCorrelationId?: string | null;
  production?: ProductionInterpretation | null;
};

function formalMode(value: ShadowPlanningInput['mode']): DiscoveryMode {
  if (!value) return 'NEW';
  return typeof value === 'string' && value === value.toUpperCase()
    ? value as DiscoveryMode
    : mapLegacyModeValue(value as LegacyDiscoveryMode).mode;
}

export class ShadowPlanningService {
  private readonly sessions: DiscoverySessionService;
  private readonly intents: IntentVersionService;
  private readonly planner: SearchPlanningService;
  private readonly comparisons: ShadowComparisonService;
  constructor(
    private readonly repository: DiscoveryPlanningRepository,
    private readonly knowledge: SolutionKnowledgeRepository,
    private readonly icps: ICPRepository,
    private readonly provider?: AIReasoningProvider,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly log: (entry: Record<string, unknown>) => void = () => {},
  ) {
    this.sessions = new DiscoverySessionService(repository, now);
    this.intents = new IntentVersionService(repository, this.sessions, now);
    this.planner = new SearchPlanningService(repository, this.sessions, provider, now);
    this.comparisons = new ShadowComparisonService(repository, this.sessions, now);
  }

  async run(input: ShadowPlanningInput) {
    const mode = formalMode(input.mode);
    let session = input.priorSessionId ? await this.repository.getSession(input.priorSessionId) : null;
    if (mode === 'NEW' && session) throw new Error('NEW must create an independent session.');
    if (mode !== 'NEW' && !session) throw new Error(`${mode} requires a prior session.`);
    const inferred = inferPlanningIntent(input.rawQuery);
    const activeICPs = await this.icps.listActiveICPs();
    let selection = selectICP({
      rawUserInput: input.rawQuery, intent: inferred, activeICPs,
      explicitICPId: input.explicitICPId ?? session?.selectedICPId ?? null,
    });
    if (selection.method === 'AD_HOC' && this.provider) {
      const baseIntent = {
        id: `icp-selection-${crypto.randomUUID()}`, rawRequest: input.rawQuery, mode: 'NEW' as const,
        industries: inferred.targetIndustries, geographies: inferred.targetGeographies,
        companySize: inferred.employeeSize, businessModels: inferred.targetBusinessModels,
        requiredSignals: [], preferredSignals: [], excludedSignals: [], buyerRoles: [],
        desiredResultCount: inferred.resultCountPreference, parentIntentId: null, sessionId: null,
        version: 1, widenedFields: [], selectedIcp: null,
      };
      const proposed = await this.provider.parseDiscoveryIntent({
        rawRequest: input.rawQuery, mode, authoritativeBase: baseIntent,
        budget: { timeoutMs: 10_000, maxRetries: 0, maxOutputTokens: 1500 },
      });
      if (proposed.metadata.groundingUsed) throw new Error('GROUNDING_PROHIBITED_IN_POCKET_4');
      selection = selectICP({
        rawUserInput: input.rawQuery, intent: inferred, activeICPs,
        aiProposedICPId: proposed.value.selectedIcp?.id ?? null,
      });
    }
    const selectedICP = selection.selectedICPId && selection.selectedICPVersion
      ? await this.icps.getICPVersion(selection.selectedICPId, selection.selectedICPVersion)
      : null;
    const merged = mergeExplicitIntentWithICP(inferred, selectedICP);
    if (!session) {
      const solution = await this.knowledge.getActiveSolutionProfile();
      if (!solution) throw new Error('No active Solution Profile is available.');
      session = await this.sessions.create({
        actorId: input.actorId, mode, solutionId: solution.definition.id,
        solutionVersion: solution.version.version, icpId: selection.selectedICPId,
        icpVersion: selection.selectedICPVersion, externalCorrelationId: input.externalCorrelationId,
        productionReference: input.production?.reference ?? null,
        metadata: { selectionMethod: selection.method, selectionConfidence: selection.confidence },
      });
      await this.sessions.markInterpreting(session);
      session = { ...session, status: 'INTERPRETING' };
    } else {
      session = await this.sessions.beginTransition(session, mode);
      if (input.explicitICPId && input.explicitICPId !== session.selectedICPId) {
        await this.sessions.repinICP(session, selection.selectedICPId, selection.selectedICPVersion);
        session = { ...session, selectedICPId: selection.selectedICPId, selectedICPVersion: selection.selectedICPVersion };
      }
    }
    const correlationId = input.externalCorrelationId ?? crypto.randomUUID();
    this.log({
      correlationId, sessionId: session.id, mode, selectedICPId: session.selectedICPId,
      selectedICPVersion: session.selectedICPVersion, selectedSolutionId: session.selectedSolutionProfileId,
      selectedSolutionVersion: session.selectedSolutionProfileVersion, validationOutcome: 'STARTED',
    });
    try {
      const patch = input.patch ?? this.inferPatch(mode, inferred, input.rawQuery);
      const intent = await this.intents.create({
        session, mode, rawUserInput: input.rawQuery, proposed: merged.intent,
        patch, restoreVersion: input.restoreVersion ?? (mode === 'RESTORE' ? session.currentIntentVersion : null),
        explanation: selection.explanation, conflicts: merged.conflicts,
        warnings: [...selection.warnings, ...merged.warnings, ...merged.overriddenDefaults],
      });
      const plan = await this.planner.create({ session, intent, icp: selectedICP });
      const comparison = input.production
        ? await this.comparisons.compare(session, intent, ProductionInterpretationSchema.parse(input.production))
        : null;
      await this.sessions.markPlanned(session);
      this.log({
        correlationId, sessionId: session.id, mode, intentVersion: intent.version,
        conflictCount: intent.validationResult.conflicts.length, planQueryCount: plan.queries.length,
        planFingerprint: plan.fingerprint, comparisonOutcome: comparison?.semanticWarnings ?? [],
        validationOutcome: 'PLANNED', providerOperation: 'PROPOSE_SEARCH_PLAN',
        providerLatencyMs: 0, retryCount: 0,
      });
      return { sessionId: session.id, selection, intent, plan, comparison };
    } catch (error) {
      const code = error instanceof Error && error.message.includes('GROUNDING') ? 'GROUNDING_PROHIBITED' : 'SHADOW_PLANNING_FAILED';
      await this.sessions.fail(session, code);
      this.log({ correlationId, sessionId: session.id, mode, validationOutcome: 'FAILED', failureCode: code });
      throw error;
    }
  }

  private inferPatch(mode: DiscoveryMode, inferred: ReturnType<typeof inferPlanningIntent>, rawQuery: string) {
    if (mode === 'NEW' || mode === 'RESTORE') return null;
    if (mode === 'EXCLUDE') {
      return PlanningIntentPatchSchema.parse({ add: { exclusions: [IntentCriterionSchema.parse({
        id: `user-exclusion-${crypto.createHash('sha1').update(rawQuery).digest('hex').slice(0, 10)}`,
        kind: 'EXCLUDED', field: 'user_exclusion', operator: 'EQUALS', value: rawQuery,
        unknownHandling: 'ALLOW', description: rawQuery, origin: 'USER', sourceReference: null,
      })] } });
    }
    const arrays = {
      targetGeographies: inferred.targetGeographies,
      targetIndustries: inferred.targetIndustries,
      targetBusinessModels: inferred.targetBusinessModels,
    };
    if (mode === 'EXPAND') return PlanningIntentPatchSchema.parse({
      add: arrays, broadenedFields: Object.entries(arrays).filter(([, value]) => value.length).map(([key]) => key),
    });
    return PlanningIntentPatchSchema.parse({ set: {
      ...arrays, ...(inferred.employeeSize ? { employeeSize: inferred.employeeSize } : {}),
    } });
  }
}
