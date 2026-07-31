import crypto from 'crypto';
import type { DiscoveryPlanningRepository } from './discovery-planning-repository';
import {
  DiscoverySessionEventSchema, DiscoverySessionSchema, type DiscoverySession,
  type DiscoverySessionEvent, type DiscoverySessionEvent as Event,
} from '@/domain/yie/planning-schemas';
import type { DiscoveryMode } from '@/domain/yie/enums';

export class DiscoverySessionService {
  constructor(
    private readonly repository: DiscoveryPlanningRepository,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => string = () => crypto.randomUUID(),
  ) {}
  async create(input: {
    actorId: string; mode: DiscoveryMode; solutionId: string; solutionVersion: number;
    icpId: string | null; icpVersion: number | null; externalCorrelationId?: string | null;
    productionReference?: string | null; metadata?: Record<string, unknown>;
  }) {
    const at = this.now();
    const session = DiscoverySessionSchema.parse({
      id: this.id(), externalCorrelationId: input.externalCorrelationId ?? null, actorId: input.actorId,
      status: 'CREATED', lifecycleMode: input.mode, createdAt: at, updatedAt: at,
      completedAt: null, failedAt: null, failureCode: null, currentIntentVersion: 0,
      selectedSolutionProfileId: input.solutionId, selectedSolutionProfileVersion: input.solutionVersion,
      selectedICPId: input.icpId, selectedICPVersion: input.icpVersion,
      productionDiscoveryReference: input.productionReference ?? null, shadowOnly: true,
      provenance: { source: 'shadow_planning', method: 'deterministic_session' },
      metadata: input.metadata ?? {},
    });
    const events: DiscoverySessionEvent[] = [
      this.makeEvent(session, 1, 'SESSION_CREATED', {}),
      this.makeEvent(session, 2, 'SOLUTION_PINNED', { id: input.solutionId, version: input.solutionVersion }),
      this.makeEvent(session, 3, 'ICP_SELECTED', { id: input.icpId, version: input.icpVersion }),
    ];
    await this.repository.createSession(session, events);
    return session;
  }
  async appendEvent(session: DiscoverySession, type: Event['type'], payload: Record<string, unknown>) {
    const existing = await this.repository.listEvents(session.id);
    await this.repository.appendEvent(this.makeEvent(session, existing.length + 1, type, payload));
  }
  async fail(session: DiscoverySession, code: string) {
    const at = this.now();
    await this.repository.updateSessionState({ id: session.id, status: 'FAILED', updatedAt: at, failedAt: at, failureCode: code });
    await this.appendEvent(session, 'SESSION_FAILED', { failureCode: code });
  }
  async markInterpreting(session: DiscoverySession) {
    await this.repository.updateSessionState({ id: session.id, expectedStatus: 'CREATED', status: 'INTERPRETING', updatedAt: this.now() });
  }
  async markPlanned(session: DiscoverySession) {
    const at = this.now();
    await this.repository.updateSessionState({ id: session.id, status: 'PLANNED', updatedAt: at, completedAt: at });
  }
  async repinICP(session: DiscoverySession, id: string | null, version: number | null) {
    await this.repository.updateSessionICP({ id: session.id, icpId: id, icpVersion: version, updatedAt: this.now() });
    await this.appendEvent(session, 'ICP_SELECTED', { id, version, changed: true });
  }
  async beginTransition(session: DiscoverySession, mode: DiscoveryMode) {
    await this.repository.updateSessionMode({ id: session.id, mode, status: 'INTERPRETING', updatedAt: this.now() });
    return DiscoverySessionSchema.parse({ ...session, lifecycleMode: mode, status: 'INTERPRETING', updatedAt: this.now(), completedAt: null });
  }
  private makeEvent(session: DiscoverySession, sequence: number, type: Event['type'], payload: Record<string, unknown>) {
    return DiscoverySessionEventSchema.parse({
      id: this.id(), sessionId: session.id, sequence, type, occurredAt: this.now(), actorId: session.actorId, payload,
    });
  }
}
