import { FourartJsonGenerator } from './4art-json-generator.js';
import fs from 'fs';
import path from 'path';

/**
 * List all 4art artists from geo-index
 * 
 * Options:
 * - format: 'table' (default), 'json', or 'csv'
 * - page: page number (for table format)
 * - perPage: items per page (default 10)
 * - verbose: detailed logging
 */
export async function list(options = {}) {
  const {
    format = 'table',
    page = 1,
    perPage = 10,
    verbose = false
  } = options;

  const log = (msg) => {
    if (verbose) console.log(`[4art-list] ${msg}`);
  };

  try {
    log(`Loading 4art artists...`);
    const generator = new FourartJsonGenerator({ verbose });
    
    // Load geo-index to get artist list
    const geoIndexPath = '/Users/aletviegas/Documents/miny-directory-work/dist/geo-index.json';
    if (!fs.existsSync(geoIndexPath)) {
      throw new Error(`geo-index.json not found at ${geoIndexPath}`);
    }

    const geoIndexContent = fs.readFileSync(geoIndexPath, 'utf8');
    const geoIndex = JSON.parse(geoIndexContent);
    const artistEntities = Object.entries(geoIndex.entities || {});
    
    log(`Found ${artistEntities.length} artists in geo-index`);

    // Convert to array of artists with ID and name
    const artists = artistEntities.map(([id, data]) => ({
      id: id.replace(/^artists-/, ''),
      name: data.name,
      location: data.location,
      lat: data.lat,
      lng: data.lng,
      mentionScore: data.mentionScore,
      category: data.category
    }));

    // Sort by mention score descending
    artists.sort((a, b) => (b.mentionScore || 0) - (a.mentionScore || 0));

    // Handle pagination for table format
    let display = artists;
    if (format === 'table') {
      const totalPages = Math.ceil(artists.length / perPage);
      const start = (page - 1) * perPage;
      const end = start + perPage;
      display = artists.slice(start, end);
      
      log(`Showing page ${page} of ${totalPages} (${perPage} per page)`);
    }

    // Format output
    if (format === 'table') {
      console.log(`\n📍 4art Artists (${artists.length} total)\n`);
      console.log('ID'.padEnd(25) + 'Name'.padEnd(25) + 'Location'.padEnd(20) + 'Score');
      console.log('-'.repeat(95));
      
      display.forEach(artist => {
        const id = artist.id.substring(0, 24);
        const name = artist.name.substring(0, 24);
        const location = (artist.location || 'Unknown').substring(0, 19);
        const score = (artist.mentionScore || 0).toString().padStart(5);
        console.log(id.padEnd(25) + name.padEnd(25) + location.padEnd(20) + score);
      });

      const totalPages = Math.ceil(artists.length / perPage);
      if (totalPages > 1) {
        console.log(`\n📄 Page ${page} of ${totalPages} | Use --page <n> to view other pages`);
      }
      console.log(`\n💡 Tip: Use 'poster search <name>' to find specific artists\n`);

    } else if (format === 'json') {
      console.log(JSON.stringify(display, null, 2));

    } else if (format === 'csv') {
      console.log('id,name,location,lat,lng,mentionScore,category');
      display.forEach(artist => {
        const name = `"${artist.name.replace(/"/g, '""')}"`;
        const location = `"${(artist.location || '').replace(/"/g, '""')}"`;
        console.log(`${artist.id},${name},${location},${artist.lat},${artist.lng},${artist.mentionScore},${artist.category}`);
      });
    }

    return {
      success: true,
      total: artists.length,
      returned: display.length,
      format
    };

  } catch (error) {
    console.error(`❌ Failed to list 4art artists: ${error.message}`);
    if (options.verbose) console.error(error.stack);
    process.exit(1);
  }
}

export default { list };
