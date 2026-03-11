// Category-specific SVG markers for MINY Directory entities on the map
// Each icon is a 24x24 viewBox SVG using currentColor for theming

export const entityIcons = {
	artists: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15"/>
		<path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z"/>
	</svg>`,

	bands: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15"/>
		<path d="M16 3v10.55A3.5 3.5 0 1018 17V7h-2V3h-2zM8 5v10.55A3.5 3.5 0 1010 19V9h-2V5H6z" transform="translate(1,0)"/>
	</svg>`,

	venues: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15"/>
		<path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 008 8.94V23h2v-2.06A9 9 0 0021 12v-2h-2z" transform="scale(0.75) translate(4,4)"/>
	</svg>`,

	festivals: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15"/>
		<path d="M5 5l2 2 2-2 2 2 2-2 2 2 2-2v4a6 6 0 01-4 5.66V19H9v-2.34A6 6 0 015 11V5zm7 14a1 1 0 100 2 1 1 0 000-2z"/>
	</svg>`,

	labels: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15"/>
		<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
		<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1"/>
		<circle cx="12" cy="12" r="1.5"/>
	</svg>`,

	producers: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15"/>
		<path d="M4 6h2v12H4zm14 0h2v12h-2zM7 8h10v2H7zm0 6h10v2H7zm2-4h6v2H9z"/>
	</svg>`,

	music_orgs: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15"/>
		<path d="M12 3L4 9v12h16V9l-8-6zm0 2.5L18 10v9H6v-9l6-4.5zM11 13h2v5h-2z"/>
	</svg>`,

	media: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
		<circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15"/>
		<path d="M8 5v14l11-7L8 5z"/>
	</svg>`,
};

// Colors matching the nearby panel category badges
export const entityColors = {
	artists: '#7c3aed',
	bands: '#4f46e5',
	venues: '#dc2626',
	festivals: '#d97706',
	labels: '#059669',
	producers: '#0891b2',
	music_orgs: '#475569',
	media: '#e11d48',
};

export default entityIcons;
