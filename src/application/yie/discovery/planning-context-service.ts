import type { ICPRepository } from '@/application/yie/knowledge/icp-repository';
import type { SolutionKnowledgeRepository } from '@/application/yie/knowledge/solution-knowledge-repository';
import type { DiscoveryPlanningRepository } from './discovery-planning-repository';

export class PlanningContextService {
  constructor(
    private readonly repository: DiscoveryPlanningRepository,
    private readonly knowledge: SolutionKnowledgeRepository,
    private readonly icps: ICPRepository,
  ) {}
  async reconstruct(sessionId: string) {
    const session = await this.repository.getSession(sessionId);
    if (!session) throw new Error('Discovery Session not found.');
    const solution = await this.knowledge.getSolutionProfileVersion(
      session.selectedSolutionProfileId, session.selectedSolutionProfileVersion,
    );
    if (!solution) throw new Error('Pinned Solution Profile version no longer exists.');
    const icp = session.selectedICPId && session.selectedICPVersion
      ? await this.icps.getICPVersion(session.selectedICPId, session.selectedICPVersion)
      : null;
    if (session.selectedICPId && !icp) throw new Error('Pinned ICP version no longer exists.');
    return {
      session, solution, icp,
      intents: await this.repository.listIntentVersions(sessionId),
      plan: await this.repository.getSearchPlan(sessionId),
      events: await this.repository.listEvents(sessionId),
      comparisons: await this.repository.listShadowComparisons(sessionId),
    };
  }
}
