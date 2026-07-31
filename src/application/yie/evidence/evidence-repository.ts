import type {
  CandidateCompany, CandidateMention, CanonicalSource, ClaimEvidenceLink, DiscoveryCheckpoint,
  DiscoveryRun, IdentityResolutionDecision, ProposedClaim, SearchAttempt, SearchExecutionPlan,
  SourceExcerpt, SourceObservation,
} from '@/domain/yie/evidence-schemas';

export interface EvidenceRepository {
  nextRunVersion(searchPlanId: string, searchPlanVersion: number): Promise<number>;
  createRun(run: DiscoveryRun): Promise<void>;
  getRun(id: string): Promise<DiscoveryRun | null>;
  updateRun(run: DiscoveryRun): Promise<void>;
  insertExecutionPlan(plan: SearchExecutionPlan): Promise<void>;
  getExecutionPlan(runId: string): Promise<SearchExecutionPlan | null>;
  updateStep(runId: string, stepId: string, status: string, step: unknown): Promise<void>;
  insertAttempt(attempt: SearchAttempt): Promise<void>;
  listAttempts(runId: string): Promise<SearchAttempt[]>;
  upsertSource(source: CanonicalSource): Promise<CanonicalSource>;
  insertObservation(observation: SourceObservation): Promise<boolean>;
  insertExcerpt(excerpt: SourceExcerpt): Promise<boolean>;
  listExcerpts(runId: string): Promise<SourceExcerpt[]>;
  insertMention(mention: CandidateMention): Promise<boolean>;
  listMentions(runId: string): Promise<CandidateMention[]>;
  listCandidates(): Promise<CandidateCompany[]>;
  persistResolution(input: { candidate?: CandidateCompany; mention: CandidateMention; decision: IdentityResolutionDecision }): Promise<string | null>;
  persistClaim(claim: ProposedClaim, evidence: ClaimEvidenceLink): Promise<boolean>;
  appendCheckpoint(checkpoint: DiscoveryCheckpoint): Promise<boolean>;
  listCheckpoints(runId: string): Promise<DiscoveryCheckpoint[]>;
  replay(runId: string): Promise<Record<string, unknown>>;
}
