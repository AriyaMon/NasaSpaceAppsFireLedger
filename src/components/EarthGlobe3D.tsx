import React, { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { Bbox, GeoJsonFeatureCollection, GlobeCell } from '../lib/types.ts';

setWorkerUrl(maplibreWorkerUrl);

interface EarthGlobe3DProps {
  cells: GlobeCell[];
  selectedBbox: Bbox;
  flyTarget: { lat: number; lon: number } | null;
  selectedCellId: string | null;
  onSelectCell: (cell: GlobeCell) => void;
  perimeterGeoJson?: GeoJsonFeatureCollection | null;
  activeYm: string;
  activeDay?: number | null;
  regionName: string;
}

export const EarthGlobe3D: React.FC<EarthGlobe3DProps> = ({
  cells,
  selectedBbox,
  flyTarget,
  selectedCellId,
  onSelectCell,
  perimeterGeoJson,
  activeYm,
  activeDay,
  regionName,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLoadedRef = useRef(false);
  const popupRef = useRef<Popup | null>(null);

  const onSelectCellRef = useRef(onSelectCell);
  onSelectCellRef.current = onSelectCell;

  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  const [showLabels, setShowLabels] = useState(true);
  const [viewAltitude, setViewAltitude] = useState<'orbit' | 'terrain'>('orbit');
  const [mapError, setMapError] = useState<string | null>(null);

  const buildFireGeoJson = (list: GlobeCell[], activeId: string | null) => ({
    type: 'FeatureCollection' as const,
    features: list.map((c) => {
      const isCluster = c.cellKind !== 'fire';
      const coreR = isCluster
        ? Math.max(3.6, Math.min(11.5, 3.0 + Math.sqrt(c.harmonizedCount) * 0.13))
        : Math.max(2.1, Math.min(5.2, 1.9 + Math.sqrt(c.frpMw) * 0.16));
      return {
        type: 'Feature' as const,
        properties: {
          id: c.id,
          cellKind: isCluster ? 'cluster' : 'fire',
          regionLabel: c.regionLabel,
          harmonizedCount: c.harmonizedCount,
          lo90: c.lo90,
          hi90: c.hi90,
          landsatLo: c.landsatLo,
          landsatHi: c.landsatHi,
          landsatCoincidencePct: c.landsatCoincidencePct,
          frpMw: c.frpMw,
          anomalyScore: c.anomalyScore,
          dominantSensor: c.dominantSensor,
          acqDate: c.acqDate ?? activeYm,
          isSelected: c.id === activeId ? 1 : 0,
          radiusCore: coreR,
          radiusGlow: coreR * 2.2,
          radiusCi: Math.max(8, Math.min(22, 6.2 + Math.sqrt(c.landsatHi) * 0.22)),
          colorHex:
            c.anomalyScore >= 2.0
              ? '#ef4444'
              : c.anomalyScore >= 1.0 || c.confidenceTier === 'high'
                ? isCluster
                  ? '#f59e0b'
                  : '#fb923c'
                : '#38bdf8',
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [c.lon, c.lat],
        },
      };
    }),
  });

  const buildBboxGeoJson = (b: Bbox) => {
    if (b.east - b.west >= 300) {
      return { type: 'FeatureCollection' as const, features: [] };
    }
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [b.west, b.south],
                [b.east, b.south],
                [b.east, b.north],
                [b.west, b.north],
                [b.west, b.south],
              ],
            ],
          },
        },
      ],
    };
  };

  // Initialize MapLibre GL 3D Globe once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        center: [flyTarget?.lon ?? -67.5, flyTarget?.lat ?? -29.16],
        zoom: 1.7,
        pitch: 14,
        bearing: 0,
        attributionControl: { compact: true },
        style: {
          version: 8,
          projection: { type: 'globe' },
          sky: {
            'sky-color': '#050912',
            'sky-horizon-blend': 0.55,
            'horizon-color': '#3b82f6',
            'horizon-fog-blend': 0.5,
            'fog-color': '#0a1628',
            'fog-ground-blend': 0.25,
            'atmosphere-blend': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0,
              0.92,
              5,
              0.55,
              10,
              0.08,
            ],
          },
          sources: {
            'esri-world-imagery': {
              type: 'raster',
              tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              ],
              tileSize: 256,
              maxzoom: 18,
              attribution: 'Esri, Maxar, Earthstar Geographics · NASA FIRMS',
            },
            'esri-reference-labels': {
              type: 'raster',
              tiles: [
                'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
              ],
              tileSize: 256,
              maxzoom: 18,
            },
          },
          layers: [
            {
              id: 'esri-satellite-layer',
              type: 'raster',
              source: 'esri-world-imagery',
              paint: {
                'raster-saturation': 0.08,
                'raster-contrast': 0.06,
              },
            },
            {
              id: 'esri-labels-layer',
              type: 'raster',
              source: 'esri-reference-labels',
              paint: {
                'raster-opacity': 0.88,
              },
            },
          ],
        },
      });
    } catch {
      setMapError('WebGL satellite globe unavailable in this browser.');
      return;
    }

    mapRef.current = map;

    map.on('load', () => {
      mapLoadedRef.current = true;

      map.addSource('aoi-bbox', {
        type: 'geojson',
        data: buildBboxGeoJson(selectedBbox),
      });

      map.addLayer({
        id: 'aoi-bbox-fill',
        type: 'fill',
        source: 'aoi-bbox',
        paint: {
          'fill-color': '#38bdf8',
          'fill-opacity': 0.06,
        },
      });

      map.addLayer({
        id: 'aoi-bbox-outline',
        type: 'line',
        source: 'aoi-bbox',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 1.8,
          'line-dasharray': [3, 2],
        },
      });

      map.addSource('wait-time-perimeter', {
        type: 'geojson',
        data: perimeterGeoJson ?? { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'wtb-burn-fill',
        type: 'fill',
        source: 'wait-time-perimeter',
        filter: ['==', ['get', 'layer'], 'day1_superres_burn_perimeter'],
        paint: {
          'fill-color': '#ef4444',
          'fill-opacity': 0.28,
        },
      });

      map.addLayer({
        id: 'wtb-burn-outline',
        type: 'line',
        source: 'wait-time-perimeter',
        filter: ['==', ['get', 'layer'], 'day1_superres_burn_perimeter'],
        paint: {
          'line-color': '#fb7185',
          'line-width': 2.2,
        },
      });

      map.addLayer({
        id: 'wtb-wind-cone',
        type: 'fill',
        source: 'wait-time-perimeter',
        filter: ['==', ['get', 'layer'], '24h_downwind_spread_cone'],
        paint: {
          'fill-color': '#f97316',
          'fill-opacity': 0.22,
        },
      });

      map.addLayer({
        id: 'wtb-wind-cone-line',
        type: 'line',
        source: 'wait-time-perimeter',
        filter: ['==', ['get', 'layer'], '24h_downwind_spread_cone'],
        paint: {
          'line-color': '#fb923c',
          'line-width': 1.6,
          'line-dasharray': [4, 3],
        },
      });

      map.addSource('fire-cells', {
        type: 'geojson',
        data: buildFireGeoJson(cellsRef.current, selectedCellId),
      });

      // Outer Landsat + Conformal Confidence Ring (Cluster Anchors only for crisp visibility)
      map.addLayer({
        id: 'fire-cells-ci-halo',
        type: 'circle',
        source: 'fire-cells',
        filter: ['==', ['get', 'cellKind'], 'cluster'],
        paint: {
          'circle-radius': ['get', 'radiusCi'],
          'circle-color': '#38bdf8',
          'circle-opacity': 0.14,
          'circle-stroke-color': '#38bdf8',
          'circle-stroke-width': 1,
          'circle-stroke-opacity': 0.5,
        },
      });

      // Soft Thermal Ember Glow around individual active fires
      map.addLayer({
        id: 'fire-cells-thermal-glow',
        type: 'circle',
        source: 'fire-cells',
        filter: ['==', ['get', 'cellKind'], 'fire'],
        paint: {
          'circle-radius': ['get', 'radiusGlow'],
          'circle-color': ['get', 'colorHex'],
          'circle-opacity': 0.26,
          'circle-blur': 0.75,
        },
      });

      // Inner Thermal Hotspot Core (all simulated + observed fires & cluster cores)
      map.addLayer({
        id: 'fire-cells-core',
        type: 'circle',
        source: 'fire-cells',
        paint: {
          'circle-radius': ['get', 'radiusCore'],
          'circle-color': ['get', 'colorHex'],
          'circle-opacity': ['case', ['==', ['get', 'cellKind'], 'cluster'], 0.92, 0.88],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': [
            'case',
            ['==', ['get', 'isSelected'], 1],
            2.2,
            ['==', ['get', 'cellKind'], 'cluster'],
            0.85,
            0.25,
          ],
          'circle-stroke-opacity': ['case', ['==', ['get', 'cellKind'], 'cluster'], 0.9, 0.45],
        },
      });

      map.on('mouseenter', 'fire-cells-core', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'fire-cells-core', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', 'fire-cells-core', (e: MapLayerMouseEvent) => {
        const feat = e.features?.[0];
        if (!feat || !feat.properties) return;
        const props = feat.properties as Record<string, string | number>;
        const matched = cellsRef.current.find((c) => c.id === String(props.id));
        if (matched) {
          onSelectCellRef.current(matched);
        }

        const coords = (feat.geometry as { type: string; coordinates: [number, number] })
          .coordinates;
        popupRef.current?.remove();
        popupRef.current = new Popup({ closeButton: true, maxWidth: '280px' })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-size:12px;line-height:1.45;">
              <div style="font-weight:600;color:#f3f1ec;margin-bottom:4px;">${props.regionLabel}</div>
              <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#d1d5db;">
                Date: <span style="color:#f3f1ec;">${props.acqDate || activeYm}</span><br/>
                Sensor: <span style="color:#93c5fd;">${props.dominantSensor || 'VIIRS 375m'}</span><br/>
                VIIRS-Eq: <strong style="color:#fbbf24;">${Number(props.harmonizedCount).toLocaleString()}</strong><br/>
                90% CI: ${Number(props.lo90).toLocaleString()}–${Number(props.hi90).toLocaleString()}<br/>
                Landsat CI: <span style="color:#38bdf8;">${Number(props.landsatLo).toLocaleString()}–${Number(props.landsatHi).toLocaleString()}</span><br/>
                FRP: ${Number(props.frpMw).toLocaleString()} MW
              </div>
            </div>`
          )
          .addTo(map);
      });
    });

    map.on('error', () => {
      // Tile transient issues should not crash the viewport
    });

    return () => {
      mapLoadedRef.current = false;
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update GeoJSON data sources without re-mounting the globe
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const src = map.getSource('fire-cells') as GeoJSONSource | undefined;
    src?.setData(buildFireGeoJson(cells, selectedCellId));
  }, [cells, selectedCellId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const src = map.getSource('aoi-bbox') as GeoJSONSource | undefined;
    src?.setData(buildBboxGeoJson(selectedBbox));
  }, [selectedBbox]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const src = map.getSource('wait-time-perimeter') as GeoJSONSource | undefined;
    src?.setData(perimeterGeoJson ?? { type: 'FeatureCollection', features: [] });
  }, [perimeterGeoJson]);

  // Toggle labels overlay visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    if (map.getLayer('esri-labels-layer')) {
      map.setLayoutProperty('esri-labels-layer', 'visibility', showLabels ? 'visible' : 'none');
    }
  }, [showLabels]);

  // Smooth Google-Earth-style flyTo when preset or altitude mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    const isGlobalPreset = selectedBbox.east - selectedBbox.west > 300;
    const targetZoom =
      viewAltitude === 'terrain'
        ? isGlobalPreset
          ? 2.2
          : selectedBbox.east - selectedBbox.west < 4
            ? 10.1
            : 5.2
        : isGlobalPreset
          ? 1.7
          : 2.8;

    map.flyTo({
      center: [flyTarget.lon, flyTarget.lat],
      zoom: targetZoom,
      pitch: viewAltitude === 'terrain' && !isGlobalPreset ? 48 : 16,
      bearing: viewAltitude === 'terrain' && !isGlobalPreset ? 18 : 0,
      duration: 1200,
      essential: true,
    });
  }, [flyTarget, viewAltitude, selectedBbox]);

  const handleZoom = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomTo(map.getZoom() + delta, { duration: 300 });
  };

  return (
    <div className="relative h-full w-full min-h-[420px] overflow-hidden rounded-md border border-white/[0.08] bg-[#050912]">
      <div
        ref={containerRef}
        className="h-full w-full"
        aria-label="Interactive Satellite 3D Earth Globe"
      />

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#090a0d] p-6 text-center text-sm text-amber-300">
          {mapError}
        </div>
      )}

      {/* Subtle Floating Cartographic Controls (Top-Left) */}
      <div className="pointer-events-none absolute left-3.5 top-3.5 z-10 flex max-w-[58%] flex-col gap-0.5 rounded border border-white/10 bg-[#090a0d]/85 px-3 py-2 backdrop-blur-sm">
        <div className="truncate font-editorial text-sm font-medium text-[#f3f1ec]">
          {regionName}
        </div>
        <div className="truncate font-mono text-[10px] text-[#a19d94]">
          {activeDay ? `${activeYm}-${String(activeDay).padStart(2, '0')}` : activeYm} ·{' '}
          {cells.filter((c) => c.cellKind === 'fire').length.toLocaleString()} active fires plotted · Cyan rings = Landsat 8/9 CI
        </div>
      </div>

      {/* Top-Right Interactive Altitude & Layer Controls */}
      <div className="absolute right-3.5 top-3.5 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setViewAltitude((a) => (a === 'orbit' ? 'terrain' : 'orbit'))}
          className="rounded border border-white/15 bg-[#090a0d]/90 px-2.5 py-1 text-xs font-medium text-[#f3f1ec] transition-colors hover:border-amber-500/70"
        >
          {viewAltitude === 'orbit' ? 'Zoom to Terrain' : 'Orbital View'}
        </button>
        <button
          type="button"
          onClick={() => setShowLabels((v) => !v)}
          className="rounded border border-white/15 bg-[#090a0d]/90 px-2.5 py-1 text-xs font-medium text-stone-300 transition-colors hover:border-white/30"
        >
          {showLabels ? 'Hide Labels' : 'Show Labels'}
        </button>
        <button
          type="button"
          onClick={() => handleZoom(1.2)}
          className="rounded border border-white/15 bg-[#090a0d]/90 px-2.5 py-1 font-mono text-xs text-stone-200 hover:border-white/40"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => handleZoom(-1.2)}
          className="rounded border border-white/15 bg-[#090a0d]/90 px-2.5 py-1 font-mono text-xs text-stone-200 hover:border-white/40"
          title="Zoom out"
        >
          −
        </button>
      </div>

      {/* Bottom-Left Compact Legend */}
      <div className="pointer-events-none absolute bottom-3.5 left-3.5 z-10 rounded border border-white/10 bg-[#090a0d]/85 px-2.5 py-1 font-mono text-[10px] text-stone-300">
        <span className="text-red-400">● Anomaly ≥2σ</span> ·{' '}
        <span className="text-amber-400">● Active Hotspot</span> ·{' '}
        <span className="text-sky-400">○ Landsat CI</span> ·{' '}
        <span className="text-orange-400">▱ Day-1 Scar & Wind Plume</span>
      </div>
    </div>
  );
};
