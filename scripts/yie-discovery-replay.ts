import { getTursoClient } from '../src/lib/db';
import { DiscoveryReplayService } from '../src/application/yie/evidence/evidence-execution-service';
import { TursoEvidenceRepository } from '../src/infrastructure/yie/persistence/turso-evidence-repository';
const args=process.argv.slice(2),index=args.indexOf('--run-id'),runId=index>=0?args[index+1]:undefined;if(!runId)throw new Error('Usage: npm run yie:discovery:replay -- --run-id <run-id>');
console.log(JSON.stringify(await new DiscoveryReplayService(new TursoEvidenceRepository(getTursoClient())).replay(runId),null,2));
