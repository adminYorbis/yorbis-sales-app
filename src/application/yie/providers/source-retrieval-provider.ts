import type {
  ProviderResult,
  RetrievalResult,
} from '@/domain/yie/contracts';
import type { ProviderBudget } from './ai-reasoning-provider';

export type SourceRetrievalCapabilities = {
  metadata: boolean;
  canonicalUrl: boolean;
  relevantExcerpt: boolean;
  fingerprint: boolean;
  fullContentStoredByDefault: false;
};

export interface SourceRetrievalProvider {
  readonly providerId: string;
  readonly capabilities: SourceRetrievalCapabilities;
  retrieveSource(input: {
    url: string;
    relevanceQuestion?: string;
    budget: ProviderBudget;
  }): Promise<ProviderResult<RetrievalResult>>;
}
