import { CANADA_BOUNDS, MAP_OPTIONS, TILE_OPTIONS, TILE_URL } from '../config/map.ts';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

export interface MapViewInfo {
  lat: number;
  lng: number;
  zoom: number;
}

/** Initialize a Canada-constrained map with visible-viewport tile loading. */
export function createMap(
  container: HTMLElement,
  { onViewChange }: { onViewChange?: (view: MapViewInfo) => void } = {}
) {
  const L = window.L;
  if (!L) throw new Error('Map library failed to load. Check your network connection.');

  const map = L.map(container, MAP_OPTIONS);
  L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);

  const resetView = () => {
    map.invalidateSize();
    map.fitBounds(CANADA_BOUNDS, { padding: [36, 36], maxZoom: 4, animate: false });
  };
  resetView();

  // Refit when layout dimensions change (including mobile orientation changes).
  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => map.invalidateSize())
      : null;
  resizeObserver?.observe(container);

  const publishView = () => {
    if (!onViewChange) return;
    const center = map.getCenter();
    onViewChange({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
  };

  map.on('moveend zoomend', publishView);
  publishView();

  return {
    map,
    zoomIn: () => map.zoomIn(),
    zoomOut: () => map.zoomOut(),
    resetView,
    destroy: () => {
      resizeObserver?.disconnect();
      map.off('moveend zoomend', publishView);
      map.remove();
    },
  };
}
