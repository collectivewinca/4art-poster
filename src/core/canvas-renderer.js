/**
 * Canvas-based Map Renderer
 * Renders simple map visualizations without DOM dependencies
 * Suitable for headless poster generation
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

export class CanvasMapRenderer {
  constructor(options = {}) {
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.verbose = options.verbose || false;
    this.markers = [];
    this.center = { lat: 0, lng: 0 };
    this.zoom = 4;
  }

  log(msg) {
    if (this.verbose) console.log(`[CanvasMapRenderer] ${msg}`);
  }

  /**
   * Set map center and zoom level
   */
  setCenter(center, zoom = 4) {
    this.center = center;
    this.zoom = zoom;
    this.log(`Map center: ${center.lat}, ${center.lng} (zoom: ${zoom})`);
  }

  /**
   * Add markers to the map
   */
  addMarkers(markers) {
    if (!Array.isArray(markers)) {
      markers = [markers];
    }
    this.markers.push(...markers);
    this.log(`Added ${markers.length} markers (total: ${this.markers.length})`);
  }

  /**
   * Simple mercator projection for coordinates
   */
  projectPoint(lat, lng) {
    const latRad = (lat * Math.PI) / 180;
    const x = ((lng + 180) / 360) * this.width;
    const y = ((Math.PI - Math.log(Math.tan(Math.PI / 4 + latRad / 2))) / Math.PI / 2) * this.height;
    return { x, y };
  }

  /**
   * Render the map to canvas
   */
  async render(artistName = 'Artist Map') {
    this.log(`Rendering map canvas (${this.width}x${this.height})...`);

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw simple grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    const gridSize = 100;
    for (let x = 0; x < this.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Draw markers
    this.markers.forEach(marker => {
      const pos = this.projectPoint(marker.lat, marker.lng);
      
      // Determine marker style by type
      let color = marker.color || '#e74c3c';
      let size = 12;
      
      if (marker.type === 'primary') {
        size = 16;
      } else if (marker.type === 'listeners') {
        size = 10;
      } else if (marker.type === 'events') {
        size = 8;
      }

      // Draw marker circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fill();

      // Draw marker border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw marker label
      if (marker.type === 'primary' || this.markers.length <= 5) {
        ctx.fillStyle = '#333333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(marker.title?.substring(0, 20) || marker.type, pos.x, pos.y + size + 18);
      }

      this.log(`Marker: ${marker.title} (${marker.lat}, ${marker.lng})`);
    });

    // Draw title and metadata
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(artistName, 40, 50);

    ctx.fillStyle = '#666666';
    ctx.font = '14px Arial';
    ctx.fillText(`${this.markers.length} locations • Generated with 4art`, 40, 80);

    // Draw center marker
    const centerPos = this.projectPoint(this.center.lat, this.center.lng);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerPos.x - 20, centerPos.y);
    ctx.lineTo(centerPos.x + 20, centerPos.y);
    ctx.moveTo(centerPos.x, centerPos.y - 20);
    ctx.lineTo(centerPos.x, centerPos.y + 20);
    ctx.stroke();

    this.log(`✅ Map rendering complete`);
    return canvas;
  }

  /**
   * Export canvas to PNG file
   */
  async exportToFile(filepath) {
    if (!this.canvas) {
      throw new Error('No rendered canvas. Call render() first.');
    }

    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = this.canvas.toBuffer('image/png');
    fs.writeFileSync(filepath, buffer);
    this.log(`✅ Exported to: ${filepath}`);
  }

  /**
   * Export canvas to buffer
   */
  async toBuffer() {
    if (!this.canvas) {
      throw new Error('No rendered canvas. Call render() first.');
    }
    return this.canvas.toBuffer('image/png');
  }

  /**
   * Render and store canvas
   */
  async renderAndStore(artistName) {
    this.canvas = await this.render(artistName);
    return this.canvas;
  }
}

export default CanvasMapRenderer;
