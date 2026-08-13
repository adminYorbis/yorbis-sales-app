import { SerperSearchProvider } from './src/infrastructure/yie/ai/serper-search-provider.js';

const apiKey = 'a8217029eda7ed9a6d4fbdbdd7fb9e526f14c7f9';
const provider = new SerperSearchProvider(apiKey);

// Try different broad queries
const queries = [
  'logistics California',
  'shipping California', 
  '3PL California',
  'ocean freight California',
  'air freight California'
];

for (const query of queries) {
  console.log('\n=== Query:', query, '===');
  
  try {
    const result = await provider.executeSearchQuery({
      queryId: 'test-' + queries.indexOf(query),
      queryText: query,
      sourceCategory: 'SEARCH_RESULT',
      maximumResults: 50,
      budget: {
        timeoutMs: 15000,
        maxRetries: 0,
        maxOutputTokens: 2000,
      }
    });
    
    console.log('Sources returned:', result.value ? result.value.sources.length : 0);
    if (result.value && result.value.sources) {
      result.value.sources.forEach((source, i) => {
        console.log(` ${i + 1}. ${source.title?.slice(0, 60)}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}