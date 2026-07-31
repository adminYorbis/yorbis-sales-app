import { getTursoClient } from '../src/lib/db';
import { EvidenceExecutionService } from '../src/application/yie/evidence/evidence-execution-service';
import { TursoDiscoveryPlanningRepository } from '../src/infrastructure/yie/persistence/turso-discovery-planning-repository';
import { TursoEvidenceRepository } from '../src/infrastructure/yie/persistence/turso-evidence-repository';
import { FakeCandidateExtractionProvider, FakeClaimExtractionProvider, FakeEvidenceSearchProvider } from '../src/infrastructure/yie/testing/fake-evidence-providers';

const args=process.argv.slice(2);const value=(name:string)=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const sessionId=value('--session-id');if(!sessionId)throw new Error('Usage: npm run yie:discover:shadow -- --session-id <Pocket-4-session-id> [--plan-version n] [--dry-run] [--resume run-id] [--json]');
const db=getTursoClient(),repository=new TursoEvidenceRepository(db);const service=new EvidenceExecutionService(new TursoDiscoveryPlanningRepository(db),repository,new FakeEvidenceSearchProvider(),new FakeCandidateExtractionProvider(),new FakeClaimExtractionProvider());
const result=value('--resume')?await service.resume(value('--resume')!):await service.start({sessionId,planVersion:value('--plan-version')?Number(value('--plan-version')):undefined,actorId:process.env.USERNAME??'shadow-cli',dryRun:args.includes('--dry-run'),limits:{maxQueries:value('--max-queries')?Number(value('--max-queries')):undefined,maxTotalSources:value('--max-sources')?Number(value('--max-sources')):undefined,maxCanonicalCandidates:value('--max-candidates')?Number(value('--max-candidates')):undefined}});
console.log(JSON.stringify(result,null,args.includes('--json')?2:0));
