/** Canadian wildfire study area, June 1–7, 2023. */
export const INITIAL_VIEW = { center: [61, -97] as [number, number], zoom: 2 };

/** Viewport constraint: Canadian extent (not a coastline or national polygon mask). */
export const CANADA_BOUNDS: [[number, number], [number, number]] = [
  [41.5, -141.5],
  [84, -52],
];

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const MAP_OPTIONS = {
  minZoom: 1,
  maxZoom: 18,
  zoomSnap: 0.25,
  zoomDelta: 1,
  zoomControl: false,
  attributionControl: true,
  worldCopyJump: false,
  // Slight navigation margin prevents severe clipping on narrow screens.
  maxBounds: [
    [36, -155],
    [86, -45],
  ] as [[number, number], [number, number]],
  maxBoundsViscosity: 1,
  preferCanvas: true,
};

export const TILE_OPTIONS = {
  minZoom: 0,
  maxZoom: 18,
  tileSize: 256,
  keepBuffer: 1,
  updateWhenIdle: true,
  updateWhenZooming: false,
  detectRetina: false,
  crossOrigin: false,
  attribution: TILE_ATTRIBUTION,
};
