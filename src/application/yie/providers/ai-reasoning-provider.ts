import type {
  BuyingSignalProposal,
  CandidateCompanyProposal,
  CompanyClaimProposal,
  DecisionMakerProposal,
  DiscoveryIntent,
  DiscoveryIntentProposal,
  ProviderResult,
  SearchPlanProposal,
} from '@/domain/yie/contracts';
import type { DiscoveryMode } from '@/domain/yie/enums';

export type ProviderBudget = {
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens?: number;
};

export type ParseDiscoveryIntentInput = {
  rawRequest: string;
  mode: DiscoveryMode;
  authoritativeBase?: DiscoveryIntent;
  budget: ProviderBudget;
};

export type ProposeSearchPlanInput = {
  intent: DiscoveryIntent;
  budget: ProviderBudget;
};

export interface AIReasoningProvider {
  readonly providerId: string;
  parseDiscoveryIntent(input: ParseDiscoveryIntentInput): Promise<ProviderResult<DiscoveryIntentProposal>>;
  proposeSearchPlan(input: ProposeSearchPlanInput): Promise<ProviderResult<SearchPlanProposal>>;
  extractCompanyClaims?(
    input: { candidate: CandidateCompanyProposal; budget: ProviderBudget },
  ): Promise<ProviderResult<CompanyClaimProposal[]>>;
  assessEvidenceSupport?(
    input: { claims: CompanyClaimProposal[]; budget: ProviderBudget },
  ): Promise<ProviderResult<Array<{ claimKey: string; supported: boolean; reason: string }>>>;
  identifyDecisionMakers?(
    input: { candidate: CandidateCompanyProposal; budget: ProviderBudget },
  ): Promise<ProviderResult<DecisionMakerProposal[]>>;
  extractBuyingSignals?(
    input: { candidate: CandidateCompanyProposal; budget: ProviderBudget },
  ): Promise<ProviderResult<BuyingSignalProposal[]>>;
  draftOpportunityNarrative?(
    input: { candidate: CandidateCompanyProposal; budget: ProviderBudget },
  ): Promise<ProviderResult<{ narrative: string }>>;
  draftOutreach?(
    input: { candidate: CandidateCompanyProposal; channel: string; budget: ProviderBudget },
  ): Promise<ProviderResult<{ subject?: string; body: string }>>;
}
