import { createClient } from '@libsql/client';
import { ShadowPlanningService } from '../src/application/yie/discovery/shadow-planning-service';
import { TursoDiscoveryPlanningRepository } from '../src/infrastructure/yie/persistence/turso-discovery-planning-repository';
import { TursoICPRepository } from '../src/infrastructure/yie/persistence/turso-icp-repository';
import { TursoSolutionKnowledgeRepository } from '../src/infrastructure/yie/persistence/turso-solution-knowledge-repository';
import { FakePlanningProvider } from '../src/infrastructure/yie/testing/fake-planning-provider';

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
async function main() {
  const query = argument('query');
  if (!query) throw new Error('--query is required.');
  const url = argument('db') ?? process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL or --db is required.');
  const client = createClient(authToken && !url.startsWith('file:') ? { url, authToken } : { url });
  try {
    const repository = new TursoDiscoveryPlanningRepository(client);
    const providerMode = argument('provider') ?? 'fake';
    if (!['fake', 'deterministic'].includes(providerMode)) {
      throw new Error('Pocket 4 CLI permits only --provider fake or deterministic; live Gemini is intentionally disabled.');
    }
    const service = new ShadowPlanningService(
      repository, new TursoSolutionKnowledgeRepository(client), new TursoICPRepository(client),
      providerMode === 'fake' ? new FakePlanningProvider() : undefined,
      () => new Date().toISOString(),
      (entry) => console.error(JSON.stringify({ scope: 'yie-shadow-plan', ...entry })),
    );
    const result = await service.run({
      rawQuery: query, actorId: argument('actor') ?? 'shadow-cli',
      mode: argument('mode') as never, priorSessionId: argument('prior-session') ?? null,
      explicitICPId: argument('icp') ?? null,
      restoreVersion: argument('restore-version') ? Number(argument('restore-version')) : null,
    });
    console.log(JSON.stringify({
      sessionId: result.sessionId,
      pinnedSolution: {
        id: result.intent.selectedSolutionProfileId, version: result.intent.selectedSolutionProfileVersion,
      },
      selectedICP: result.selection.selectedICPId
        ? { id: result.selection.selectedICPId, version: result.selection.selectedICPVersion, method: result.selection.method }
        : { id: null, reason: result.selection.explanation },
      normalizedIntent: result.intent.normalizedIntent,
      conflicts: result.intent.validationResult.conflicts,
      warnings: result.intent.warnings,
      proposedSearchPlan: result.plan,
      searchQueryCount: result.plan.queries.length,
      shadowComparisonSummary: result.comparison,
      companies: [],
    }, null, 2));
  } finally {
    client.close();
  }
}
void main();
