/**
 * Canvas-based Map Poster Renderer (Tile-based)
 *
 * Produces posters matching the browser MapToPoster app aesthetic:
 * - Real map tiles at street-level zoom
 * - Mat/passepartout border
 * - Vignette edge fade
 * - Typographic overlay (city, divider, country, coordinates)
 * - Themed marker rendering
 * - Route line rendering
 */

import { createCanvas, loadImage } from 'canvas';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { renderVectorTiles } from './vector-renderer.js';

const TILE_SIZE = 256;

const TILE_STYLES = {
  voyager: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  dark: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  light: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};

export class CanvasMapRenderer {
  constructor(options = {}) {
    this.width = options.width || 1200;
    this.height = options.height || 800;
    this.verbose = options.verbose || false;
    this.tileStyle = options.tileStyle || 'voyager';
    this.tileUrl = TILE_STYLES[this.tileStyle] || TILE_STYLES.voyager;
    this.markers = [];
    this.routes = [];
    this.center = { lat: 0, lng: 0 };
    this.zoom = options.zoom || 12;
    this.tileCache = new Map();

    // Mat / passepartout
    const minDim = Math.min(this.width, this.height);
    this.matWidth = options.matWidth ?? Math.round(minDim * 0.05);
    this.matColor = options.matColor || '#ffffff';
    this.matBorderColor = options.matBorderColor || null;
    this.matBorderWidth = options.matBorderWidth || 1;
    this.matBorderOpacity = options.matBorderOpacity ?? 0.5;

    // Vignette
    this.vignetteEnabled = options.vignetteEnabled !== false;
    this.vignetteColor = options.vignetteColor || this.matColor;

    // Theme tint overlay (raster mode)
    this.themeOverlay = options.themeOverlay || null; // { color, opacity }

    // Vector rendering (uses OpenFreeMap + theme colors for roads/water/parks)
    this.useVector = options.useVector || false;
    this.artisticTheme = options.artisticTheme || null; // full theme object

    // Text styling
    this.textColor = options.textColor || (this._isDark(this.matColor) ? '#ffffff' : '#1a1a1a');
    this.dividerColor = options.dividerColor || this.textColor;

    // Poster text data (set externally before render)
    this.posterData = options.posterData || {};
    // { city, country, lat, lng }
  }

  log(msg) {
    if (this.verbose) console.log(`[Renderer] ${msg}`);
  }

  setCenter(center, zoom) {
    this.center = center;
    if (zoom != null) this.zoom = zoom;
    this.log(`Center: ${center.lat}, ${center.lng} (zoom: ${this.zoom})`);
  }

  /** Auto-fit center and zoom to show all markers with padding */
  fitToMarkers(padding = 0.15) {
    if (this.markers.length === 0) return;
    if (this.markers.length === 1) {
      this.center = { lat: this.markers[0].lat, lng: this.markers[0].lng };
      return; // keep current zoom for single marker
    }

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const m of this.markers) {
      if (m.lat < minLat) minLat = m.lat;
      if (m.lat > maxLat) maxLat = m.lat;
      if (m.lng < minLng) minLng = m.lng;
      if (m.lng > maxLng) maxLng = m.lng;
    }

    // Center on the midpoint of all markers
    this.center = {
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2,
    };

    // Add padding
    const latSpan = (maxLat - minLat) * (1 + padding * 2);
    const lngSpan = (maxLng - minLng) * (1 + padding * 2);

    // Calculate zoom to fit
    const ir = this.innerRect;
    for (let z = 8; z >= 1; z--) {
      const worldPx = Math.pow(2, z) * 256;
      const latPx = (this.latToPixel(minLat, z) - this.latToPixel(maxLat, z));
      const lngPx = (lngSpan / 360) * worldPx;
      if (lngPx <= ir.w * 0.85 && latPx <= ir.h * 0.65) {
        this.zoom = z;
        break;
      }
    }

    this.log(`Auto-fit: center ${this.center.lat.toFixed(2)}, ${this.center.lng.toFixed(2)}, zoom ${this.zoom}`);
  }

  addMarkers(markers) {
    if (!Array.isArray(markers)) markers = [markers];
    this.markers.push(...markers);
  }

  addRoutes(routes) {
    if (!Array.isArray(routes)) routes = [routes];
    this.routes.push(...routes);
  }

  // ─── Coordinate math ────────────────────────────────────────

  /** Inner map rect (inside mat) */
  get innerRect() {
    const m = this.matWidth;
    return { x: m, y: m, w: this.width - 2 * m, h: this.height - 2 * m };
  }

  lngToPixel(lng, zoom) {
    return ((lng + 180) / 360) * Math.pow(2, zoom) * TILE_SIZE;
  }

  latToPixel(lat, zoom) {
    const r = (lat * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, zoom) * TILE_SIZE;
  }

  /** Project lat/lng → canvas pixel (relative to inner map rect) */
  projectPoint(lat, lng) {
    const ir = this.innerRect;
    const gx = this.lngToPixel(lng, this.zoom);
    const gy = this.latToPixel(lat, this.zoom);
    const cx = this.lngToPixel(this.center.lng, this.zoom);
    const cy = this.latToPixel(this.center.lat, this.zoom);
    return {
      x: ir.x + ir.w / 2 + (gx - cx),
      y: ir.y + ir.h / 2 + (gy - cy),
    };
  }

  // ─── Tile fetching ──────────────────────────────────────────

  async fetchTile(z, x, y) {
    const max = Math.pow(2, z);
    x = ((x % max) + max) % max;
    if (y < 0 || y >= max) return null;

    const key = `${this.tileStyle}/${z}/${x}/${y}`;
    if (this.tileCache.has(key)) return this.tileCache.get(key);

    const url = this.tileUrl.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    try {
      const r = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: { 'User-Agent': '4art-poster/2.0' },
      });
      const img = await loadImage(Buffer.from(r.data));
      this.tileCache.set(key, img);
      return img;
    } catch (e) {
      this.log(`Tile fail ${z}/${x}/${y}: ${e.message}`);
      return null;
    }
  }

  // ─── Main render pipeline ───────────────────────────────────

  async render(artistName = '') {
    this.log(`Rendering ${this.width}x${this.height} poster (zoom ${this.zoom}, style ${this.tileStyle})...`);

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    const ir = this.innerRect;

    // 1. Fill with mat color
    ctx.fillStyle = this.matColor;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Draw map inside inner rect
    ctx.save();
    ctx.beginPath();
    ctx.rect(ir.x, ir.y, ir.w, ir.h);
    ctx.clip();

    if (this.useVector && this.artisticTheme) {
      // Vector rendering: parse .pbf tiles, draw water/parks/roads with theme colors
      await renderVectorTiles(ctx, this.artisticTheme, ir, this.zoom, this.center);
    } else {
      // Raster rendering: fetch pre-rendered tiles
      await this._drawTiles(ctx, ir);
      if (this.themeOverlay) {
        ctx.fillStyle = this._hexToRgba(this.themeOverlay.color, this.themeOverlay.opacity);
        ctx.fillRect(ir.x, ir.y, ir.w, ir.h);
      }
    }

    // 4. Vignette
    if (this.vignetteEnabled) {
      this._drawVignette(ctx, ir);
    }

    // 5. Subtle lat/lng grid
    this._drawGridLines(ctx, ir);

    // 6. Routes (arcs from primary to listener cities)
    this._drawRoutes(ctx);

    // 7. Markers with labels
    this._drawMarkers(ctx);

    ctx.restore(); // unclip

    // 8. Mat inner border line
    if (this.matBorderColor || this.matWidth > 0) {
      this._drawMatBorder(ctx, ir);
    }

    // 9. Artist name (top-right)
    this._drawArtistName(ctx, ir, artistName);

    // 10. Typography overlay (city, country, coords)
    this._drawTypography(ctx, ir, artistName);

    // 11. Legend (bottom-left, compact)
    if (this.markers.length > 1) {
      this._drawLegend(ctx, ir);
    }

    // 12. Attribution
    this._drawAttribution(ctx, ir);

    this.log('Render complete');
    return canvas;
  }

  // ─── Tile drawing ───────────────────────────────────────────

  async _drawTiles(ctx, ir) {
    const cx = this.lngToPixel(this.center.lng, this.zoom);
    const cy = this.latToPixel(this.center.lat, this.zoom);
    const topLeftPx = cx - ir.w / 2;
    const topLeftPy = cy - ir.h / 2;

    const sx = Math.floor(topLeftPx / TILE_SIZE);
    const sy = Math.floor(topLeftPy / TILE_SIZE);
    const ex = Math.floor((topLeftPx + ir.w - 1) / TILE_SIZE);
    const ey = Math.floor((topLeftPy + ir.h - 1) / TILE_SIZE);

    const total = (ex - sx + 1) * (ey - sy + 1);
    this.log(`Fetching ${total} tiles...`);

    const jobs = [];
    for (let tx = sx; tx <= ex; tx++) {
      for (let ty = sy; ty <= ey; ty++) {
        jobs.push(this.fetchTile(this.zoom, tx, ty).then(img => ({ tx, ty, img })));
      }
    }
    const tiles = await Promise.all(jobs);

    // Fallback bg
    ctx.fillStyle = this._isDark(this.matColor) ? '#1a1a2e' : '#d4dadc';
    ctx.fillRect(ir.x, ir.y, ir.w, ir.h);

    let drawn = 0;
    for (const { tx, ty, img } of tiles) {
      if (!img) continue;
      const dx = ir.x + (tx * TILE_SIZE - topLeftPx);
      const dy = ir.y + (ty * TILE_SIZE - topLeftPy);
      ctx.drawImage(img, dx, dy, TILE_SIZE, TILE_SIZE);
      drawn++;
    }
    this.log(`Drew ${drawn}/${total} tiles`);
  }

  // ─── Vignette ───────────────────────────────────────────────

  _drawVignette(ctx, ir) {
    const color = this.vignetteColor;
    const fadeH = ir.h * 0.22;
    const fadeW = ir.w * 0.12;

    // Top fade (solid 3% then fade to 20%)
    const top = ctx.createLinearGradient(0, ir.y, 0, ir.y + fadeH);
    top.addColorStop(0, this._hexToRgba(color, 1));
    top.addColorStop(0.15, this._hexToRgba(color, 0.9));
    top.addColorStop(1, this._hexToRgba(color, 0));
    ctx.fillStyle = top;
    ctx.fillRect(ir.x, ir.y, ir.w, fadeH);

    // Bottom fade (stronger — text sits here)
    const bot = ctx.createLinearGradient(0, ir.y + ir.h - fadeH * 1.4, 0, ir.y + ir.h);
    bot.addColorStop(0, this._hexToRgba(color, 0));
    bot.addColorStop(0.5, this._hexToRgba(color, 0.6));
    bot.addColorStop(0.85, this._hexToRgba(color, 0.95));
    bot.addColorStop(1, this._hexToRgba(color, 1));
    ctx.fillStyle = bot;
    ctx.fillRect(ir.x, ir.y + ir.h - fadeH * 1.4, ir.w, fadeH * 1.4);

    // Left fade
    const left = ctx.createLinearGradient(ir.x, 0, ir.x + fadeW, 0);
    left.addColorStop(0, this._hexToRgba(color, 0.7));
    left.addColorStop(1, this._hexToRgba(color, 0));
    ctx.fillStyle = left;
    ctx.fillRect(ir.x, ir.y, fadeW, ir.h);

    // Right fade
    const right = ctx.createLinearGradient(ir.x + ir.w - fadeW, 0, ir.x + ir.w, 0);
    right.addColorStop(0, this._hexToRgba(color, 0));
    right.addColorStop(1, this._hexToRgba(color, 0.7));
    ctx.fillStyle = right;
    ctx.fillRect(ir.x + ir.w - fadeW, ir.y, fadeW, ir.h);
  }

  // ─── Mat border ─────────────────────────────────────────────

  _drawMatBorder(ctx, ir) {
    const borderColor = this.matBorderColor || this.textColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = this.matBorderWidth;
    ctx.globalAlpha = this.matBorderOpacity;
    ctx.strokeRect(ir.x + 0.5, ir.y + 0.5, ir.w - 1, ir.h - 1);
    ctx.globalAlpha = 1;
  }

  // ─── Typography overlay ─────────────────────────────────────

  _drawTypography(ctx, ir, artistName) {
    const pd = this.posterData;
    const city = (pd.city || artistName || '').toUpperCase();
    const country = (pd.country || pd.state || '').toUpperCase();
    const coords = this._formatCoords(pd.lat, pd.lng);

    if (!city) return;

    const textCol = this.textColor;
    const centerX = ir.x + ir.w / 2;

    // Scale font sizes relative to inner height
    const scale = ir.h / 800;
    const citySize = Math.round(62 * scale);
    const countrySize = Math.round(17 * scale);
    const coordsSize = Math.round(15 * scale);
    const dividerW = Math.round(110 * scale);
    const cityTracking = citySize * 0.25;
    const subTracking = countrySize * 0.4;

    // Position: center text block at ~82% of inner height
    const baseY = ir.y + ir.h * 0.78;

    // City name
    ctx.fillStyle = textCol;
    ctx.font = `bold ${citySize}px Georgia, "Playfair Display", serif`;
    this._drawTrackedText(ctx, city, centerX, baseY, cityTracking);

    // Divider line
    const divY = baseY + Math.round(18 * scale);
    ctx.strokeStyle = textCol;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(centerX - dividerW / 2, divY);
    ctx.lineTo(centerX + dividerW / 2, divY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Country
    if (country) {
      const countryY = divY + Math.round(24 * scale);
      ctx.fillStyle = textCol;
      ctx.font = `bold ${countrySize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      this._drawTrackedText(ctx, country, centerX, countryY, subTracking);

      // Coordinates
      if (coords) {
        const coordsY = countryY + Math.round(22 * scale);
        ctx.fillStyle = textCol;
        ctx.globalAlpha = 0.7;
        ctx.font = `${coordsSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        this._drawTrackedText(ctx, coords, centerX, coordsY, coordsSize * 0.35);
        ctx.globalAlpha = 1;
      }
    } else if (coords) {
      // Coords directly after divider if no country
      const coordsY = divY + Math.round(24 * scale);
      ctx.fillStyle = textCol;
      ctx.globalAlpha = 0.7;
      ctx.font = `${coordsSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      this._drawTrackedText(ctx, coords, centerX, coordsY, coordsSize * 0.35);
      ctx.globalAlpha = 1;
    }
  }

  /** Draw text with manual letter-spacing, centered at x */
  _drawTrackedText(ctx, text, centerX, y, tracking) {
    const chars = text.split('');
    let totalW = 0;
    for (const ch of chars) {
      totalW += ctx.measureText(ch).width + tracking;
    }
    totalW -= tracking; // no trailing tracking

    let x = centerX - totalW / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (const ch of chars) {
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + tracking;
    }
  }

  _formatCoords(lat, lng) {
    if (lat == null || lng == null) return '';
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}\u00b0 ${latDir},  ${Math.abs(lng).toFixed(4)}\u00b0 ${lngDir}`;
  }

  // ─── Attribution ────────────────────────────────────────────

  _drawAttribution(ctx, ir) {
    ctx.textBaseline = 'bottom';
    const y = ir.y + ir.h - 6;

    // OSM attribution (right)
    ctx.fillStyle = this.textColor;
    ctx.globalAlpha = 0.2;
    ctx.font = '8px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('\u00a9 OpenStreetMap contributors', ir.x + ir.w - 8, y);

    // MINY shortlink (right, above attribution)
    const minyLink = this.posterData.minyLink;
    if (minyLink) {
      ctx.globalAlpha = 0.45;
      ctx.font = 'bold 9px "Helvetica Neue", Helvetica, Arial, sans-serif';
      ctx.fillText(minyLink, ir.x + ir.w - 8, y - 14);
    }

    ctx.globalAlpha = 1;
  }

  // ─── Routes (curved arcs from primary to listener cities) ──

  _drawRoutes(ctx) {
    // Auto-generate routes from primary to listeners if none explicit
    let routes = this.routes;
    if (routes.length === 0) {
      const primary = this.markers.find(m => m.type === 'primary');
      const listeners = this.markers.filter(m => m.type === 'listeners');
      if (primary && listeners.length) {
        routes = listeners.map(l => ({
          start: { lat: primary.lat, lng: primary.lng },
          end: { lat: l.lat, lng: l.lng },
          color: l.color || primary.color,
        }));
      }
    }

    for (const route of routes) {
      const from = this.projectPoint(route.start.lat, route.start.lng);
      const to = this.projectPoint(route.end.lat, route.end.lng);
      const color = route.color || this.textColor;

      // Curved arc
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 - dist * 0.18;

      // Soft glow
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(midX, midY, to.x, to.y);
      ctx.stroke();

      // Dashed arc
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(midX, midY, to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  // ─── Markers with labels and scaled sizing ────────────────

  _drawMarkers(ctx) {
    const ir = this.innerRect;
    const sorted = [...this.markers].sort((a, b) => {
      if (a.type === 'primary') return 1;
      if (b.type === 'primary') return -1;
      return 0;
    });

    const maxL = Math.max(1, ...this.markers.map(m => m.listeners || 0));

    for (const marker of sorted) {
      const pos = this.projectPoint(marker.lat, marker.lng);
      if (pos.x < ir.x - 30 || pos.x > ir.x + ir.w + 30 ||
          pos.y < ir.y - 30 || pos.y > ir.y + ir.h + 30) continue;

      const color = marker.color || '#e74c3c';
      let size = marker.type === 'primary' ? 10
        : marker.type === 'listeners' && marker.listeners ? 4 + (marker.listeners / maxL) * 5
        : 5;

      // Outer glow (primary)
      if (marker.type === 'primary') {
        ctx.fillStyle = this._hexToRgba(color, 0.12);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size + 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(pos.x + 1, pos.y + 1, size, 0, Math.PI * 2);
      ctx.fill();

      // Fill
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // City label for listener markers
      if (marker.type === 'listeners' && marker.title) {
        ctx.font = '9px "Helvetica Neue", Helvetica, Arial, sans-serif';
        ctx.fillStyle = this.textColor;
        ctx.globalAlpha = 0.65;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(marker.title, pos.x + size + 4, pos.y + 1);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ─── Grid lines ─────────────────────────────────────────

  _drawGridLines(ctx, ir) {
    const textCol = this.textColor;
    ctx.strokeStyle = textCol;
    ctx.globalAlpha = 0.06;
    ctx.lineWidth = 0.5;

    // Draw latitude lines every 10 degrees
    for (let lat = -80; lat <= 80; lat += 10) {
      const p = this.projectPoint(lat, this.center.lng);
      if (p.y >= ir.y && p.y <= ir.y + ir.h) {
        ctx.beginPath();
        ctx.moveTo(ir.x, p.y);
        ctx.lineTo(ir.x + ir.w, p.y);
        ctx.stroke();
      }
    }

    // Draw longitude lines every 15 degrees
    for (let lng = -180; lng <= 180; lng += 15) {
      const p = this.projectPoint(this.center.lat, lng);
      if (p.x >= ir.x && p.x <= ir.x + ir.w) {
        ctx.beginPath();
        ctx.moveTo(p.x, ir.y);
        ctx.lineTo(p.x, ir.y + ir.h);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ─── Artist name (top-right) ───────────────────────────

  _drawArtistName(ctx, ir, artistName) {
    if (!artistName) return;
    const m = this.matWidth;
    ctx.fillStyle = this.textColor;
    ctx.globalAlpha = 0.6;
    ctx.font = `bold 11px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    // Draw with tracked spacing
    const text = artistName.toUpperCase();
    const tracking = 3;
    let totalW = 0;
    for (const ch of text) totalW += ctx.measureText(ch).width + tracking;
    totalW -= tracking;

    let x = ir.x + ir.w - 12;
    const y = ir.y + 14;
    // Right-align: start from right
    x = ir.x + ir.w - 12;
    ctx.textAlign = 'left';
    let startX = x - totalW;
    for (const ch of text) {
      ctx.fillText(ch, startX, y);
      startX += ctx.measureText(ch).width + tracking;
    }
    ctx.globalAlpha = 1;
  }

  // ─── Legend (compact, bottom-left) ─────────────────────

  _drawLegend(ctx, ir) {
    const m = this.matWidth;
    const x = ir.x + 14;
    const y = ir.y + ir.h - 14;
    const textCol = this.textColor;
    const dark = this._isDark(this.matColor);

    // Count actual marker types present
    const types = new Set(this.markers.map(m => m.type));
    const items = [];
    if (types.has('primary')) items.push({ type: 'primary', label: 'Origin' });
    if (types.has('listeners')) items.push({ type: 'listeners', label: 'Top Cities' });
    if (types.has('events')) items.push({ type: 'events', label: 'Events' });

    if (items.length < 2) return;

    const itemH = 14;
    const totalH = items.length * itemH + 8;
    const boxW = 90;
    const boxY = y - totalH;

    // Glass background
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    const r = 6;
    ctx.moveTo(x + r, boxY);
    ctx.lineTo(x + boxW - r, boxY);
    ctx.quadraticCurveTo(x + boxW, boxY, x + boxW, boxY + r);
    ctx.lineTo(x + boxW, boxY + totalH - r);
    ctx.quadraticCurveTo(x + boxW, boxY + totalH, x + boxW - r, boxY + totalH);
    ctx.lineTo(x + r, boxY + totalH);
    ctx.quadraticCurveTo(x, boxY + totalH, x, boxY + totalH - r);
    ctx.lineTo(x, boxY + r);
    ctx.quadraticCurveTo(x, boxY, x + r, boxY);
    ctx.fill();

    // Items
    let iy = boxY + 12;
    for (const item of items) {
      // Find a marker of this type to get its color
      const sample = this.markers.find(m => m.type === item.type);
      const color = sample?.color || textCol;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 12, iy, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = textCol;
      ctx.globalAlpha = 0.7;
      ctx.font = '9px "Helvetica Neue", Helvetica, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, x + 22, iy + 0.5);
      ctx.globalAlpha = 1;
      iy += itemH;
    }
  }

  // ─── Utilities ──────────────────────────────────────────────

  _hexToRgba(hex, alpha) {
    if (!hex || hex.length < 7) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  _isDark(hex) {
    if (!hex || hex.length < 7) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }

  // ─── Export ─────────────────────────────────────────────────

  async exportToFile(filepath) {
    if (!this.canvas) throw new Error('Call render() first');
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filepath, this.canvas.toBuffer('image/png'));
    this.log(`Exported: ${filepath}`);
  }

  async toBuffer() {
    if (!this.canvas) throw new Error('Call render() first');
    return this.canvas.toBuffer('image/png');
  }

  async renderAndStore(artistName) {
    this.canvas = await this.render(artistName);
    return this.canvas;
  }
}

export default CanvasMapRenderer;
