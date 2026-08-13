import type { EvidenceSearchProvider } from '@/application/yie/providers/evidence-providers';
import type { ProviderBudget } from '@/application/yie/providers/ai-reasoning-provider';

const SERPER_API_URL = 'https://google.serper.dev/search';

const metadata = (operation: string) => ({
  provider: 'serper',
  model: 'serper-grounding',
  operation,
  requestId: `serper-${Date.now()}`,
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: 0,
  retryCount: 0,
  groundingUsed: true,
  partialOutputAvailable: false,
});

export class SerperSearchProvider implements EvidenceSearchProvider {
  readonly providerId = 'serper';

  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('Serper API key is required for SerperSearchProvider.');
    }
    this.apiKey = apiKey;
  }

  async executeSearchQuery(input: {
    queryId: string;
    queryText: string;
    sourceCategory: string;
    maximumResults: number;
    budget: ProviderBudget;
  }) {
    const query = input.queryText;

    const payload = {
      q: query,
      gl: 'us',
      hl: 'en',
      num: Math.min(input.maximumResults, 10),
      safe: 'off',
    };

    try {
      const response = await fetch(SERPER_API_URL, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Serper API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Parse Serper organic results into the format expected by EvidenceExecutionService
      const sources = (data.organic ?? [])
        .slice(0, input.maximumResults)
        .map((result: any, index: number) => ({
          providerResultId: `serper-${index + 1}`,
          url: result.link || result.url || '',
          title: result.title || '',
          snippet: result.snippet || '',
          rank: index + 1,
          sourceType: 'SEARCH_RESULT',
        }));

      return {
        value: {
          sources,
          groundingSourcesReceived: sources.length,
          modelEmittedUrlsReceived: 0,
          modelEmittedUrls: [],
        },
        metadata: metadata('EXECUTE_SEARCH_QUERY'),
      };
    } catch (error) {
      throw new Error(`Serper search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}