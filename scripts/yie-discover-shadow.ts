import { getTursoClient } from '../src/lib/db';
import { EvidenceExecutionService } from '../src/application/yie/evidence/evidence-execution-service';
import { ShadowPlanningService } from '../src/application/yie/discovery/shadow-planning-service';
import { TursoDiscoveryPlanningRepository } from '../src/infrastructure/yie/persistence/turso-discovery-planning-repository';
import { TursoEvidenceRepository } from '../src/infrastructure/yie/persistence/turso-evidence-repository';
import { TursoICPRepository } from '../src/infrastructure/yie/persistence/turso-icp-repository';
import { TursoSolutionKnowledgeRepository } from '../src/infrastructure/yie/persistence/turso-solution-knowledge-repository';
import { FakePlanningProvider } from '../src/infrastructure/yie/testing/fake-planning-provider';
import { FakeCandidateExtractionProvider, FakeClaimExtractionProvider, FakeEvidenceSearchProvider } from '../src/infrastructure/yie/testing/fake-evidence-providers';
import { GeminiLiveEvidenceProvider } from '../src/infrastructure/yie/ai/gemini-live-evidence-provider';
import { createNeutralGeminiClient } from '../src/infrastructure/yie/composition-root';
import { loadGeminiModelPolicy } from '../src/infrastructure/yie/ai/gemini-model-policy';

const args=process.argv.slice(2);const value=(name:string)=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const provider=value('--provider')??'fake';if(!['fake','gemini-live'].includes(provider))throw new Error('--provider must be fake or gemini-live. Fake is the safe default.');
const db=getTursoClient(),planning=new TursoDiscoveryPlanningRepository(db),evidence=new TursoEvidenceRepository(db);
let sessionId=value('--session-id');const query=value('--query');
if(!sessionId&&query){const planned=await new ShadowPlanningService(planning,new TursoSolutionKnowledgeRepository(db),new TursoICPRepository(db),new FakePlanningProvider()).run({rawQuery:query,actorId:process.env.USERNAME??'shadow-cli',mode:'NEW'});sessionId=planned.sessionId;}
if(!sessionId)throw new Error('Provide --session-id <Pocket-4-session-id> or --query "search request".');
const models=loadGeminiModelPolicy();let searchProvider,mentionProvider,claimProvider;
if(provider==='gemini-live'){const key=process.env.GEMINI_API_KEY?.trim();if(!key)throw new Error('GEMINI_API_KEY is required only when --provider gemini-live is explicit.');const live=new GeminiLiveEvidenceProvider(createNeutralGeminiClient(key),models);searchProvider=live;mentionProvider=live;claimProvider=live;}else{searchProvider=new FakeEvidenceSearchProvider();mentionProvider=new FakeCandidateExtractionProvider();claimProvider=new FakeClaimExtractionProvider();}
const service=new EvidenceExecutionService(planning,evidence,searchProvider,mentionProvider,claimProvider);
const result=value('--resume')?await service.resume(value('--resume')!):await service.start({sessionId,planVersion:value('--plan-version')?Number(value('--plan-version')):undefined,actorId:process.env.USERNAME??'shadow-cli',dryRun:args.includes('--dry-run'),limits:{maxQueries:value('--max-queries')?Number(value('--max-queries')):undefined,maxTotalSources:value('--max-sources')?Number(value('--max-sources')):undefined,maxCanonicalCandidates:value('--max-candidates')?Number(value('--max-candidates')):undefined,timeoutMsPerQuery:value('--timeout-ms')?Number(value('--timeout-ms')):undefined,maxRetriesPerQuery:value('--max-retries')?Number(value('--max-retries')):undefined}}) as Record<string,unknown>;
const run=result.run as {id:string;providerRequestCount:number;providerRetryCount:number;totalProviderLatencyMs:number;status:string};const attempts=(result.attempts??[]) as Array<{status:string;executionStepId:string;providerRequestMetadata:Record<string,unknown>}>;
const count=async(sql:string)=>Number((await db.execute({sql,args:[run.id]})).rows[0].n);const report={provider,model:provider==='gemini-live'?models.DISCOVER_CANDIDATES:'deterministic-fixture',runId:run.id,status:run.status,queriesExecuted:new Set(attempts.map(x=>x.executionStepId)).size,providerCalls:run.providerRequestCount,groundingSourcesReceived:attempts.reduce((n,x)=>n+Number(x.providerRequestMetadata.groundingSourcesReceived??0),0),modelEmittedUrlsReceived:attempts.reduce((n,x)=>n+Number(x.providerRequestMetadata.modelEmittedUrlsReceived??0),0),canonicalSourcesPersisted:await count('SELECT COUNT(DISTINCT source_id) n FROM yie_source_observations WHERE run_id=?'),candidateMentions:await count('SELECT COUNT(*) n FROM yie_candidate_mentions WHERE run_id=?'),canonicalCandidates:await count('SELECT COUNT(DISTINCT candidate_company_id) n FROM yie_candidate_mention_links WHERE run_id=?'),proposedClaims:await count('SELECT COUNT(*) n FROM yie_proposed_claims WHERE run_id=?'),evidenceLinks:await count('SELECT COUNT(*) n FROM yie_claim_evidence_links e JOIN yie_proposed_claims c ON c.id=e.claim_id WHERE c.run_id=?'),failures:attempts.filter(x=>x.status==='FAILED_FINAL').length,retries:run.providerRetryCount,totalLatencyMs:run.totalProviderLatencyMs,verifiedCompanies:0,scores:0,contacts:0,outreach:0};
console.log(JSON.stringify(args.includes('--json')?{report,result}:report,null,2));

