import { describe, it, expect } from 'vitest';
import { y0Locations } from '../src/core/y0-locations.js';

describe('y0Locations', () => {
	it('contains all 13 residency locations', () => {
		expect(y0Locations).toHaveLength(13);
	});

	it('each location has required fields', () => {
		y0Locations.forEach(loc => {
			expect(loc).toHaveProperty('name');
			expect(loc).toHaveProperty('country');
			expect(loc).toHaveProperty('lat');
			expect(loc).toHaveProperty('lon');
			expect(loc).toHaveProperty('zoom');
			expect(typeof loc.lat).toBe('number');
			expect(typeof loc.lon).toBe('number');
			expect(loc.zoom).toBeGreaterThanOrEqual(10);
			expect(loc.zoom).toBeLessThanOrEqual(16);
		});
	});

	it('contains expected cities', () => {
		const names = y0Locations.map(l => l.name);
		expect(names).toContain('Stockholm');
		expect(names).toContain('Tokyo');
		expect(names).toContain('New York');
		expect(names).toContain('Bali');
		expect(names).toContain('Ithaca');
	});

	it('coordinates are within valid ranges', () => {
		y0Locations.forEach(loc => {
			expect(loc.lat).toBeGreaterThanOrEqual(-90);
			expect(loc.lat).toBeLessThanOrEqual(90);
			expect(loc.lon).toBeGreaterThanOrEqual(-180);
			expect(loc.lon).toBeLessThanOrEqual(180);
		});
	});
});
