import { FourartJsonGenerator } from './4art-json-generator.js';
import fs from 'fs';

/**
 * Search for 4art artists by name
 * 
 * Options:
 * - query: search query (required)
 * - limit: max results (default 10)
 * - format: 'table' or 'json'
 * - verbose: detailed logging
 */
export async function search(options = {}) {
  const {
    query,
    limit = 10,
    format = 'table',
    verbose = false
  } = options;

  const log = (msg) => {
    if (verbose) console.log(`[4art-search] ${msg}`);
  };

  try {
    if (!query) {
      throw new Error('Search query is required');
    }

    log(`Searching for: "${query}"`);
    
    const geoIndexPath = '/Users/aletviegas/Documents/miny-directory-work/dist/geo-index.json';
    if (!fs.existsSync(geoIndexPath)) {
      throw new Error(`geo-index.json not found at ${geoIndexPath}`);
    }

    const geoIndexContent = fs.readFileSync(geoIndexPath, 'utf8');
    const geoIndex = JSON.parse(geoIndexContent);
    const artistEntities = Object.entries(geoIndex.entities || {});
    
    log(`Searching across ${artistEntities.length} artists...`);

    // Convert query to lowercase for fuzzy matching
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    // Score each artist based on name match
    const results = artistEntities
      .map(([id, data]) => {
        const nameLower = data.name.toLowerCase();
        const idLower = id.replace(/^artists-/, '').toLowerCase();
        
        let score = 0;

        // Exact match on full name
        if (nameLower === queryLower) {
          score += 100;
        }

        // Exact match on ID
        if (idLower === queryLower) {
          score += 95;
        }

        // Starts with query
        if (nameLower.startsWith(queryLower)) {
          score += 50;
        }

        // Query words found in name
        queryWords.forEach(word => {
          if (nameLower.includes(word)) {
            score += 20;
          }
        });

        // Name contains word that starts with query first letter
        if (queryLower.length > 0) {
          const firstLetter = queryLower[0];
          if (nameLower.match(new RegExp(`\\b${firstLetter}`))) {
            score += 5;
          }
        }

        return {
          id: id.replace(/^artists-/, ''),
          name: data.name,
          location: data.location,
          lat: data.lat,
          lng: data.lng,
          mentionScore: data.mentionScore,
          searchScore: score
        };
      })
      .filter(artist => artist.searchScore > 0)
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, limit);

    log(`Found ${results.length} matching artists`);

    // Format output
    if (format === 'table') {
      if (results.length === 0) {
        console.log(`\n❌ No artists found matching "${query}"\n`);
      } else {
        console.log(`\n🔍 Search Results for "${query}" (${results.length} found)\n`);
        console.log('ID'.padEnd(25) + 'Name'.padEnd(25) + 'Location'.padEnd(20) + 'Score');
        console.log('-'.repeat(95));
        
        results.forEach(artist => {
          const id = artist.id.substring(0, 24);
          const name = artist.name.substring(0, 24);
          const location = (artist.location || 'Unknown').substring(0, 19);
          const matchScore = artist.searchScore.toString().padStart(5);
          console.log(id.padEnd(25) + name.padEnd(25) + location.padEnd(20) + matchScore);
        });

        console.log(`\n💡 Tip: Use 'poster generate --artist <id>' to create a poster\n`);
      }
    } else if (format === 'json') {
      console.log(JSON.stringify(results, null, 2));
    }

    return {
      success: true,
      query,
      resultsCount: results.length,
      results
    };

  } catch (error) {
    console.error(`❌ Search failed: ${error.message}`);
    if (options.verbose) console.error(error.stack);
    process.exit(1);
  }
}

export default { search };
