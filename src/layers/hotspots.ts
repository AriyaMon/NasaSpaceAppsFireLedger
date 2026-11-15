import type { HotspotRecord } from '../config/dates.ts';

/** Processed hotspots: longitude, latitude and radius_km are the only used fields. */
export function parseHotspotCsv(text: string): HotspotRecord[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const header =
    lines
      .shift()
      ?.trim()
      .split(',')
      .map((value) => value.trim()) || [];
  const fields = ['longitude', 'latitude', 'radius_km'];
  const positions = fields.map((field) => header.indexOf(field));
  if (positions.includes(-1)) {
    throw new Error('Hotspot CSV must include longitude, latitude, radius_km');
  }
  const records: HotspotRecord[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const columns = lines[i].split(',');
    const [longitude, latitude, radius_km] = positions.map((index) => Number(columns[index]));
    if (
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(latitude) ||
      latitude < -85.0511 ||
      latitude > 85.0511 ||
      !Number.isFinite(radius_km) ||
      radius_km <= 0
    ) {
      throw new Error(`Invalid hotspot at CSV line ${i + 2}`);
    }
    records.push({ longitude, latitude, radius_km });
  }
  return records;
}

export interface HotspotLayerHandle {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layer: any;
  readonly count: number;
  setVisible: (show: boolean) => void;
  setData: (records: HotspotRecord[]) => number;
  destroy: () => void;
}

/**
 * A single canvas per dataset; circles scale in true ground distance with zoom.
 * We test viewport bounds before projecting each point. This avoids making
 * thousands of Leaflet vector-layer objects when satellite feeds grow large.
 * The small-angle Mercator conversion is accurate for sub-2 km hotspot radii.
 */
export function createHotspotLayer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  {
    name = 'Hotspots',
    hotspots,
    visible = true,
  }: { name?: string; hotspots: HotspotRecord[]; visible?: boolean }
): HotspotLayerHandle {
  const L = window.L;
  if (!L) throw new Error('Leaflet not available');
  let data: HotspotRecord[] = [];

  const CanvasOverlay = L.Layer.extend({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onAdd(mapInstance: any) {
      this._map = mapInstance;
      this._canvas = L.DomUtil.create('canvas', 'firefusion-hotspot-canvas');
      this._canvas.style.pointerEvents = 'none';
      this._canvas.setAttribute('aria-hidden', 'true');
      mapInstance.getPanes().overlayPane.appendChild(this._canvas);
      mapInstance.on('moveend zoomend resize', this.redraw, this);
      this.redraw();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRemove(mapInstance: any) {
      mapInstance.off('moveend zoomend resize', this.redraw, this);
      this._canvas.remove();
      this._canvas = null;
      this._map = null;
    },
    redraw() {
      const currentMap = this._map;
      if (!currentMap || !this._canvas) return;
      const size = currentMap.getSize();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(size.x * ratio));
      const height = Math.max(1, Math.round(size.y * ratio));
      if (this._canvas.width !== width) this._canvas.width = width;
      if (this._canvas.height !== height) this._canvas.height = height;
      L.DomUtil.setPosition(this._canvas, currentMap.containerPointToLayerPoint([0, 0]));
      this._canvas.style.width = `${size.x}px`;
      this._canvas.style.height = `${size.y}px`;
      const context = this._canvas.getContext('2d');
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, size.x, size.y);
      const centerLongitude = currentMap.getCenter().lng;
      const bounds = currentMap.getBounds();
      const marginKm = 2; // data radii are <2 km; protects edge intersections
      const latMargin = marginKm / 111.2;
      const minLat = bounds.getSouth() - latMargin;
      const maxLat = bounds.getNorth() + latMargin;
      const zoom = currentMap.getZoom();
      const worldWidth = 256 * Math.pow(2, zoom);
      const metersPerEquatorialPixel = 40075016.686 / worldWidth;
      const halfWidth = (size.x / worldWidth) * 180;
      const minLng = centerLongitude - halfWidth - 0.1;
      const maxLng = centerLongitude + halfWidth + 0.1;
      context.lineWidth = 1;
      context.strokeStyle = 'rgba(255, 72, 37, 0.9)';
      context.fillStyle = 'rgba(255, 101, 50, 0.32)';
      context.beginPath();
      for (const hotspot of data) {
        if (hotspot.latitude < minLat || hotspot.latitude > maxLat) continue;
        const longitude =
          hotspot.longitude + 360 * Math.round((centerLongitude - hotspot.longitude) / 360);
        if (longitude < minLng || longitude > maxLng) continue;
        const point = currentMap.latLngToContainerPoint([hotspot.latitude, longitude]);
        // Web Mercator's local ground scale is cos(latitude) times the
        // equatorial scale. Do not impose a minimum pixel radius.
        const r =
          (hotspot.radius_km * 1000) /
          (metersPerEquatorialPixel * Math.max(0.00001, Math.cos((hotspot.latitude * Math.PI) / 180)));
        if (point.x + r < 0 || point.y + r < 0 || point.x - r > size.x || point.y - r > size.y)
          continue;
        if (r < 0.3) continue; // too small to resolve at this zoom; draw at closer zoom levels
        context.moveTo(point.x + r, point.y);
        context.arc(point.x, point.y, r, 0, Math.PI * 2);
      }
      context.fill();
      context.stroke();
    },
  });

  const layer = new CanvasOverlay();

  function setData(records: HotspotRecord[]) {
    if (!Array.isArray(records)) throw new Error('Hotspot data must be an array');
    for (const h of records) {
      if (
        !Number.isFinite(h.latitude) ||
        h.latitude < -85.0511 ||
        h.latitude > 85.0511 ||
        !Number.isFinite(h.longitude) ||
        h.longitude < -180 ||
        h.longitude > 180 ||
        !Number.isFinite(h.radius_km) ||
        h.radius_km <= 0
      ) {
        throw new Error('Invalid hotspot record');
      }
    }
    data = records;
    layer.redraw?.();
    return data.length;
  }

  function setVisible(show: boolean) {
    if (show && !map.hasLayer(layer)) layer.addTo(map);
    if (!show && map.hasLayer(layer)) map.removeLayer(layer);
  }

  setData(hotspots);
  setVisible(visible);

  return {
    name,
    layer,
    get count() {
      return data.length;
    },
    setVisible,
    setData,
    destroy() {
      setVisible(false);
      data = [];
    },
  };
}
