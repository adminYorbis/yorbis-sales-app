import type {
  AIReasoningProvider, ParseDiscoveryIntentInput, ProposeSearchPlanInput,
} from '@/application/yie/providers/ai-reasoning-provider';
import type { DiscoveryIntentProposal, ProviderOperationMetadata, SearchPlanProposal } from '@/domain/yie/contracts';

function metadata(operation: string): ProviderOperationMetadata {
  return {
    provider: 'fake-planning', model: 'deterministic-fixture', operation,
    requestId: `fake-${operation.toLowerCase()}`, startedAt: '2026-07-30T00:00:00.000Z',
    completedAt: '2026-07-30T00:00:00.001Z', durationMs: 1, retryCount: 0,
    groundingUsed: false, partialOutputAvailable: false,
  };
}
export class FakePlanningProvider implements AIReasoningProvider {
  readonly providerId = 'fake-planning';
  calls: string[] = [];
  async parseDiscoveryIntent(input: ParseDiscoveryIntentInput) {
    this.calls.push('PARSE_INTENT');
    const value: DiscoveryIntentProposal = { mode: input.mode };
    return { value, metadata: metadata('PARSE_INTENT') };
  }
  async proposeSearchPlan(input: ProposeSearchPlanInput) {
    this.calls.push('PROPOSE_SEARCH_PLAN');
    const geography = input.intent.geographies[0] ?? 'United States';
    const industry = input.intent.industries[0] ?? 'business';
    const value: SearchPlanProposal = {
      intentVersion: input.intent.version,
      rationale: 'Deterministic fake provider proposal for local shadow validation.',
      strategies: [{
        key: 'fake-official-directory', type: 'DIRECTORY_SEARCH',
        query: `${geography} ${industry} official industry directory`,
        purpose: 'Locate public directories for later candidate research.',
        priority: 50, expectedSignals: ['operating company', 'industry'],
      }],
    };
    return { value, metadata: metadata('PROPOSE_SEARCH_PLAN') };
  }
}
