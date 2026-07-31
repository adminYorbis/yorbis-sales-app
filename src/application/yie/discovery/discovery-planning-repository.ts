import type {
  DiscoveryIntentVersion, DiscoverySession, DiscoverySessionEvent, SearchPlan, ShadowComparison,
} from '@/domain/yie/planning-schemas';

export interface DiscoveryPlanningRepository {
  createSession(session: DiscoverySession, events: DiscoverySessionEvent[]): Promise<void>;
  getSession(id: string): Promise<DiscoverySession | null>;
  updateSessionState(input: {
    id: string; expectedStatus?: DiscoverySession['status']; status: DiscoverySession['status'];
    updatedAt: string; currentIntentVersion?: number; completedAt?: string | null;
    failedAt?: string | null; failureCode?: string | null;
  }): Promise<void>;
  updateSessionICP(input: { id: string; icpId: string | null; icpVersion: number | null; updatedAt: string }): Promise<void>;
  updateSessionMode(input: { id: string; mode: DiscoverySession['lifecycleMode']; status: DiscoverySession['status']; updatedAt: string }): Promise<void>;
  appendEvent(event: DiscoverySessionEvent): Promise<void>;
  listEvents(sessionId: string): Promise<DiscoverySessionEvent[]>;
  insertIntentVersion(intent: DiscoveryIntentVersion): Promise<void>;
  getIntentVersion(sessionId: string, version: number): Promise<DiscoveryIntentVersion | null>;
  listIntentVersions(sessionId: string): Promise<DiscoveryIntentVersion[]>;
  insertSearchPlan(plan: SearchPlan): Promise<void>;
  getSearchPlan(sessionId: string, planVersion?: number): Promise<SearchPlan | null>;
  insertShadowComparison(comparison: ShadowComparison): Promise<void>;
  listShadowComparisons(sessionId: string): Promise<ShadowComparison[]>;
}
