import { useEffect, useRef, useState } from 'react';
import {
  dailyCsvPath,
  FALLBACK_DAILY_CSVS,
  inCanadaExtent,
  STUDY_DATES,
  type HotspotRecord,
} from './config/dates.ts';
import { createHotspotLayer, parseHotspotCsv, type HotspotLayerHandle } from './layers/hotspots.ts';
import { fetchGlobeCells, fetchMeta } from './lib/apiClient.ts';
import { createMap } from './map/createMap.ts';

const fmt = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-CA', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export default function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<ReturnType<typeof createMap> | null>(null);
  const dayLayersRef = useRef<Map<string, HotspotLayerHandle>>(new Map());
  const demoRecordsRef = useRef<Map<string, HotspotRecord[]>>(new Map());
  const harmonizedRecordsRef = useRef<Map<string, HotspotRecord[]>>(new Map());

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [activeDays, setActiveDays] = useState<Set<string>>(() => new Set([STUDY_DATES[0]]));
  const [countsByDate, setCountsByDate] = useState<Record<string, string>>(() =>
    Object.fromEntries(STUDY_DATES.map((d) => [d, 'Awaiting data']))
  );
  const [coordsText, setCoordsText] = useState<string>('73.13° N  ·  99.84° W');
  const [zoomText, setZoomText] = useState<string>('ZOOM 1');
  const [mapReady, setMapReady] = useState<boolean>(true);
  const [dataSourceMode, setDataSourceMode] = useState<'demo' | 'harmonized'>('demo');

  // Initialize Leaflet map and load the 7 June 2023 daily hotspot layers
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let cancelled = false;
    try {
      const viewer = createMap(container, {
        onViewChange: ({ lat, lng, zoom }) => {
          setCoordsText(
            `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}  ·  ${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`
          );
          setZoomText(`ZOOM ${zoom}`);
        },
      });
      viewerRef.current = viewer;
      setMapReady(true);

      const loadDay = async (date: string, index: number) => {
        try {
          let csvText = '';
          try {
            const response = await fetch(dailyCsvPath(date));
            if (response.ok) {
              const text = await response.text();
              if (text.includes('longitude,latitude,radius_km')) {
                csvText = text;
              }
            }
          } catch {
            // Use embedded fallback CSV when running offline or on custom base path
          }
          if (!csvText) {
            csvText = FALLBACK_DAILY_CSVS[date] || '';
          }

          const records = parseHotspotCsv(csvText).filter(inCanadaExtent);
          if (cancelled) return;
          demoRecordsRef.current.set(date, records);

          const layer = createHotspotLayer(viewer.map, {
            name: fmt(date),
            hotspots: records,
            visible: index === 0,
          });
          dayLayersRef.current.set(date, layer);
          setCountsByDate((prev) => ({
            ...prev,
            [date]: `${records.length.toLocaleString('en-CA')} demo`,
          }));
        } catch (error) {
          console.error(`Hotspots for ${date} failed to load:`, error);
          if (!cancelled) {
            setCountsByDate((prev) => ({
              ...prev,
              [date]: 'Load error',
            }));
          }
        }
      };

      void Promise.all(STUDY_DATES.map((date, idx) => loadDay(date, idx)));

      // Also warm up FireLedger architecture (backend or static GitHub Pages engine)
      void fetchMeta().catch(() => null);
    } catch (error) {
      console.error('FireFusion map initialization failed:', error);
      setMapReady(false);
    }

    return () => {
      cancelled = true;
      for (const layer of dayLayersRef.current.values()) {
        layer.destroy();
      }
      dayLayersRef.current.clear();
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Sync Leaflet canvas layer visibility whenever activeDays changes
  useEffect(() => {
    for (const [date, layer] of dayLayersRef.current.entries()) {
      layer.setVisible(activeDays.has(date));
    }
  }, [activeDays]);

  const selectDay = (index: number) => {
    const clamped = Math.max(0, Math.min(6, Number(index)));
    const date = STUDY_DATES[clamped];
    setSelectedIndex(clamped);
    setActiveDays(new Set([date]));
  };

  const toggleDayCheckbox = (date: string, checked: boolean) => {
    setActiveDays((prev) => {
      const next = new Set(prev);
      if (checked) next.add(date);
      else next.delete(date);
      return next;
    });
  };

  // Optional toggle when clicking the top-right badge to switch between the 100 demo points
  // and FireLedger's harmonized MODIS+VIIRS+Landsat backend/client architecture
  const handleToggleDataSource = async () => {
    const nextMode = dataSourceMode === 'demo' ? 'harmonized' : 'demo';
    setDataSourceMode(nextMode);

    if (nextMode === 'demo') {
      const nextCounts: Record<string, string> = {};
      for (const date of STUDY_DATES) {
        const recs = demoRecordsRef.current.get(date) || [];
        dayLayersRef.current.get(date)?.setData(recs);
        nextCounts[date] = `${recs.length.toLocaleString('en-CA')} demo`;
      }
      setCountsByDate(nextCounts);
      return;
    }

    // Load or use cached FireLedger harmonized Canadian cells for June 1–7, 2023
    const nextCounts: Record<string, string> = {};
    for (const [idx, date] of STUDY_DATES.entries()) {
      let recs = harmonizedRecordsRef.current.get(date);
      if (!recs) {
        const res = await fetchGlobeCells('2023-06', 'harmonized', idx + 1);
        const canadian = res.cells
          .filter((c) => c.lat >= 41.5 && c.lat <= 84 && c.lon >= -141.5 && c.lon <= -52)
          .map((c) => ({
            longitude: c.lon,
            latitude: c.lat,
            radius_km: Math.max(45, Math.min(145, 35 + Math.sqrt(c.harmonizedCount) * 8)),
          }));
        recs = canadian.length > 0 ? canadian : demoRecordsRef.current.get(date) || [];
        harmonizedRecordsRef.current.set(date, recs);
      }
      dayLayersRef.current.get(date)?.setData(recs);
      nextCounts[date] = `${recs.length.toLocaleString('en-CA')} harmonized`;
    }
    setCountsByDate(nextCounts);
  };

  const selectedDate = STUDY_DATES[selectedIndex];

  return (
    <main className="workspace" aria-label="FireFusion Canada wildfire map">
      <div
        id="map"
        ref={mapContainerRef}
        className="map"
        aria-label="Interactive map constrained to Canada"
        role="application"
      />

      <header className="topbar">
        <a className="brand" href="./" aria-label="FireFusion home">
          <span className="brand-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M13.4 2.5c.5 4.4-3.4 5.9-2.4 9.2-2-1-2.6-3.1-2.5-4.6C5.5 10.2 4 12.9 4 16a8 8 0 0 0 16 0c0-5-3.7-8.6-6.6-13.5Z"
                fill="currentColor"
              />
              <path
                d="M12.7 11c-.1 2.5-3.4 3.6-3.4 6A3.2 3.2 0 0 0 15.7 17c0-2.4-1.2-4.2-3-6Z"
                fill="#101b24"
              />
            </svg>
          </span>
          <span>
            Fire<span className="brand-accent">Fusion</span>
          </span>
        </a>
        <div className="topbar-separator" aria-hidden="true" />
        <div className="topbar-label">
          Canada <span className="topbar-label-muted">/ Fire Explorer</span>
        </div>
        <button
          type="button"
          className="prototype-tag"
          onClick={handleToggleDataSource}
          title="Click to toggle between Demo CSV data and FireLedger Harmonized MODIS/VIIRS data"
        >
          {dataSourceMode === 'demo'
            ? 'DEMO DATA · JUNE 1–7, 2023'
            : 'HARMONIZED DATA · JUNE 1–7, 2023'}
        </button>
      </header>

      <section className="intro-panel" aria-label="Map information">
        <div className="eyebrow">
          <span className="live-dot" /> HISTORICAL WILDFIRE VIEWER
        </div>
        <h1>Canada Wildfire Map</h1>
        <p>
          {dataSourceMode === 'demo'
            ? 'Explore 100 synthetic demo hotspots across June 1–7, 2023. These are not real satellite detections.'
            : 'Explore harmonized 375 m VIIRS-equivalent Canadian hotspots across June 1–7, 2023 from the FireLedger engine.'}
        </p>
        <div className="panel-divider" />
        <div className="panel-foot">
          <span className="panel-icon" aria-hidden="true">
            ▧
          </span>{' '}
          OpenStreetMap base layer
        </div>
      </section>

      <section className="layer-panel" aria-label="Map data layers">
        <div className="layer-panel-heading">DAILY HOTSPOT LAYERS</div>
        <div id="daily-layers" className="daily-layers">
          {STUDY_DATES.map((date, index) => (
            <label key={date} className="hotspot-layer-label daily-layer-label">
              <input
                type="checkbox"
                id={`layer-${date}`}
                checked={activeDays.has(date)}
                onChange={(e) => toggleDayCheckbox(date, e.target.checked)}
              />
              <span className="hotspot-swatch" aria-hidden="true" />
              <span>{`June ${index + 1}`}</span>
              <span id={`count-${date}`} className="hotspot-count">
                {countsByDate[date] ?? 'Awaiting data'}
              </span>
            </label>
          ))}
        </div>
        <p className="layer-note">
          {dataSourceMode === 'demo'
            ? 'Demo data only · 100 illustrative points across seven dates. Replace daily CSVs with real satellite observations when available.'
            : 'FireLedger MODIS + VIIRS + Landsat harmonized observations across seven dates. Click the top-right badge to return to Demo data.'}
        </p>
      </section>

      <section className="timeline-panel" aria-label="Daily hotspot timeline">
        <div className="timeline-heading">
          <span className="layer-panel-heading">TIMELINE · JUNE 2023</span>
          <strong id="selected-day">{fmt(selectedDate)}</strong>
        </div>
        <div className="timeline-controls">
          <button
            id="day-prev"
            type="button"
            aria-label="Previous day"
            disabled={selectedIndex === 0}
            onClick={() => selectDay(selectedIndex - 1)}
          >
            ◀
          </button>
          <input
            id="day-slider"
            type="range"
            min={0}
            max={6}
            step={1}
            value={selectedIndex}
            aria-label="Select day, June 1 to June 7, 2023"
            onChange={(e) => selectDay(Number(e.target.value))}
          />
          <button
            id="day-next"
            type="button"
            aria-label="Next day"
            disabled={selectedIndex === 6}
            onClick={() => selectDay(selectedIndex + 1)}
          >
            ▶
          </button>
        </div>
        <div className="timeline-days" id="timeline-days">
          {STUDY_DATES.map((date, index) => {
            const isSelected = selectedIndex === index;
            return (
              <button
                key={date}
                type="button"
                data-date={date}
                className={isSelected ? 'active' : ''}
                aria-label={fmt(date)}
                aria-pressed={isSelected}
                onClick={() => selectDay(index)}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        <p className="timeline-help">
          Choose a day to isolate it. Use the layer checkboxes to compare multiple days.
        </p>
      </section>

      <nav className="map-tools" aria-label="Map controls">
        <button
          type="button"
          className="tool-button"
          id="zoom-in"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => viewerRef.current?.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          className="tool-button"
          id="zoom-out"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => viewerRef.current?.zoomOut()}
        >
          −
        </button>
        <div className="tools-rule" />
        <button
          type="button"
          className="tool-button home-button"
          id="reset-view"
          title="Reset to Canada"
          aria-label="Reset view"
          onClick={() => viewerRef.current?.resetView()}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m3 10 9-7 9 7" />
            <path d="M5 9v11h14V9" />
            <path d="M9 20v-7h6v7" />
          </svg>
        </button>
      </nav>

      <footer className="statusbar" aria-label="Map status">
        <span className="status-title">
          <span className="status-dot" /> {mapReady ? 'MAP READY' : 'MAP UNAVAILABLE'}
        </span>
        <span className="status-separator" />
        <span id="coordinates">{coordsText}</span>
        <span className="status-separator" />
        <span id="zoom-level">{zoomText}</span>
        <span className="status-hint">Scroll to zoom · Drag within Canadian extent</span>
      </footer>
    </main>
  );
}
