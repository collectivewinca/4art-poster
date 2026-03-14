/**
 * Headless Renderer
 * Renders maps without browser DOM using jsdom and canvas
 */

import { JSDOM } from 'jsdom';
import L from 'leaflet';
import { createCanvas } from 'canvas';

export class HeadlessRenderer {
  constructor(options = {}) {
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.theme = options.theme || 'minimal-white';
    this.verbose = options.verbose || false;
  }

  log(msg) {
    if (this.verbose) console.log(`[HeadlessRenderer] ${msg}`);
  }

  /**
   * Create a virtual DOM environment
   */
  async createVirtualDOM() {
    this.log('Creating virtual DOM...');
    
    // Create JSDOM instance with a fake HTML structure
    const dom = new JSDOM(
      `<!DOCTYPE html>
       <html>
         <head>
           <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
         </head>
         <body>
           <div id="map" style="width: ${this.width}px; height: ${this.height}px;"></div>
         </body>
       </html>`,
      {
        url: 'http://localhost',
        pretendToBeVisual: true,
        resources: 'usable'
      }
    );

    return dom;
  }

  /**
   * Initialize Leaflet map in headless environment
   */
  async initializeMap(dom, centerLat, centerLng, zoom = 3) {
    this.log(`Initializing map at [${centerLat}, ${centerLng}], zoom ${zoom}`);
    
    const window = dom.window;
    const document = dom.window.document;

    // Create a canvas
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // Draw a simple background (tile layer simulation)
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, this.width, this.height);

    // Add a simple map grid/pattern
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Draw center marker
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Add text labels
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`Center: [${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}]`, 10, 20);
    ctx.fillText(`Zoom: ${zoom}`, 10, 40);

    return { canvas, ctx };
  }

  /**
   * Add markers to the map
   */
  async addMarkers(canvas, markers) {
    this.log(`Adding ${markers.length} markers...`);
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    markers.forEach((marker, idx) => {
      // Simple marker positioning (simulate lat/lng to pixel conversion)
      const x = (marker.lng + 180) * (width / 360);
      const y = (90 - marker.lat) * (height / 180);

      // Draw marker circle
      ctx.fillStyle = marker.color || '#f1c40f';
      ctx.beginPath();
      ctx.arc(x, y, marker.size || 6, 0, Math.PI * 2);
      ctx.fill();

      // Draw marker border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label if present
      if (marker.label) {
        ctx.fillStyle = '#333';
        ctx.font = 'bold 11px Arial';
        ctx.fillText(marker.label, x + 10, y - 5);
      }
    });

    return canvas;
  }

  /**
   * Add text overlay (artist info, title, etc.)
   */
  async addOverlay(canvas, overlay = {}) {
    this.log('Adding text overlay...');
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Draw semi-transparent background at bottom for text
    if (overlay.title || overlay.subtitle || overlay.artistName) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, height - 120, width, 120);

      // Title
      if (overlay.title) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(overlay.title, 20, height - 80);
      }

      // Subtitle
      if (overlay.subtitle) {
        ctx.fillStyle = '#aaa';
        ctx.font = '14px Arial';
        ctx.fillText(overlay.subtitle, 20, height - 50);
      }

      // Artist name
      if (overlay.artistName) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(`by ${overlay.artistName}`, 20, height - 25);
      }
    }

    return canvas;
  }

  /**
   * Render complete poster
   */
  async renderPoster(config) {
    this.log('Starting poster render...');

    const { centerLat, centerLng, zoom, markers, overlay } = config;

    try {
      // Create virtual DOM
      const dom = await this.createVirtualDOM();

      // Initialize map canvas
      const { canvas } = await this.initializeMap(dom, centerLat, centerLng, zoom);

      // Add markers
      await this.addMarkers(canvas, markers || []);

      // Add overlay
      await this.addOverlay(canvas, overlay);

      this.log('Render complete');
      return canvas;
    } catch (error) {
      console.error('Render error:', error);
      throw error;
    }
  }

  /**
   * Export canvas to PNG buffer
   */
  async exportPNG(canvas) {
    this.log('Exporting to PNG...');
    return canvas.toBuffer('image/png');
  }

  /**
   * Export canvas to PNG file
   */
  async exportToFile(canvas, filePath) {
    this.log(`Exporting to file: ${filePath}`);
    const fs = await import('fs/promises');
    const buffer = await this.exportPNG(canvas);
    await fs.writeFile(filePath, buffer);
    this.log(`✅ Saved to ${filePath}`);
    return filePath;
  }
}

export async function renderAndExport(config) {
  const renderer = new HeadlessRenderer(config.options);
  const canvas = await renderer.renderPoster({
    centerLat: config.centerLat || 0,
    centerLng: config.centerLng || 0,
    zoom: config.zoom || 3,
    markers: config.markers || [],
    overlay: config.overlay || {}
  });
  
  if (config.outputPath) {
    return await renderer.exportToFile(canvas, config.outputPath);
  }
  
  return await renderer.exportPNG(canvas);
}
