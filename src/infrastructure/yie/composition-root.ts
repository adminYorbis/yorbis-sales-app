import { GoogleGenAI } from '@google/genai';
import { ProviderRegistry } from '@/application/yie/providers/provider-registry';
import {
  GeminiShadowAdapter,
  type NeutralGeminiClient,
  type NeutralGeminiResponse,
} from './ai/gemini-adapter';
import { loadGeminiModelPolicy } from './ai/gemini-model-policy';

type GeminiSdkResult = {
  text?: string;
  responseId?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: { uri?: string; title?: string };
      }>;
    };
  }>;
};

export function createNeutralGeminiClient(apiKey: string): NeutralGeminiClient {
  const sdk = new GoogleGenAI({ apiKey });
  return {
    async generate(request) {
      const result = await sdk.models.generateContent({
        model: request.model,
        contents: request.contents,
        config: {
          ...(request.useGrounding ? { tools: [{ googleSearch: {} }] } : {}),
          maxOutputTokens: request.maxOutputTokens,
          temperature: request.temperature,
        },
      }) as GeminiSdkResult;
      const usage = result.usageMetadata;
      const groundingSources = result.candidates?.[0]?.groundingMetadata?.groundingChunks?.flatMap((chunk) =>
        chunk.web?.uri ? [{ url: chunk.web.uri, title: chunk.web.title }] : []
      );
      const response: NeutralGeminiResponse = {
        text: result.text ?? '',
        requestId: result.responseId,
        tokenUsage: usage ? {
          inputTokens: usage.promptTokenCount,
          outputTokens: usage.candidatesTokenCount,
          totalTokens: usage.totalTokenCount,
        } : undefined,
        groundingSources,
      };
      return response;
    },
  };
}

export type YieComposition = {
  registry: ProviderRegistry;
  defaultProvider: string;
};

export function createYieShadowComposition(
  environment: NodeJS.ProcessEnv = process.env,
): YieComposition {
  const defaultProvider = environment.AI_DEFAULT_PROVIDER?.trim() || 'gemini';
  if (defaultProvider !== 'gemini') {
    throw new Error(`YIE shadow provider ${defaultProvider} is not registered.`);
  }
  const apiKey = environment.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is required for the Gemini shadow composition.');
  const models = loadGeminiModelPolicy(environment);
  const adapter = new GeminiShadowAdapter({
    client: createNeutralGeminiClient(apiKey),
    models,
  });
  const registry = new ProviderRegistry();
  registry.register({
    id: 'gemini',
    reasoning: adapter,
    search: adapter,
    configuredModels: {
      PARSE_INTENT: models.PARSE_INTENT,
      PROPOSE_SEARCH_PLAN: models.PROPOSE_SEARCH_PLAN,
      DISCOVER_CANDIDATES: models.DISCOVER_CANDIDATES,
    },
    validateConfiguration: () => [],
  });
  return { registry, defaultProvider };
}
