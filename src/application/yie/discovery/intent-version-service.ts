import type { DiscoveryPlanningRepository } from './discovery-planning-repository';
import type { DiscoverySessionService } from './discovery-session-service';
import { applyPlanningTransition } from '@/domain/yie/planning-policies';
import {
  DiscoveryIntentVersionSchema, PlanningIntentPatchSchema, type DiscoverySession,
  type PlanningIntent, type PlanningIntentPatch, type IntentConflict,
} from '@/domain/yie/planning-schemas';

export class IntentVersionService {
  constructor(
    private readonly repository: DiscoveryPlanningRepository,
    private readonly sessions: DiscoverySessionService,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  async create(input: {
    session: DiscoverySession; rawUserInput: string; proposed: PlanningIntent;
    mode?: DiscoverySession['lifecycleMode'];
    patch?: PlanningIntentPatch | null; restoreVersion?: number | null; explanation: string;
    conflicts?: IntentConflict[]; warnings?: string[]; proposalMetadata?: Record<string, unknown> | null;
  }) {
    const versions = await this.repository.listIntentVersions(input.session.id);
    const parent = versions.at(-1) ?? null;
    const restore = input.restoreVersion
      ? await this.repository.getIntentVersion(input.session.id, input.restoreVersion)
      : null;
    const mode = input.mode ?? input.session.lifecycleMode;
    const normalized = applyPlanningTransition({
      mode,
      base: parent?.normalizedIntent,
      proposed: input.proposed,
      patch: input.patch ? PlanningIntentPatchSchema.parse(input.patch) : null,
      restoreSnapshot: restore?.normalizedIntent,
    });
    const value = DiscoveryIntentVersionSchema.parse({
      sessionId: input.session.id, version: versions.length + 1,
      parentVersion: parent?.version ?? null, mode,
      rawUserInput: input.rawUserInput, normalizedIntent: normalized,
      patch: input.patch ?? null, explanation: input.explanation,
      selectedSolutionProfileId: input.session.selectedSolutionProfileId,
      selectedSolutionProfileVersion: input.session.selectedSolutionProfileVersion,
      selectedICPId: input.session.selectedICPId, selectedICPVersion: input.session.selectedICPVersion,
      createdAt: this.now(), createdBy: input.session.actorId,
      provenance: { source: 'shadow_planning', method: input.proposalMetadata ? 'validated_ai_proposal' : 'deterministic' },
      proposalMetadata: input.proposalMetadata ?? null,
      validationResult: {
        valid: !(input.conflicts ?? []).some((item) => item.severity === 'HARD'),
        conflicts: input.conflicts ?? [], rejectedProposals: [],
        manualReviewRequired: (input.conflicts ?? []).some((item) => item.severity === 'HARD'),
      },
      warnings: [
        ...(input.warnings ?? []),
        ...(mode === 'RESTORE' ? ['RESTORED_NO_NEW_RESEARCH'] : []),
      ],
    });
    await this.sessions.appendEvent(input.session, 'INTENT_VALIDATED', {
      valid: value.validationResult.valid, conflictCount: value.validationResult.conflicts.length,
    });
    await this.repository.insertIntentVersion(value);
    await this.sessions.appendEvent(input.session, 'INTENT_VERSION_CREATED', { version: value.version, mode: value.mode });
    return value;
  }
  get(sessionId: string, version: number) { return this.repository.getIntentVersion(sessionId, version); }
  list(sessionId: string) { return this.repository.listIntentVersions(sessionId); }
}
