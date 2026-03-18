/**
 * Vector Tile Renderer
 *
 * Fetches OpenFreeMap vector tiles (.pbf), parses them, and renders
 * water, parks, and roads directly on canvas with theme colors.
 * Replicates the MapLibre GL artistic style from the browser app.
 */

import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import axios from 'axios';

const TILE_SIZE = 4096; // vector tile extent
const PX = 256;         // pixels per tile on screen

/**
 * Render vector tiles onto a canvas context
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} theme - artistic theme with bg, water, parks, road_* colors
 * @param {object} ir - inner rect { x, y, w, h }
 * @param {number} zoom
 * @param {{ lat: number, lng: number }} center
 */
export async function renderVectorTiles(ctx, theme, ir, zoom, center) {
  const cx = lngToPixel(center.lng, zoom);
  const cy = latToPixel(center.lat, zoom);
  const topLeftPx = cx - ir.w / 2;
  const topLeftPy = cy - ir.h / 2;

  const sx = Math.floor(topLeftPx / PX);
  const sy = Math.floor(topLeftPy / PX);
  const ex = Math.floor((topLeftPx + ir.w - 1) / PX);
  const ey = Math.floor((topLeftPy + ir.h - 1) / PX);

  // Fill background with theme color
  ctx.fillStyle = theme.bg;
  ctx.fillRect(ir.x, ir.y, ir.w, ir.h);

  // Fetch all tiles concurrently
  const maxTile = Math.pow(2, zoom);
  const jobs = [];
  for (let tx = sx; tx <= ex; tx++) {
    for (let ty = sy; ty <= ey; ty++) {
      const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
      if (ty < 0 || ty >= maxTile) continue;
      jobs.push(
        fetchVectorTile(zoom, wrappedX, ty).then(vt => ({
          tx, ty, vt,
          offsetX: ir.x + (tx * PX - topLeftPx),
          offsetY: ir.y + (ty * PX - topLeftPy),
        }))
      );
    }
  }

  const tiles = await Promise.all(jobs);

  // Render each tile in layer order (matching browser style spec)
  for (const { vt, offsetX, offsetY } of tiles) {
    if (!vt) continue;
    const scale = PX / TILE_SIZE;

    // 1. Water fills
    renderFillLayer(ctx, vt, 'water', theme.water, offsetX, offsetY, scale);

    // 2. Park fills
    renderFillLayer(ctx, vt, 'park', theme.parks, offsetX, offsetY, scale);

    // 3. Roads (thin to thick, matching browser layer order)
    renderRoadLayer(ctx, vt, offsetX, offsetY, scale, theme);
  }
}

/** Render a fill layer (water, parks) */
function renderFillLayer(ctx, vt, layerName, color, ox, oy, scale) {
  const layer = vt.layers[layerName];
  if (!layer) return;

  ctx.fillStyle = color;
  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i);
    const geom = feature.loadGeometry();

    ctx.beginPath();
    for (const ring of geom) {
      for (let j = 0; j < ring.length; j++) {
        const x = ox + ring[j].x * scale;
        const y = oy + ring[j].y * scale;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill();
  }
}

/** Render all road types from the transportation layer */
function renderRoadLayer(ctx, vt, ox, oy, scale, theme) {
  const layer = vt.layers['transportation'];
  if (!layer) return;

  // Group features by road class for proper draw order
  const roadClasses = {
    default: [],
    residential: [],
    tertiary: [],
    secondary: [],
    primary: [],
    motorway: [],
  };

  const classifiedTypes = new Set(['motorway', 'primary', 'secondary', 'tertiary', 'residential']);

  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i);
    const cls = feature.properties.class || '';

    if (classifiedTypes.has(cls)) {
      roadClasses[cls].push(feature);
    } else {
      roadClasses.default.push(feature);
    }
  }

  // Draw in order: default, residential, tertiary, secondary, primary, motorway
  const drawOrder = [
    { key: 'default',     color: theme.road_default,     width: 0.5 },
    { key: 'residential', color: theme.road_residential,  width: 0.5 },
    { key: 'tertiary',    color: theme.road_tertiary,     width: 0.8 },
    { key: 'secondary',   color: theme.road_secondary,    width: 1.0 },
    { key: 'primary',     color: theme.road_primary,      width: 1.5 },
    { key: 'motorway',    color: theme.road_motorway,     width: 2.0 },
  ];

  for (const { key, color, width } of drawOrder) {
    const features = roadClasses[key];
    if (!features.length) continue;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const feature of features) {
      const geom = feature.loadGeometry();
      for (const line of geom) {
        ctx.beginPath();
        for (let j = 0; j < line.length; j++) {
          const x = ox + line[j].x * scale;
          const y = oy + line[j].y * scale;
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }
}

let _tileUrlTemplate = null;

/** Get the actual tile URL template from OpenFreeMap TileJSON */
async function getTileUrlTemplate() {
  if (_tileUrlTemplate) return _tileUrlTemplate;
  try {
    const resp = await axios.get('https://tiles.openfreemap.org/planet', {
      timeout: 10000,
      headers: { 'User-Agent': '4art-poster/2.0' },
    });
    _tileUrlTemplate = resp.data.tiles[0];
    return _tileUrlTemplate;
  } catch (e) {
    // Fallback pattern
    return 'https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf';
  }
}

/** Fetch a vector tile from OpenFreeMap */
async function fetchVectorTile(z, x, y) {
  const template = await getTileUrlTemplate();
  const url = template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  try {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: { 'User-Agent': '4art-poster/2.0' },
    });
    return new VectorTile(new Pbf(resp.data));
  } catch (e) {
    return null;
  }
}

function lngToPixel(lng, zoom) {
  return ((lng + 180) / 360) * Math.pow(2, zoom) * PX;
}

function latToPixel(lat, zoom) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, zoom) * PX;
}
