import { SerperSearchProvider } from './src/infrastructure/yie/ai/serper-search-provider.js';

const apiKey = 'a8217029eda7ed9a6d4fbdbdd7fb9e526f14c7f9';
const provider = new SerperSearchProvider(apiKey);

const queries = [
  'logistics California',
  'shipping California', 
  '3PL California',
  'ocean freight California',
  'air freight California'
];

// Track all sources by URL for deduplication
const seenUrls = new Set();
const allProspects = [];

for (const query of queries) {
  console.log(`\n=== Query: ${query} ===`);
  
  try {
    const result = await provider.executeSearchQuery({
      queryId: 'dedup-' + queries.indexOf(query),
      queryText: query,
      sourceCategory: 'SEARCH_RESULT',
      maximumResults: 50,
      budget: {
        timeoutMs: 15000,
        maxRetries: 0,
        maxOutputTokens: 2000,
      }
    });
    
    if (result.value && result.value.sources) {
      result.value.sources.forEach((source, i) => {
        const url = source.url;
        const title = source.title || 'No title';
        
        // Dedup by URL
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          allProspects.push({
            rank: allProspects.length + 1,
            title: title,
            url: url,
            snippet: source.snippet || '',
            query: query
          });
          console.log(`  NEW: ${title.slice(0, 50)}...`);
        } else {
          console.log(`  DUPLICATE: ${title.slice(0, 50)}...`);
        }
      });
    }
    
  } catch (error) {
    console.error(`Error on "${query}":`, error.message);
  }
}

console.log('\n\n===========================');
console.log('UNIQUE PROSPECTS TOTAL:', allProspects.length);
console.log('===========================\n');

// Display all unique prospects
allProspects.forEach((p, i) => {
  console.log(`${i + 1}. [${p.query.slice(0, 20)}] ${p.title}`);
  console(`   URL: ${p.url}`);
  console(`   Snippet: ${p.snippet?.slice(0, 100)}...`);
  console();
});