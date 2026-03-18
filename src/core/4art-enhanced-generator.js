/**
 * 4art Enhanced Generator
 *
 * Produces posters matching the original MapToPoster browser aesthetic:
 * - Street-level map tiles with theme-appropriate style
 * - Mat/passepartout with theme colors
 * - Vignette edge fade
 * - Typography overlay (city, country, coordinates)
 * - Route visualization
 * - Legend
 */

import fs from 'fs';
import { artisticThemes } from './artistic-themes.js';
import { FourartJsonGenerator } from './4art-json-generator.js';
import { CanvasMapRenderer } from './canvas-renderer.js';

export class EnhancedFourartGenerator {
  constructor(options = {}) {
    this.options = {
      width: options.width || 1200,
      height: options.height || 800,
      zoom: options.zoom || null,
      theme: options.theme || 'cyber_noir',
      format: options.format || 'png',
      showLegend: options.showLegend !== false,
      showRoutes: options.showRoutes || false,
      includeVenues: options.includeVenues || false,
      includeEvents: options.includeEvents || false,
      verbose: options.verbose || false,
    };

    this.jsonGenerator = new FourartJsonGenerator({ verbose: this.options.verbose });
    this.theme = artisticThemes[this.options.theme] || artisticThemes.cyber_noir;
  }

  async generate(artistId) {
    console.log(`\n  Generating enhanced poster for ${artistId}`);
    console.log(`   Theme: ${this.theme.name}`);

    try {
      const fourartJson = await this.jsonGenerator.generate(artistId);

      if (this.options.showRoutes) this._addRouteGeometry(fourartJson);

      const canvas = await this._renderWithTheme(fourartJson);

      const result = await this._exportInFormat(canvas, fourartJson);

      console.log(`   Size: ${this.options.width}x${this.options.height}`);
      console.log(`   Theme: ${this.theme.name}`);
      console.log(`   Markers: ${this._countMarkers(fourartJson)}`);

      return result;
    } catch (error) {
      console.error(`   Error: ${error.message}`);
      throw error;
    }
  }

  /** Pick tile style based on theme brightness */
  _getThemeTileStyle() {
    const bg = this.theme.bg;
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128 ? 'dark' : 'voyager';
  }

  async _renderWithTheme(fourartJson) {
    const tileStyle = this._getThemeTileStyle();
    const primary = fourartJson.artist.primaryLocation;
    const mapZoom = this.options.zoom || fourartJson.mapConfig.initialZoom;

    const renderer = new CanvasMapRenderer({
      width: this.options.width,
      height: this.options.height,
      zoom: mapZoom,
      tileStyle,
      verbose: this.options.verbose,

      // Vector rendering with artistic theme colors
      useVector: true,
      artisticTheme: this.theme,

      // Mat matches theme background
      matColor: this.theme.bg,
      vignetteColor: this.theme.bg,
      matBorderColor: this.theme.text,
      matBorderOpacity: 0.4,

      // Text in theme colors
      textColor: this.theme.text,

      // Poster overlay data
      posterData: {
        city: primary.city,
        country: primary.state || primary.country || '',
        lat: primary.lat,
        lng: primary.lng,
      },
    });

    renderer.setCenter(fourartJson.mapConfig.initialCenter, mapZoom);

    // MINY shortlink (from EPK data or fallback)
    renderer.posterData.minyLink = fourartJson.artist.shortlink || `go.minyvinyl.com/${fourartJson.artist.id}`;

    // Primary marker
    if (primary && primary.lat && primary.lng) {
      renderer.addMarkers({
        lat: primary.lat,
        lng: primary.lng,
        title: fourartJson.artist.name,
        type: 'primary',
        color: this.theme.route,
      });
    }

    // Listener cities (with listener count for scaled sizing)
    if (fourartJson.artist.listenerCities?.length) {
      renderer.addMarkers(fourartJson.artist.listenerCities.map(c => ({
        lat: c.lat, lng: c.lng, title: c.city,
        type: 'listeners', color: this.theme.road_motorway,
        listeners: c.listeners || 0,
      })));
    }

    // Events
    if (fourartJson.artist.upcomingEvents?.length) {
      renderer.addMarkers(fourartJson.artist.upcomingEvents.map(e => ({
        lat: e.lat, lng: e.lng, title: e.name,
        type: 'events', color: this.theme.water,
      })));
    }

    // Routes
    if (fourartJson.mapConfig.routes?.length) {
      renderer.addRoutes(fourartJson.mapConfig.routes.map(r => ({
        start: { lat: r.start.lat, lng: r.start.lng },
        end: { lat: r.end.lat, lng: r.end.lng },
        color: this.theme.route,
        strength: r.strength || 1,
      })));
    }

    // Auto-fit zoom/center to show all markers
    if (renderer.markers.length > 1) {
      renderer.fitToMarkers();
    }

    const canvas = await renderer.renderAndStore(fourartJson.artist.name);
    return canvas;
  }

  _addRouteGeometry(fourartJson) {
    const routes = [];
    if (fourartJson.artist.primaryLocation && fourartJson.artist.listenerCities?.length) {
      for (const city of fourartJson.artist.listenerCities.slice(0, 3)) {
        routes.push({
          start: fourartJson.artist.primaryLocation,
          end: city,
          strength: city.listeners ? city.listeners / 1000 : 1,
        });
      }
    }
    fourartJson.mapConfig.routes = routes;
  }

  _addLegend(canvas) {
    const ctx = canvas.getContext('2d');
    const lw = 160, lh = 115;
    const lx = this.options.width - lw - this._matWidth() - 12;
    const ly = this._matWidth() + 12;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = this.theme.text;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;
    ctx.strokeRect(lx, ly, lw, lh);
    ctx.globalAlpha = 1;

    ctx.fillStyle = this.theme.text;
    ctx.font = 'bold 10px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LEGEND', lx + 10, ly + 18);

    const items = [
      { color: this.theme.route, label: 'Primary' },
      { color: this.theme.road_motorway, label: 'Listeners' },
      { color: this.theme.water, label: 'Events' },
      { color: this.theme.parks, label: 'Venues' },
    ];

    let y = ly + 36;
    for (const item of items) {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(lx + 15, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = this.theme.text;
      ctx.globalAlpha = 0.8;
      ctx.font = '10px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(item.label, lx + 28, y + 3.5);
      ctx.globalAlpha = 1;
      y += 19;
    }
  }

  _matWidth() {
    return Math.round(Math.min(this.options.width, this.options.height) * 0.05);
  }

  async _exportInFormat(canvas, fourartJson) {
    if (this.options.format === 'json') return JSON.stringify(fourartJson, null, 2);
    return canvas.toBuffer('image/png');
  }

  _countMarkers(fourartJson) {
    let c = 1;
    if (fourartJson.artist.listenerCities) c += fourartJson.artist.listenerCities.length;
    if (fourartJson.artist.upcomingEvents) c += fourartJson.artist.upcomingEvents.length;
    return c;
  }

  static getAvailableThemes() {
    return Object.entries(artisticThemes).map(([id, t]) => ({
      id, name: t.name, description: t.description,
    }));
  }

  saveConfig(filename) {
    fs.writeFileSync(filename, JSON.stringify({
      theme: this.options.theme, format: this.options.format,
      width: this.options.width, height: this.options.height,
      showLegend: this.options.showLegend, showRoutes: this.options.showRoutes,
    }, null, 2));
  }

  static async loadConfig(filename) {
    return new EnhancedFourartGenerator(JSON.parse(fs.readFileSync(filename, 'utf8')));
  }
}

export default EnhancedFourartGenerator;
