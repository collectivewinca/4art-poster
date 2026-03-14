import { FourartJsonGenerator } from './4art-json-generator.js';

/**
 * Get detailed info for a specific 4art artist
 * 
 * Options:
 * - artistId: artist ID to fetch info for (required)
 * - format: 'table' or 'json'
 * - verbose: detailed logging
 */
export async function info(options = {}) {
  const {
    artistId,
    format = 'table',
    verbose = false
  } = options;

  const log = (msg) => {
    if (verbose) console.log(`[4art-info] ${msg}`);
  };

  try {
    if (!artistId) {
      throw new Error('Artist ID is required');
    }

    log(`Fetching info for: ${artistId}`);
    
    // Auto-convert "bruno-mars" to "artists-bruno-mars" if needed
    let lookupId = artistId;
    if (!artistId.startsWith('artists-')) {
      lookupId = `artists-${artistId}`;
    }

    const generator = new FourartJsonGenerator({ verbose });
    const fourartJson = await generator.generate(lookupId);
    
    const artist = fourartJson.artist;
    const primary = artist.primaryLocation;

    if (format === 'table') {
      console.log(`\n👤 ${artist.name}\n`);
      
      if (artist.image) {
        console.log(`Image: ${artist.image}`);
      }

      if (artist.genres && artist.genres.length > 0) {
        console.log(`Genres: ${artist.genres.join(', ')}`);
      }

      if (artist.followers > 0) {
        console.log(`Followers: ${artist.followers.toLocaleString()}`);
      }

      console.log('\n📍 Primary Location:');
      console.log(`   ${primary.city}, ${primary.state}`);
      console.log(`   Coordinates: ${primary.lat.toFixed(4)}, ${primary.lng.toFixed(4)}`);
      console.log(`   Mention Score: ${primary.mentionScore}`);

      if (artist.listenerCities && artist.listenerCities.length > 0) {
        console.log(`\n🎧 Top Listener Cities (${artist.listenerCities.length}):`);
        artist.listenerCities.slice(0, 10).forEach((city, idx) => {
          console.log(`   ${idx + 1}. ${city.city} - ${city.listeners || 'N/A'} listeners`);
        });
        if (artist.listenerCities.length > 10) {
          console.log(`   ... and ${artist.listenerCities.length - 10} more`);
        }
      }

      if (artist.upcomingEvents && artist.upcomingEvents.length > 0) {
        console.log(`\n📅 Upcoming Events (${artist.upcomingEvents.length}):`);
        artist.upcomingEvents.slice(0, 5).forEach((event, idx) => {
          console.log(`   ${idx + 1}. ${event.name}`);
          console.log(`      ${event.date} - ${event.location}`);
        });
        if (artist.upcomingEvents.length > 5) {
          console.log(`   ... and ${artist.upcomingEvents.length - 5} more`);
        }
      }

      console.log(`\n⏰ Generated: ${new Date(fourartJson.metadata.generatedAt).toLocaleString()}`);
      console.log(`📚 Sources: ${fourartJson.metadata.sources.join(', ')}\n`);

    } else if (format === 'json') {
      console.log(JSON.stringify(fourartJson, null, 2));
    }

    return {
      success: true,
      artistId,
      artistName: artist.name,
      format
    };

  } catch (error) {
    console.error(`❌ Failed to get artist info: ${error.message}`);
    if (options.verbose) console.error(error.stack);
    process.exit(1);
  }
}

export default { info };
