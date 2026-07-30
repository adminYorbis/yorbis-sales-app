import { z } from 'zod';
import {
  BuyingSignalProposalSchema,
  CandidateCompanyProposalSchema,
  CompanyClaimProposalSchema,
  CompanySizeRangeSchema,
  CompanySourceProposalSchema,
  DecisionMakerProposalSchema,
  DiscoveryIntentPatchSchema,
  DiscoveryIntentProposalSchema,
  DiscoveryIntentSchema,
  GroundingSourceMetadataSchema,
  IcpReferenceSchema,
  ProviderOperationMetadataSchema,
  RetrievalResultSchema,
  SearchPlanProposalSchema,
  SearchStrategyProposalSchema,
  TokenUsageSchema,
} from './schemas';

export type CompanySizeRange = z.infer<typeof CompanySizeRangeSchema>;
export type IcpReference = z.infer<typeof IcpReferenceSchema>;
export type DiscoveryIntent = z.infer<typeof DiscoveryIntentSchema>;
export type DiscoveryIntentPatch = z.infer<typeof DiscoveryIntentPatchSchema>;
export type DiscoveryIntentProposal = z.infer<typeof DiscoveryIntentProposalSchema>;
export type SearchPlanProposal = z.infer<typeof SearchPlanProposalSchema>;
export type SearchStrategyProposal = z.infer<typeof SearchStrategyProposalSchema>;
export type CandidateCompanyProposal = z.infer<typeof CandidateCompanyProposalSchema>;
export type CompanySourceProposal = z.infer<typeof CompanySourceProposalSchema>;
export type CompanyClaimProposal = z.infer<typeof CompanyClaimProposalSchema>;
export type DecisionMakerProposal = z.infer<typeof DecisionMakerProposalSchema>;
export type BuyingSignalProposal = z.infer<typeof BuyingSignalProposalSchema>;
export type ProviderOperationMetadata = z.infer<typeof ProviderOperationMetadataSchema>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export type GroundingSourceMetadata = z.infer<typeof GroundingSourceMetadataSchema>;
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;

export type ProviderResult<T> = {
  value: T;
  metadata: ProviderOperationMetadata;
};

export type GroundedCandidateResult = ProviderResult<{
  candidates: CandidateCompanyProposal[];
  groundingSources: GroundingSourceMetadata[];
  continuationToken?: string;
}>;

export type IntentTransitionValidation =
  | { valid: true }
  | { valid: false; reason: string };
