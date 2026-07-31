import crypto from 'crypto';
import { compareShadowInterpretation } from '@/domain/yie/shadow-comparison-policy';
import type { DiscoveryIntentVersion, DiscoverySession, ProductionInterpretation } from '@/domain/yie/planning-schemas';
import type { DiscoveryPlanningRepository } from './discovery-planning-repository';
import type { DiscoverySessionService } from './discovery-session-service';

export class ShadowComparisonService {
  constructor(
    private readonly repository: DiscoveryPlanningRepository,
    private readonly sessions: DiscoverySessionService,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  async compare(session: DiscoverySession, intent: DiscoveryIntentVersion, production: ProductionInterpretation) {
    const comparison = compareShadowInterpretation({
      id: crypto.randomUUID(), sessionId: session.id, production, yie: intent, createdAt: this.now(),
    });
    await this.repository.insertShadowComparison(comparison);
    await this.sessions.appendEvent(session, 'SHADOW_COMPARISON_CREATED', {
      fingerprint: comparison.fingerprint, warningCount: comparison.semanticWarnings.length,
    });
    return comparison;
  }
}
