/**
 * 4art JSON Generator
 * Orchestrates data from miny-directory + RapidConnect + Firebase
 */

import fs from 'fs/promises';

export class FourartJsonGenerator {
  constructor(options = {}) {
    this.geoIndexPath = options.geoIndexPath || '/Users/aletviegas/Documents/miny-directory-work/dist/geo-index.json';
    this.verbose = options.verbose || false;
    this.cache = new Map();
  }

  log(msg) {
    if (this.verbose) console.log(`[4artGenerator] ${msg}`);
  }

  /**
   * Load geo-index.json
   */
  async loadGeoIndex() {
    this.log('Loading geo-index.json...');
    try {
      const data = await fs.readFile(this.geoIndexPath, 'utf8');
      const index = JSON.parse(data);
      this.log(`Loaded ${index.total} total artists (${Object.keys(index.entities).length} entities)`);
      return index;
    } catch (error) {
      console.error(`❌ Failed to load geo-index: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get artist from geo-index by ID or name prefix
   */
  async getArtistPrimary(artistId) {
    this.log(`Looking up artist: ${artistId}`);
    
    if (!this.geoIndex) {
      this.geoIndex = await this.loadGeoIndex();
    }

    // Handle both 'artists-bruno-mars' and 'bruno-mars' formats
    let fullId = artistId;
    if (!artistId.startsWith('artists-')) {
      fullId = `artists-${artistId}`;
    }

    const artist = this.geoIndex.entities[fullId];
    if (!artist) {
      // Try finding by name fuzzy match
      const artistName = artistId.replace(/-/g, ' ').toLowerCase();
      const foundKey = Object.keys(this.geoIndex.entities).find(key =>
        this.geoIndex.entities[key].name.toLowerCase().includes(artistName)
      );
      
      if (!foundKey) {
        throw new Error(`Artist not found: ${artistId}`);
      }
      
      return this.buildArtistData(foundKey, this.geoIndex.entities[foundKey]);
    }

    return this.buildArtistData(fullId, artist);
  }

  /**
   * Build artist data object
   */
  buildArtistData(id, entity) {
    const location = entity.location || '';
    const [city, state] = location.split(',').map(s => s.trim());

    return {
      id: id.replace('artists-', ''),
      name: entity.name || 'Unknown Artist',
      image: entity.image || '',
      genres: entity.genres || [],
      spotifyId: entity.spotifyId || '',
      instagramHandle: entity.instagramHandle || '',
      followers: entity.followers || 0,
      bio: entity.bio || '',
      primaryLocation: {
        city: city || 'Unknown',
        state: state || '',
        country: entity.country || '',
        lat: entity.lat || 0,
        lng: entity.lng || 0,
        mentionScore: entity.mentionScore || 0
      }
    };
  }

  /**
   * Build unified 4art JSON
   */
  async build4artJson(artistId, options = {}) {
    this.log(`Building 4art JSON for ${artistId}...`);

    // Get primary artist data
    const artist = await this.getArtistPrimary(artistId);

    // TODO: Fetch from RapidConnect API (Phase 2b)
    const listenerCities = options.listenerCities || [];

    // TODO: Fetch from Firebase (Phase 2)
    const upcomingEvents = options.upcomingEvents || [];

    const json = {
      artist: {
        id: artist.id,
        name: artist.name,
        bio: artist.bio,
        image: artist.image,
        genres: artist.genres,
        spotifyId: artist.spotifyId,
        instagramHandle: artist.instagramHandle,
        followers: artist.followers,
        primaryLocation: artist.primaryLocation,
        listenerCities,
        upcomingEvents
      },
      mapConfig: {
        initialCenter: {
          lat: artist.primaryLocation.lat,
          lng: artist.primaryLocation.lng
        },
        initialZoom: 3,
        markerTypes: {
          primary: { color: '#e74c3c', icon: 'home', size: 'large' },
          listeners: { color: '#f1c40f', icon: 'music', size: 'medium' },
          events: { color: '#3498db', icon: 'calendar', size: 'small' }
        }
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        sources: ['miny-directory', 'rapidconnect-api', 'firebase'],
        artistMentionScore: artist.primaryLocation.mentionScore
      }
    };

    this.log('✅ 4art JSON built successfully');
    return json;
  }

  /**
   * Generate and cache
   */
  async generate(artistId, options = {}) {
    const cacheKey = `4art:${artistId}`;
    
    if (this.cache.has(cacheKey) && !options.noCache) {
      this.log(`Using cached JSON for ${artistId}`);
      return this.cache.get(cacheKey);
    }

    const json = await this.build4artJson(artistId, options);
    this.cache.set(cacheKey, json);
    
    return json;
  }

  /**
   * Load from JSON file
   */
  async loadFromFile(filePath) {
    this.log(`Loading JSON from file: ${filePath}`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const json = JSON.parse(data);
      this.log('✅ JSON loaded');
      return json;
    } catch (error) {
      console.error(`❌ Failed to load JSON: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save to file
   */
  async saveToFile(json, filePath) {
    this.log(`Saving JSON to: ${filePath}`);
    try {
      await fs.writeFile(filePath, JSON.stringify(json, null, 2));
      this.log(`✅ Saved to ${filePath}`);
      return filePath;
    } catch (error) {
      console.error(`❌ Failed to save: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton-like function for CLI
export async function generate4artJson(artistId, options = {}) {
  const generator = new FourartJsonGenerator(options);
  return await generator.generate(artistId, options);
}

export async function load4artJson(filePath) {
  const generator = new FourartJsonGenerator();
  return await generator.loadFromFile(filePath);
}
