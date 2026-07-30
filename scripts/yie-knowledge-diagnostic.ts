import { createClient } from '@libsql/client';
import { TursoSolutionKnowledgeRepository } from '../src/infrastructure/yie/persistence/turso-solution-knowledge-repository';
import { TursoICPRepository } from '../src/infrastructure/yie/persistence/turso-icp-repository';

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL is required.');
  const client = createClient(authToken ? { url, authToken } : { url });
  try {
    const knowledge = new TursoSolutionKnowledgeRepository(client);
    const icps = new TursoICPRepository(client);
    const solution = await knowledge.getActiveSolutionProfile();
    const activeICPs = await icps.listActiveICPs();
    const missingReferences: string[] = [];
    for (const icp of activeICPs) {
      for (const reference of [...icp.capabilities, ...icp.personas, ...icp.triggers]) {
        if (!await knowledge.getVersion(reference.definitionId, reference.version)) {
          missingReferences.push(`${icp.definition.id}:${reference.definitionId}@${reference.version}`);
        }
      }
    }
    console.log(JSON.stringify({
      solution: solution ? { id: solution.definition.id, name: solution.version.name, version: solution.version.version } : null,
      activeICPs: activeICPs.map((icp) => ({ id: icp.definition.id, name: icp.version.name, version: icp.version.version })),
      counts: { activeICPs: activeICPs.length, missingReferences: missingReferences.length },
      missingReferences,
    }, null, 2));
  } finally {
    client.close();
  }
}

void main();
