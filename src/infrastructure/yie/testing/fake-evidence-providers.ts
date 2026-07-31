import type { CandidateExtractionProvider, ClaimExtractionProvider, EvidenceSearchProvider, ProposedClaimProposal } from '@/application/yie/providers/evidence-providers';
import { ProviderError } from '@/application/yie/providers/provider-errors';
import type { ProviderOperationMetadata } from '@/domain/yie/contracts';

const metadata=(operation:string):ProviderOperationMetadata=>({provider:'pocket-5-fake',model:'deterministic-fixture',operation,requestId:`fake-${operation}`,startedAt:'2026-07-30T12:00:00.000Z',completedAt:'2026-07-30T12:00:00.001Z',durationMs:1,retryCount:0,groundingUsed:true,partialOutputAvailable:false});
export class FakeEvidenceSearchProvider implements EvidenceSearchProvider {
  readonly providerId='pocket-5-fake-search'; calls=0; private attempts=new Map<string,number>();
  constructor(private readonly failures:{retryOnce?:boolean;always?:boolean}={}){}
  async executeSearchQuery(input:Parameters<EvidenceSearchProvider['executeSearchQuery']>[0]){
    this.calls++; const n=(this.attempts.get(input.queryId)??0)+1; this.attempts.set(input.queryId,n);
    if(this.failures.always)throw new ProviderError('UPSTREAM','Deterministic final failure.',false);
    if(this.failures.retryOnce&&n===1)throw new ProviderError('TIMEOUT','Deterministic retryable timeout.',true);
    return {value:{sources:[
      {providerResultId:'golden-official',url:'https://www.goldenstatefoods.example/about/?utm_source=test',title:'About Golden State Foods',snippet:'Golden State Foods LLC (Golden State Foods) is a California food distributor importing ingredients from Southeast Asia.',rank:1,sourceType:'COMPANY_WEBSITE' as const,relevance:.98},
      {providerResultId:'golden-directory',url:'https://directory.example/members/golden-state-foods?utm_campaign=x',title:'Member directory',snippet:'Golden State Foods LLC is a food distributor located in California. Sunrise Sauce is a product brand.',rank:2,sourceType:'INDUSTRY_DIRECTORY' as const,relevance:.9},
      {providerResultId:'similar',url:'https://goldenstatefoodproducts.example',title:'Golden State Food Products',snippet:'Golden State Food Products is a Nevada manufacturer.',rank:3,sourceType:'COMPANY_WEBSITE' as const,relevance:.75},
    ].slice(0,input.maximumResults),groundingSourcesReceived:0,modelEmittedUrlsReceived:0,modelEmittedUrls:[]},metadata:metadata('EXECUTE_SEARCH_QUERY')};
  }
}
export class FakeCandidateExtractionProvider implements CandidateExtractionProvider {
  readonly providerId='pocket-5-fake-candidates'; calls=0;
  async extractCandidateMentions(input:Parameters<CandidateExtractionProvider['extractCandidateMentions']>[0]){
    this.calls++; const value=[] as Array<{rawName:string;normalizedNameProposal:string;legalNameProposal?:string;brandNameProposal?:string;websiteProposal?:string;locationProposal?:string;industryProposal?:string;businessModelProposal?:string;mentionContext:string;entityType:'COMPANY'|'PRODUCT';confidence:number}>;
    if(input.excerpt.includes('Golden State Foods'))value.push({rawName:'Golden State Foods',normalizedNameProposal:'Golden State Foods',legalNameProposal:'Golden State Foods LLC',brandNameProposal:'Golden State Foods',websiteProposal:'https://goldenstatefoods.example',locationProposal:'California',industryProposal:'Food distribution',businessModelProposal:'Distributor',mentionContext:input.excerpt,entityType:'COMPANY',confidence:.95});
    if(input.excerpt.includes('Golden State Food Products'))value.push({rawName:'Golden State Food Products',normalizedNameProposal:'Golden State Food Products',websiteProposal:'https://goldenstatefoodproducts.example',locationProposal:'Nevada',industryProposal:'Manufacturing',mentionContext:input.excerpt,entityType:'COMPANY',confidence:.9});
    if(input.excerpt.includes('Sunrise Sauce'))value.push({rawName:'Sunrise Sauce',normalizedNameProposal:'Sunrise Sauce',mentionContext:input.excerpt,entityType:'PRODUCT',confidence:.99});
    return {value,metadata:metadata('EXTRACT_CANDIDATE_MENTIONS')};
  }
}
export class FakeClaimExtractionProvider implements ClaimExtractionProvider {
  readonly providerId='pocket-5-fake-claims'; calls=0;
  async extractProposedClaims(input:Parameters<ClaimExtractionProvider['extractProposedClaims']>[0]){
    this.calls++; const value:ProposedClaimProposal[]=[{claimType:'COMPANY_NAME',normalizedValue:input.companyName,rawValue:input.companyName,supportType:'DIRECT_TEXT',extractedText:input.excerpt,confidence:.96}];
    if(input.excerpt.includes('California'))value.push({claimType:'LOCATION',normalizedValue:'California',rawValue:'California',supportType:'DIRECT_TEXT',extractedText:input.excerpt,confidence:.92});
    if(input.excerpt.includes('Southeast Asia'))value.push({claimType:'SUPPLIER_GEOGRAPHY',normalizedValue:'Southeast Asia',rawValue:'Southeast Asia',supportType:'INFERRED_FROM_CONTEXT',extractedText:input.excerpt,confidence:.75});
    return {value,metadata:metadata('EXTRACT_PROPOSED_CLAIMS')};
  }
}

