import type {
  DiscoveryIntent,
  GroundedCandidateResult,
  SearchPlanProposal,
} from '@/domain/yie/contracts';
import type { ProviderBudget } from './ai-reasoning-provider';

export type SearchGroundingCapabilities = {
  webGrounding: boolean;
  continuation: boolean;
  maxStrategiesPerRequest?: number;
};

export type DiscoverCandidatesInput = {
  intent: DiscoveryIntent;
  plan: SearchPlanProposal;
  excludedDomains: string[];
  continuationToken?: string;
  budget: ProviderBudget;
};

export interface SearchGroundingProvider {
  readonly providerId: string;
  readonly capabilities: SearchGroundingCapabilities;
  discoverCandidates(input: DiscoverCandidatesInput): Promise<GroundedCandidateResult>;
}
