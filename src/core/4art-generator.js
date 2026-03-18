import { FourartJsonGenerator } from './4art-json-generator.js';
import { CanvasMapRenderer } from './canvas-renderer.js';
import path from 'path';
import fs from 'fs';

/**
 * Generate a 4art poster from artist data
 *
 * Options:
 * - artistId: 'artists-bruno-mars' or 'bruno-mars'
 * - data: path to 4art JSON file (skips generator)
 * - output: output path for PNG
 * - width/height: canvas dimensions (default 1200x800)
 * - zoom: map zoom level (default 12)
 * - format: 'png' or 'json'
 * - verbose: detailed logging
 */
export async function generate(options = {}) {
  const {
    artistId,
    data,
    output = './poster.png',
    width = 1200,
    height = 800,
    zoom,
    format = 'png',
    verbose = false,
  } = options;

  const log = (msg) => { if (verbose) console.log(`[4art] ${msg}`); };

  try {
    log(`Generating poster for ${artistId}...`);

    let fourartJson;

    // Step 1: Get 4art JSON data
    if (data && fs.existsSync(data)) {
      log(`Loading JSON from: ${data}`);
      fourartJson = JSON.parse(fs.readFileSync(data, 'utf8'));
    } else if (artistId) {
      let lookupId = artistId;
      if (!artistId.startsWith('artists-')) lookupId = `artists-${artistId}`;
      const generator = new FourartJsonGenerator({ verbose });
      fourartJson = await generator.generate(lookupId);
    } else {
      throw new Error('Either --artist or --data is required');
    }

    // JSON export
    if (format === 'json') {
      const dir = path.dirname(output);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(output, JSON.stringify(fourartJson, null, 2), 'utf8');
      console.log(`JSON exported to: ${output}`);
      return { success: true, output, format: 'json' };
    }

    // Step 2: Set up renderer
    const primary = fourartJson.artist.primaryLocation;
    const mapZoom = zoom || fourartJson.mapConfig.initialZoom;

    const renderer = new CanvasMapRenderer({
      width,
      height,
      zoom: mapZoom,
      tileStyle: 'voyager',
      verbose,
      matColor: '#ffffff',
      vignetteColor: '#ffffff',
      textColor: '#1a1a1a',
      matBorderColor: '#888888',
      posterData: {
        city: primary.city,
        country: primary.state || primary.country || '',
        lat: primary.lat,
        lng: primary.lng,
      },
    });

    renderer.setCenter(fourartJson.mapConfig.initialCenter, mapZoom);

    // Primary marker
    if (primary && primary.lat && primary.lng) {
      renderer.addMarkers({
        lat: primary.lat,
        lng: primary.lng,
        title: fourartJson.artist.name,
        type: 'primary',
        color: fourartJson.mapConfig.markerTypes.primary.color,
      });
    }

    // Listener cities
    if (fourartJson.artist.listenerCities?.length) {
      renderer.addMarkers(fourartJson.artist.listenerCities.map(c => ({
        lat: c.lat, lng: c.lng,
        title: c.city,
        type: 'listeners',
        color: fourartJson.mapConfig.markerTypes.listeners.color,
        listeners: c.listeners || 0,
      })));
    }

    // Events
    if (fourartJson.artist.upcomingEvents?.length) {
      renderer.addMarkers(fourartJson.artist.upcomingEvents.map(e => ({
        lat: e.lat, lng: e.lng,
        title: e.name,
        type: 'events',
        color: fourartJson.mapConfig.markerTypes.events.color,
      })));
    }

    // MINY shortlink (from EPK data or fallback)
    renderer.posterData.minyLink = fourartJson.artist.shortlink || `go.minyvinyl.com/${fourartJson.artist.id}`;

    // Auto-fit zoom/center if multiple markers
    if (renderer.markers.length > 1) {
      renderer.fitToMarkers();
    }

    // Step 3: Render and export
    await renderer.renderAndStore(fourartJson.artist.name);

    const outputDir = path.dirname(output);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    await renderer.exportToFile(output);

    console.log(`4art poster generated!`);
    console.log(`   Artist: ${fourartJson.artist.name}`);
    console.log(`   Location: ${primary.city}, ${primary.state}`);
    console.log(`   Zoom: ${mapZoom}`);
    console.log(`   Output: ${output}`);

    return { success: true, output, artist: fourartJson.artist.name, dimensions: `${width}x${height}` };
  } catch (error) {
    console.error(`Failed: ${error.message}`);
    if (verbose) console.error(error.stack);
    process.exit(1);
  }
}

export default { generate };
