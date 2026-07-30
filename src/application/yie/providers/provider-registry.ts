import type { AIReasoningProvider } from './ai-reasoning-provider';
import type { SearchGroundingProvider } from './search-grounding-provider';
import type { SourceRetrievalProvider } from './source-retrieval-provider';
import { ProviderError, unsupportedCapability } from './provider-errors';

export type ProviderCapability = 'AI_REASONING' | 'SEARCH_GROUNDING' | 'SOURCE_RETRIEVAL';
export type ProviderOperation = 'PARSE_INTENT' | 'PROPOSE_SEARCH_PLAN' | 'DISCOVER_CANDIDATES' | 'RETRIEVE_SOURCE';

export type ProviderRegistration = {
  id: string;
  reasoning?: AIReasoningProvider;
  search?: SearchGroundingProvider;
  retrieval?: SourceRetrievalProvider;
  configuredModels?: Partial<Record<ProviderOperation, string>>;
  validateConfiguration?: () => string[];
};

export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderRegistration>();

  register(registration: ProviderRegistration) {
    if (this.providers.has(registration.id)) {
      throw new ProviderError('CONFIGURATION', `Provider ${registration.id} is already registered.`, false);
    }
    this.providers.set(registration.id, registration);
  }

  reasoning(providerId: string) {
    const provider = this.requireProvider(providerId);
    if (!provider.reasoning) throw unsupportedCapability(providerId, 'AI_REASONING');
    return provider.reasoning;
  }

  search(providerId: string) {
    const provider = this.requireProvider(providerId);
    if (!provider.search) throw unsupportedCapability(providerId, 'SEARCH_GROUNDING');
    return provider.search;
  }

  retrieval(providerId: string) {
    const provider = this.requireProvider(providerId);
    if (!provider.retrieval) throw unsupportedCapability(providerId, 'SOURCE_RETRIEVAL');
    return provider.retrieval;
  }

  supports(providerId: string, capability: ProviderCapability) {
    const provider = this.requireProvider(providerId);
    if (capability === 'AI_REASONING') return Boolean(provider.reasoning);
    if (capability === 'SEARCH_GROUNDING') return Boolean(provider.search);
    return Boolean(provider.retrieval);
  }

  configuredModel(providerId: string, operation: ProviderOperation) {
    return this.requireProvider(providerId).configuredModels?.[operation];
  }

  health() {
    return [...this.providers.values()].map((provider) => {
      const issues = provider.validateConfiguration?.() ?? [];
      return {
        provider: provider.id,
        healthy: issues.length === 0,
        issues,
        capabilities: {
          reasoning: Boolean(provider.reasoning),
          searchGrounding: Boolean(provider.search),
          sourceRetrieval: Boolean(provider.retrieval),
        },
      };
    });
  }

  private requireProvider(providerId: string) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new ProviderError('CONFIGURATION', `Provider ${providerId} is not registered.`, false);
    }
    return provider;
  }
}
