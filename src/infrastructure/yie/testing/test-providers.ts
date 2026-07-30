import type {
  AIReasoningProvider,
  ParseDiscoveryIntentInput,
  ProposeSearchPlanInput,
} from '@/application/yie/providers/ai-reasoning-provider';
import type {
  DiscoverCandidatesInput,
  SearchGroundingProvider,
} from '@/application/yie/providers/search-grounding-provider';
import type {
  ProviderOperationMetadata,
  ProviderResult,
  SearchPlanProposal,
  DiscoveryIntentProposal,
  GroundedCandidateResult,
} from '@/domain/yie/contracts';

function metadata(operation: string): ProviderOperationMetadata {
  return {
    provider: 'test',
    model: 'fixture',
    operation,
    requestId: `test-${operation}`,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:00.001Z',
    durationMs: 1,
    retryCount: 0,
    groundingUsed: operation === 'DISCOVER_CANDIDATES',
    partialOutputAvailable: false,
  };
}

export class TestReasoningProvider implements AIReasoningProvider {
  readonly providerId = 'test';
  calls: string[] = [];

  constructor(
    private readonly intentProposal: DiscoveryIntentProposal,
    private readonly planProposal: SearchPlanProposal,
  ) {}

  async parseDiscoveryIntent(_input: ParseDiscoveryIntentInput): Promise<ProviderResult<DiscoveryIntentProposal>> {
    void _input;
    this.calls.push('PARSE_INTENT');
    return { value: this.intentProposal, metadata: metadata('PARSE_INTENT') };
  }

  async proposeSearchPlan(_input: ProposeSearchPlanInput): Promise<ProviderResult<SearchPlanProposal>> {
    void _input;
    this.calls.push('PROPOSE_SEARCH_PLAN');
    return { value: this.planProposal, metadata: metadata('PROPOSE_SEARCH_PLAN') };
  }
}

export class TestSearchProvider implements SearchGroundingProvider {
  readonly providerId = 'test';
  readonly capabilities = { webGrounding: true, continuation: true };
  calls = 0;

  constructor(private readonly result: GroundedCandidateResult) {}

  async discoverCandidates(_input: DiscoverCandidatesInput): Promise<GroundedCandidateResult> {
    void _input;
    this.calls += 1;
    return this.result;
  }
}
