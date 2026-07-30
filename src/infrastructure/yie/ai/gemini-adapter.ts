import crypto from 'crypto';
import type {
  ProviderOperationMetadata,
  ProviderResult,
  TokenUsage,
} from '@/domain/yie/contracts';
import {
  CandidateCompanyProposalSchema,
  DiscoveryIntentProposalSchema,
  GroundingSourceMetadataSchema,
  SearchPlanProposalSchema,
} from '@/domain/yie/schemas';
import type {
  AIReasoningProvider,
  ParseDiscoveryIntentInput,
  ProposeSearchPlanInput,
  ProviderBudget,
} from '@/application/yie/providers/ai-reasoning-provider';
import type {
  DiscoverCandidatesInput,
  SearchGroundingProvider,
} from '@/application/yie/providers/search-grounding-provider';
import {
  ProviderError,
  isRetryableProviderError,
} from '@/application/yie/providers/provider-errors';
import type { GeminiModelPolicy, GeminiOperation } from './gemini-model-policy';
import { extractAndValidate } from './safe-json';
import { z } from 'zod';

export type NeutralGeminiRequest = {
  model: string;
  contents: string;
  maxOutputTokens: number;
  temperature: number;
  useGrounding: boolean;
};

export type NeutralGeminiResponse = {
  text: string;
  requestId?: string;
  tokenUsage?: TokenUsage;
  groundingSources?: Array<{
    url: string;
    title?: string;
  }>;
};

export interface NeutralGeminiClient {
  generate(request: NeutralGeminiRequest): Promise<NeutralGeminiResponse>;
}

type GeminiAdapterOptions = {
  client: NeutralGeminiClient;
  models: GeminiModelPolicy;
  now?: () => Date;
  requestId?: () => string;
};

const GroundedDiscoverySchema = z.object({
  candidates: z.array(CandidateCompanyProposalSchema).default([]),
  continuationToken: z.string().trim().min(1).optional(),
}).strict();

function mapGeminiError(error: unknown, operation: GeminiOperation) {
  if (error instanceof ProviderError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined;
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (/abort|cancel/i.test(message)) return new ProviderError('CANCELLED', 'Gemini operation was cancelled.', false, { provider: 'gemini', operation, cause: error });
  if (status === 401 || status === 403 || /api key|unauthenticated|permission/i.test(message)) {
    return new ProviderError('AUTHENTICATION', 'Gemini authentication failed.', false, { provider: 'gemini', operation, cause: error });
  }
  if (status === 429 || /rate.?limit/i.test(message)) {
    return new ProviderError('RATE_LIMIT', 'Gemini rate limit was reached.', true, { provider: 'gemini', operation, cause: error });
  }
  if (/quota|resource_exhausted/i.test(`${message} ${code}`)) {
    return new ProviderError('QUOTA', 'Gemini quota is unavailable.', false, { provider: 'gemini', operation, cause: error });
  }
  if (/safety|blocked/i.test(message)) {
    return new ProviderError('SAFETY_BLOCK', 'Gemini blocked the response for safety reasons.', false, { provider: 'gemini', operation, cause: error });
  }
  if (status !== undefined && status >= 500) {
    return new ProviderError('UPSTREAM', 'Gemini upstream service failed.', true, { provider: 'gemini', operation, cause: error });
  }
  return new ProviderError('UNKNOWN', 'Gemini operation failed.', false, { provider: 'gemini', operation, cause: error });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: GeminiOperation) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new ProviderError(
          'TIMEOUT',
          `Gemini ${operation} timed out.`,
          true,
          { provider: 'gemini', operation },
        )), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export class GeminiShadowAdapter implements AIReasoningProvider, SearchGroundingProvider {
  readonly providerId = 'gemini';
  readonly capabilities = {
    webGrounding: true,
    continuation: false,
    maxStrategiesPerRequest: 8,
  } as const;

  private readonly client: NeutralGeminiClient;
  private readonly models: GeminiModelPolicy;
  private readonly now: () => Date;
  private readonly nextRequestId: () => string;

  constructor(options: GeminiAdapterOptions) {
    this.client = options.client;
    this.models = options.models;
    this.now = options.now ?? (() => new Date());
    this.nextRequestId = options.requestId ?? (() => crypto.randomUUID());
  }

  async parseDiscoveryIntent(input: ParseDiscoveryIntentInput) {
    const prompt = `Propose a structured discovery interpretation. AI output is a proposal, not authoritative state.
Formal mode: ${input.mode}
Raw request: ${input.rawRequest}
Authoritative base for non-NEW mode: ${JSON.stringify(input.authoritativeBase ?? null)}
NEW must not inherit any base values. REPRIORITIZE is not a formal mode.
Return only JSON matching:
{"mode":"NEW|REFINE|EXPAND|EXCLUDE|RESTORE","selectedIcp":null,"industries":[],"geographies":[],"companySize":null,"businessModels":[],"requiredSignals":[],"preferredSignals":[],"excludedSignals":[],"buyerRoles":[],"desiredResultCount":25,"patch":{"set":{},"add":{},"remove":{},"clear":[]}}`;
    return this.runStructured(
      'PARSE_INTENT',
      prompt,
      input.budget,
      false,
      (text) => extractAndValidate(text, DiscoveryIntentProposalSchema),
    );
  }

  async proposeSearchPlan(input: ProposeSearchPlanInput) {
    const prompt = `Propose a public-source search plan for this validated intent:
${JSON.stringify(input.intent)}
Return 4 to 8 focused strategies. Do not return candidates.
Return only JSON matching:
{"intentVersion":${input.intent.version},"strategies":[{"key":"strategy-1","type":"WEB_SEARCH","query":"query","purpose":"purpose","priority":1,"expectedSignals":[]}],"rationale":"brief rationale"}`;
    return this.runStructured(
      'PROPOSE_SEARCH_PLAN',
      prompt,
      input.budget,
      false,
      (text) => extractAndValidate(text, SearchPlanProposalSchema),
    );
  }

  async discoverCandidates(input: DiscoverCandidatesInput) {
    const prompt = `Discover real companies from public sources for this validated intent and plan.
Intent: ${JSON.stringify(input.intent)}
Plan: ${JSON.stringify(input.plan)}
Excluded domains: ${JSON.stringify(input.excludedDomains)}
Do not invent companies, sources, people, or contact data. Unverified facts remain proposals with UNKNOWN state.
Return only JSON:
{"candidates":[{"candidateKey":"candidate-1","name":"Company","website":"https://company.example","proposedDomain":"company.example","description":"factual summary","sources":[{"sourceKey":"source-1","url":"https://source.example","title":"Source"}],"claims":[],"decisionMakers":[],"buyingSignals":[]}]} `;
    const result = await this.runStructured(
      'DISCOVER_CANDIDATES',
      prompt,
      input.budget,
      true,
      (text) => extractAndValidate(text, GroundedDiscoverySchema),
    );
    const groundingSources = result.raw.groundingSources?.flatMap((source, index) => {
      try {
        const url = new URL(source.url);
        return [GroundingSourceMetadataSchema.parse({
          sourceKey: `grounding-${index + 1}`,
          url: url.toString(),
          title: source.title,
          domain: url.hostname.replace(/^www\./, ''),
        })];
      } catch {
        return [];
      }
    }) ?? [];
    return {
      value: {
        candidates: result.value.candidates,
        groundingSources,
        continuationToken: result.value.continuationToken,
      },
      metadata: result.metadata,
    };
  }

  private async runStructured<T>(
    operation: GeminiOperation,
    contents: string,
    budget: ProviderBudget,
    useGrounding: boolean,
    parse: (text: string) => T,
  ): Promise<ProviderResult<T> & { raw: NeutralGeminiResponse }> {
    const started = this.now();
    const requestId = this.nextRequestId();
    let retries = 0;
    let lastError: ProviderError | undefined;
    while (retries <= budget.maxRetries) {
      try {
        const raw = await withTimeout(
          this.client.generate({
            model: this.models[operation],
            contents,
            maxOutputTokens: budget.maxOutputTokens ?? 16384,
            temperature: 0.2,
            useGrounding,
          }),
          budget.timeoutMs,
          operation,
        );
        const value = parse(raw.text);
        const completed = this.now();
        const metadata: ProviderOperationMetadata = {
          provider: this.providerId,
          model: this.models[operation],
          operation,
          requestId: raw.requestId ?? requestId,
          startedAt: started.toISOString(),
          completedAt: completed.toISOString(),
          durationMs: Math.max(0, completed.getTime() - started.getTime()),
          retryCount: retries,
          tokenUsage: raw.tokenUsage,
          groundingUsed: useGrounding,
          partialOutputAvailable: false,
        };
        return { value, metadata, raw };
      } catch (error) {
        lastError = mapGeminiError(error, operation);
        if (!isRetryableProviderError(lastError) || retries >= budget.maxRetries) throw lastError;
        retries += 1;
      }
    }
    throw lastError ?? new ProviderError('UNKNOWN', 'Gemini operation failed.', false);
  }
}
