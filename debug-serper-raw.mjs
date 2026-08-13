import { SerperSearchProvider } from './src/infrastructure/yie/ai/serper-search-provider.js';

const apiKey = 'a8217029eda7ed9a6d4fbdbdd7fb9e526f14c7f9';
const provider = new SerperSearchProvider(apiKey);

const query = 'freight forwarders California';

try {
  console.log('Running Serper search for raw count...');
  
  // Use maximumResults=50 to see how many Serper returns
  const result = await provider.executeSearchQuery({
    queryId: 'raw-1',
    queryText: query,
    sourceCategory: 'SEARCH_RESULT',
    maximumResults: 50,  // Ask for 50 to see raw count
    budget: {
      timeoutMs: 15000,
      maxRetries: 0,
      maxOutputTokens: 2000,
    }
  });
  
  console.log('\n--- RAW SERPER RESPONSE ANALYSIS ---');
  console.log('Requested maximumResults: 50');
  console.log('Actual sources returned:', result.value ? result.value.sources.length : 'N/A');
  console.log('groundingSourcesReceived:', result.value ? result.value.groundingSourcesReceived : 'N/A');
  console.log('modelEmittedUrlsReceived:', result.value ? result.value.modelEmittedUrlsReceived : 'N/A');
  
  if (result.value && result.value.sources) {
    console.log('\nAll 50 sources:');
    result.value.sources.forEach((source, i) => {
      console.log(` ${i + 1}. ${source.title?.slice(0, 60)}...`);
      console.log(`    URL: ${source.url}`);
    });
  }
  
  // Also log the metadata
  console.log('\n--- METADATA ---');
  console.log('Provider:', result.metadata?.provider);
  console.log('Model:', result.metadata?.model);
  console.log('Operation:', result.metadata?.operation);
  console.log('Grounding used:', result.metadata?.groundingUsed);
  
} catch (error) {
  console.error('\n--- ERROR ---');
  console.error('Error message:', error.message);
}