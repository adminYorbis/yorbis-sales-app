import { SerperSearchProvider } from './src/infrastructure/yie/ai/serper-search-provider.js';

const apiKey = 'a8217029eda7ed9a6d4fbdbdd7fb9e526f14c7f9';
const provider = new SerperSearchProvider(apiKey);

// Broader query - remove employee count restriction
const query = 'freight forwarders California logistics supply chain';

try {
  console.log('Running Serper search for broader results...');
  console.log('Query:', query);
  
  // Use maximumResults: 50 to see how many Serper returns
  const result = await provider.executeSearchQuery({
    queryId: 'broad-1',
    queryText: query,
    sourceCategory: 'SEARCH_RESULT',
    maximumResults: 50,  // Ask for 50
    budget: {
      timeoutMs: 15000,
      maxRetries: 0,
      maxOutputTokens: 2000,
    }
  });
  
  console.log('\n--- BROADER SEARCH RESULTS ---');
  console.log('Requested maximumResults: 50');
  console.log('Actual sources returned:', result.value ? result.value.sources.length : 'N/A');
  console.log('groundingSourcesReceived:', result.value ? result.value.groundingSourcesReceived : 'N/A');
  
  if (result.value && result.value.sources) {
    console.log('\nAll sources (up to 50):');
    result.value.sources.forEach((source, i) => {
      const urlDisplay = source.url.length > 80 ? source.url.substring(0, 80) + '...' : source.url;
      console.log(` ${i + 1}. ${source.title?.slice(0, 50)}`);
      console.log(`    URL: ${urlDisplay}`);
      console.log(`    Snippet: ${source.snippet?.slice(0, 150)}`);
      console.log();
    });
  }
  
  console.log('\n--- SUMMARY ---');
  console.log('Total sources returned by Serper:', result.value ? result.value.sources.length : 0);
  console.log('Query:', query);
  
} catch (error) {
  console.error('\n--- ERROR ---');
  console.error('Error message:', error.message);
}