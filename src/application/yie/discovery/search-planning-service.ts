import type { AIReasoningProvider } from '@/application/yie/providers/ai-reasoning-provider';
import type { ICPAggregate } from '@/domain/yie/icp-schemas';
import { createNewIntent } from '@/domain/yie/intent-policies';
import { buildSearchPlan } from '@/domain/yie/search-plan-policy';
import type { DiscoveryIntentVersion, DiscoverySession } from '@/domain/yie/planning-schemas';
import type { DiscoveryPlanningRepository } from './discovery-planning-repository';
import type { DiscoverySessionService } from './discovery-session-service';

export class SearchPlanningService {
  constructor(
    private readonly repository: DiscoveryPlanningRepository,
    private readonly sessions: DiscoverySessionService,
    private readonly provider?: AIReasoningProvider,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  async create(input: { session: DiscoverySession; intent: DiscoveryIntentVersion; icp: ICPAggregate | null }) {
    let proposal = null;
    let proposalMetadata: Record<string, unknown> | null = null;
    if (this.provider && input.intent.mode !== 'RESTORE') {
      await this.sessions.appendEvent(input.session, 'PLAN_PROPOSED', { provider: this.provider.providerId });
      const baseIntent = createNewIntent({
        id: `${input.session.id}-provider-intent-${input.intent.version}`,
        rawRequest: input.intent.rawUserInput,
        selectedIcp: input.intent.selectedICPId ? { id: input.intent.selectedICPId, version: input.intent.selectedICPVersion! } : null,
        industries: input.intent.normalizedIntent.targetIndustries,
        geographies: input.intent.normalizedIntent.targetGeographies,
        companySize: input.intent.normalizedIntent.employeeSize,
        businessModels: input.intent.normalizedIntent.targetBusinessModels,
        requiredSignals: input.intent.normalizedIntent.requiredConstraints.map((item) => item.description),
        preferredSignals: input.intent.normalizedIntent.preferredCriteria.map((item) => item.description),
        excludedSignals: input.intent.normalizedIntent.exclusions.map((item) => item.description),
        buyerRoles: input.intent.normalizedIntent.relevantBuyerPersonas,
        desiredResultCount: input.intent.normalizedIntent.resultCountPreference,
      });
      const yieIntent = { ...baseIntent, version: input.intent.version };
      const result = await this.provider.proposeSearchPlan({
        intent: yieIntent, budget: { timeoutMs: 10_000, maxRetries: 0, maxOutputTokens: 3000 },
      });
      proposal = result.value;
      proposalMetadata = result.metadata as unknown as Record<string, unknown>;
      if (result.metadata.groundingUsed) throw new Error('GROUNDING_PROHIBITED_IN_POCKET_4');
      if (proposal.intentVersion !== input.intent.version) throw new Error('AI_PLAN_INTENT_VERSION_MISMATCH');
    }
    const existing = await this.repository.getSearchPlan(input.session.id);
    const plan = buildSearchPlan({
      sessionId: input.session.id, intentVersion: input.intent.version,
      planVersion: (existing?.planVersion ?? 0) + 1,
      solutionProfileId: input.session.selectedSolutionProfileId,
      solutionProfileVersion: input.session.selectedSolutionProfileVersion,
      icp: input.icp, intent: input.intent.normalizedIntent, createdAt: this.now(), aiProposal: proposal,
    });
    await this.sessions.appendEvent(input.session, 'PLAN_VALIDATED', {
      queryCount: plan.queries.length, fingerprint: plan.fingerprint, provider: proposalMetadata?.provider ?? null,
    });
    await this.repository.insertSearchPlan(plan);
    await this.sessions.appendEvent(input.session, 'PLAN_CREATED', { planVersion: plan.planVersion, fingerprint: plan.fingerprint });
    return plan;
  }
  get(sessionId: string, version?: number) { return this.repository.getSearchPlan(sessionId, version); }
}
