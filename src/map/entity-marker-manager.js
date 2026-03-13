import L from 'leaflet';
import { state, updateState, getSelectedTheme, getSelectedArtisticTheme } from '../core/state.js';
import { entityIcons, entityColors } from '../core/entity-icons.js';
import { hexToRgba } from '../core/utils.js';
import { getMap, getArtisticMap, loadMapLibreModule } from './map-init.js';

let leafletMarkers = [];
let artisticMarkers = [];
let artisticRenderVersion = 0;

const svgParser = new DOMParser();
const CATEGORY_ORDER = ['artists', 'bands', 'venues', 'festivals', 'labels', 'producers', 'music_orgs', 'media'];
const CATEGORY_LABELS = {
	artists: 'Artists',
	bands: 'Bands',
	venues: 'Venues',
	festivals: 'Festivals',
	labels: 'Labels',
	producers: 'Producers',
	music_orgs: 'Music Orgs',
	media: 'Media'
};

function parseSvg(svgString) {
	const doc = svgParser.parseFromString(svgString, 'image/svg+xml');
	return doc.documentElement;
}

export function clearEntityMarkers() {
	leafletMarkers.forEach(m => m.remove());
	artisticMarkers.forEach(m => m.remove());
	leafletMarkers = [];
	artisticMarkers = [];
}

export function addEntityMarker(entity) {
	const existing = state.entityMarkers.find(m => m.id === entity.id);
	if (existing) {
		updateState({
			entityMarkers: state.entityMarkers.filter(m => m.id !== entity.id)
		});
	} else {
		updateState({
			entityMarkers: [...state.entityMarkers, {
				id: entity.id,
				name: entity.name,
				category: entity.category,
				lat: entity.lat,
				lon: entity.lng || entity.lon,
			}]
		});
	}
}

export function isEntityPinned(entityId) {
	return state.entityMarkers.some(m => m.id === entityId);
}

function createMarkerElement(category, size) {
	const color = entityColors[category] || '#475569';
	const iconSvg = entityIcons[category] || entityIcons.artists;

	const wrapper = document.createElement('div');
	wrapper.style.cssText = `width:${size}px;height:${size}px;color:${color};filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));`;

	const svg = parseSvg(iconSvg);
	svg.setAttribute('width', String(size));
	svg.setAttribute('height', String(size));
	wrapper.appendChild(svg);

	return wrapper;
}

function createMarkerWithLabel(entity, currentState, size) {
	const color = entityColors[entity.category] || '#475569';
	const isArtistic = currentState.renderMode === 'artistic';
	const activeTheme = isArtistic ? getSelectedArtisticTheme() : getSelectedTheme();
	const text = activeTheme.text || activeTheme.textColor || '#0f172a';
	const background = activeTheme.bg || activeTheme.background || '#ffffff';
	const wrapper = document.createElement('div');
	wrapper.dataset.entityMarker = entity.id || entity.name || '';

	wrapper.style.cssText = [
		'display:flex',
		'align-items:center',
		`gap:${Math.max(4, size * 0.18)}px`,
		'pointer-events:none'
	].join(';');

	const iconEl = createMarkerElement(entity.category, size);
	iconEl.style.flex = '0 0 auto';
	wrapper.appendChild(iconEl);

	if (entity.name) {
		const label = document.createElement('div');
		label.dataset.entityLabel = entity.id || entity.name || '';
		label.textContent = entity.name;
		label.style.cssText = [
			`max-width:${Math.max(96, size * 4.8)}px`,
			`padding:${Math.max(2, size * 0.1)}px ${Math.max(6, size * 0.22)}px`,
			`border-radius:${999}px`,
			`background:${isArtistic ? hexToRgba(background, 0.72) : hexToRgba('#ffffff', 0.86)}`,
			`border:1px solid ${hexToRgba(text, isArtistic ? 0.18 : 0.12)}`,
			`box-shadow:${isArtistic ? '0 8px 20px rgba(2, 6, 23, 0.24)' : '0 4px 14px rgba(15, 23, 42, 0.1)'}`,
			`color:${text}`,
			`font-size:${Math.max(9, size * 0.34)}px`,
			'font-weight:700',
			'line-height:1.2',
			'letter-spacing:0.02em',
			'white-space:nowrap',
			'overflow:hidden',
			'text-overflow:ellipsis',
			'backdrop-filter:blur(8px)',
			'-webkit-backdrop-filter:blur(8px)',
			'pointer-events:none'
		].join(';');
		wrapper.appendChild(label);
	}

	return wrapper;
}

function rectsOverlap(a, b, padding = 6) {
	return !(
		a.right + padding < b.left ||
		a.left - padding > b.right ||
		a.bottom + padding < b.top ||
		a.top - padding > b.bottom
	);
}

function applyEntityLabelCollisions() {
	const labels = Array.from(document.querySelectorAll('[data-entity-label]'));
	if (!labels.length) return;

	labels.forEach((label) => {
		label.style.opacity = '1';
		label.style.visibility = 'visible';
	});

	const occupied = [];
	labels
		.sort((a, b) => {
			const ra = a.getBoundingClientRect();
			const rb = b.getBoundingClientRect();
			if (Math.abs(ra.top - rb.top) > 1) return ra.top - rb.top;
			return ra.left - rb.left;
		})
		.forEach((label) => {
			const rect = label.getBoundingClientRect();
			if (!rect.width || !rect.height) return;

			const overlaps = occupied.some((existing) => rectsOverlap(rect, existing));
			if (overlaps) {
				label.style.opacity = '0';
				label.style.visibility = 'hidden';
				return;
			}

			occupied.push(rect);
		});
}

function scheduleEntityLabelCollisions() {
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			applyEntityLabelCollisions();
		});
	});
}

function createLegendIcon(category, size, tint) {
	const iconWrap = document.createElement('div');
	iconWrap.style.cssText = `width:${size}px;height:${size}px;color:${tint};display:flex;align-items:center;justify-content:center;flex:0 0 auto;`;
	const svg = parseSvg(entityIcons[category] || entityIcons.artists);
	svg.setAttribute('width', String(size));
	svg.setAttribute('height', String(size));
	iconWrap.appendChild(svg);
	return iconWrap;
}

function getLegendPalette(currentState) {
	const isArtistic = currentState.renderMode === 'artistic';
	const activeTheme = isArtistic ? getSelectedArtisticTheme() : getSelectedTheme();
	const background = activeTheme.bg || activeTheme.background || '#ffffff';
	const text = activeTheme.text || activeTheme.textColor || '#0f172a';
	const panelBg = isArtistic
		? hexToRgba(background, 0.84)
		: (activeTheme.overlayBg || hexToRgba(background, 0.88));

	return {
		text,
		mutedText: hexToRgba(text, isArtistic ? 0.72 : 0.62),
		panelBg,
		panelEdge: hexToRgba(text, isArtistic ? 0.18 : 0.12),
		panelInset: hexToRgba(text, isArtistic ? 0.08 : 0.05),
		hairline: hexToRgba(text, isArtistic ? 0.14 : 0.1),
		shadow: isArtistic
			? '0 22px 60px rgba(2, 6, 23, 0.34)'
			: '0 18px 45px rgba(15, 23, 42, 0.16)'
	};
}

function buildLegendGroups(entities) {
	const grouped = new Map();
	entities.forEach((entity) => {
		const category = entity.category || 'artists';
		if (!grouped.has(category)) {
			grouped.set(category, { category, count: 0, names: [] });
		}
		const entry = grouped.get(category);
		entry.count += 1;
		if (entity.name) entry.names.push(entity.name);
	});

	return Array.from(grouped.values())
		.sort((a, b) => {
			const orderA = CATEGORY_ORDER.indexOf(a.category);
			const orderB = CATEGORY_ORDER.indexOf(b.category);
			if (orderA !== -1 || orderB !== -1) return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
			return a.category.localeCompare(b.category);
		});
}

export function updateEntityMarkers(currentState) {
	const map = getMap();
	const artisticMap = getArtisticMap();
	if (!map) return;
	const renderVersion = ++artisticRenderVersion;

	clearEntityMarkers();

	if (!currentState.showEntityMarkers) return;
	const entities = currentState.entityMarkers || [];
	if (!entities.length) return;

	const size = 28;

	entities.forEach((em, index) => {
		const el = createMarkerWithLabel(em, currentState, size);

		const icon = L.divIcon({
			className: 'entity-marker',
			html: el.outerHTML,
			iconSize: [Math.max(128, size * 5), Math.max(32, size * 1.5)],
			iconAnchor: [size / 2, size / 2],
		});

		const marker = L.marker([em.lat, em.lon], { icon, draggable: true }).addTo(map);

		marker.on('dragend', () => {
			const pos = marker.getLatLng();
			const updated = [...currentState.entityMarkers];
			updated[index] = { ...updated[index], lat: pos.lat, lon: pos.lng };
			updateState({ entityMarkers: updated });
		});

		leafletMarkers.push(marker);

		if (artisticMap) {
			loadMapLibreModule().then(mod => {
				if (renderVersion !== artisticRenderVersion) return;
				const mgl = mod.default || mod;
				const aEl = createMarkerWithLabel(em, currentState, size);

				const aMarker = new mgl.Marker({ element: aEl, anchor: 'left', draggable: true, offset: [size / 2, 0] })
					.setLngLat([em.lon, em.lat])
					.addTo(artisticMap);
				if (renderVersion !== artisticRenderVersion) {
					aMarker.remove();
					return;
				}

				aMarker.on('dragend', () => {
					const pos = aMarker.getLngLat();
					const updated = [...currentState.entityMarkers];
					updated[index] = { ...updated[index], lat: pos.lat, lon: pos.lng };
					updateState({ entityMarkers: updated });
				});

				artisticMarkers.push(aMarker);
				scheduleEntityLabelCollisions();
			});
		}
	});

	updateLegend(currentState);
	scheduleEntityLabelCollisions();
}

export function updateEntityLegend(currentState) {
	updateLegend(currentState);
}

function updateLegend(currentState) {
	const container = document.getElementById('poster-container');
	if (!container) return;

	let legend = document.getElementById('entity-legend');
	if (legend) legend.remove();
}
