import { FourartJsonGenerator } from './4art-json-generator.js';
import { CanvasMapRenderer } from './canvas-renderer.js';
import path from 'path';
import fs from 'fs';

/**
 * Generate a 4art poster from artist data
 * 
 * Options:
 * - artistId: 'artists-bruno-mars' or 'bruno-mars' (auto-converted)
 * - data: path to 4art JSON file (if provided, skips generator and uses this)
 * - output: output path for PNG
 * - width: canvas width (default 1200)
 * - height: canvas height (default 800)
 * - format: 'png' (default) or 'json' (output 4art JSON instead)
 * - verbose: detailed logging
 */
export async function generate(options = {}) {
  const {
    artistId,
    data,
    output = './poster.png',
    width = 1200,
    height = 800,
    format = 'png',
    verbose = false
  } = options;

  const log = (msg) => {
    if (verbose) console.log(`[4art-generator] ${msg}`);
  };

  try {
    log(`Starting 4art poster generation...`);
    log(`  Artist: ${artistId}`);
    log(`  Output: ${output}`);
    log(`  Format: ${format}`);
    log(`  Dimensions: ${width}x${height}`);

    let fourartJson;

    // Step 1: Get 4art JSON data
    if (data && fs.existsSync(data)) {
      log(`Loading 4art JSON from: ${data}`);
      const fileContent = fs.readFileSync(data, 'utf8');
      fourartJson = JSON.parse(fileContent);
    } else if (artistId) {
      log(`Generating 4art JSON for artist...`);
      
      // Auto-convert "bruno-mars" to "artists-bruno-mars" if needed
      let lookupId = artistId;
      if (!artistId.startsWith('artists-')) {
        lookupId = `artists-${artistId}`;
      }
      
      const generator = new FourartJsonGenerator({ verbose });
      fourartJson = await generator.generate(lookupId);
    } else {
      throw new Error('Either --artist or --data is required');
    }

    // If format is json, output the JSON and return
    if (format === 'json') {
      const jsonOutput = output || './artist-data.json';
      log(`Exporting JSON to: ${jsonOutput}`);
      
      // Ensure directory exists
      const dir = path.dirname(jsonOutput);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(jsonOutput, JSON.stringify(fourartJson, null, 2), 'utf8');
      console.log(`✅ 4art JSON exported to: ${jsonOutput}`);
      return { success: true, output: jsonOutput, format: 'json' };
    }

    // Step 2: Render poster
    log(`Initializing canvas renderer (${width}x${height})...`);
    const renderer = new CanvasMapRenderer({ width, height, verbose });
    
    log(`Setting map center and zoom...`);
    const center = fourartJson.mapConfig.initialCenter;
    const zoom = fourartJson.mapConfig.initialZoom;
    renderer.setCenter(center, zoom);
    
    // Add primary location marker (red)
    const primary = fourartJson.artist.primaryLocation;
    if (primary) {
      log(`Adding primary marker: ${primary.city} (${primary.lat}, ${primary.lng})`);
      renderer.addMarkers({
        lat: primary.lat,
        lng: primary.lng,
        title: `${fourartJson.artist.name} - Primary Location`,
        type: 'primary',
        color: fourartJson.mapConfig.markerTypes.primary.color
      });
    }

    // Add listener city markers (yellow)
    if (fourartJson.artist.listenerCities && fourartJson.artist.listenerCities.length > 0) {
      log(`Adding ${fourartJson.artist.listenerCities.length} listener city markers...`);
      const listenerMarkers = fourartJson.artist.listenerCities.map(city => ({
        lat: city.lat,
        lng: city.lng,
        title: `${city.city} (${city.listeners} listeners)`,
        type: 'listeners',
        color: fourartJson.mapConfig.markerTypes.listeners.color
      }));
      renderer.addMarkers(listenerMarkers);
    }

    // Add event markers (blue)
    if (fourartJson.artist.upcomingEvents && fourartJson.artist.upcomingEvents.length > 0) {
      log(`Adding ${fourartJson.artist.upcomingEvents.length} event markers...`);
      const eventMarkers = fourartJson.artist.upcomingEvents.map(event => ({
        lat: event.lat,
        lng: event.lng,
        title: `${event.name} (${event.date})`,
        type: 'events',
        color: fourartJson.mapConfig.markerTypes.events.color
      }));
      renderer.addMarkers(eventMarkers);
    }

    // Step 3: Render and export
    log(`Rendering final poster...`);
    await renderer.renderAndStore(fourartJson.artist.name);

    // Ensure output directory exists
    const outputDir = path.dirname(output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    log(`Exporting to PNG: ${output}`);
    await renderer.exportToFile(output);

    console.log(`✅ 4art poster generated successfully!`);
    console.log(`   Artist: ${fourartJson.artist.name}`);
    console.log(`   Primary: ${primary.city}, ${primary.state}`);
    console.log(`   Listeners: ${fourartJson.artist.listenerCities?.length || 0} cities`);
    console.log(`   Events: ${fourartJson.artist.upcomingEvents?.length || 0} upcoming`);
    console.log(`   Output: ${output}`);

    return {
      success: true,
      output,
      artist: fourartJson.artist.name,
      dimensions: `${width}x${height}`
    };

  } catch (error) {
    console.error(`❌ Failed to generate 4art poster: ${error.message}`);
    if (options.verbose) console.error(error.stack);
    process.exit(1);
  }
}

export default { generate };
