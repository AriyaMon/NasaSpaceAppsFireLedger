import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { StartupSyncStatus } from '../scripts/syncGithubRawDb.ts';
import { BurningCalendar } from './components/BurningCalendar.tsx';
import { EarthGlobe3D } from './components/EarthGlobe3D.tsx';
import { HarmonizationChart } from './components/HarmonizationChart.tsx';
import { PipelineMethodologyPanel } from './components/PipelineMethodologyPanel.tsx';
import { RegionSelector2D } from './components/RegionSelector2D.tsx';
import { ResponderBriefingPanel } from './components/ResponderBriefingPanel.tsx';
import { WaitTimeBridgeView } from './components/WaitTimeBridgeView.tsx';
import { REGION_PRESETS } from './lib/seedData.ts';
import type {
  AnalyzeResponse,
  Bbox,
  ColorRamp,
  DailySlicePoint,
  GlobeCell,
  HarmonizationMode,
  LandsatVerificationResult,
  ResponderBriefResult,
  ResponderRole,
  WaitTimeBridgeResult,
} from './lib/types.ts';

type WorkspaceTab = 'overview' | 'calendar' | 'bridge' | 'pipeline';

function buildQuery(params: Record<string, string | number>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, String(v));
  }
  return qs.toString();
}

export default function App() {
  const initialPreset = REGION_PRESETS[0];

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [spatialSubMode, setSpatialSubMode] = useState<'3d' | '2d'>('3d');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(initialPreset.id);
  const [bbox, setBbox] = useState<Bbox>(initialPreset.bbox);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number } | null>(
    initialPreset.center
  );
  const [mode, setMode] = useState<HarmonizationMode>('harmonized');
  const [selectedYm, setSelectedYm] = useState<string>(initialPreset.highlightYm);
  const [colorRamp, setColorRamp] = useState<ColorRamp>('inferno');
  const [role, setRole] = useState<ResponderRole>('firefighting');
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [dailySlice, setDailySlice] = useState<DailySlicePoint[]>([]);
  const [globeCells, setGlobeCells] = useState<GlobeCell[]>([]);
  const [bridge, setBridge] = useState<WaitTimeBridgeResult | null>(null);
  const [brief, setBrief] = useState<ResponderBriefResult | null>(null);
  const [landsat, setLandsat] = useState<LandsatVerificationResult | null>(null);
  const [startupSync, setStartupSync] = useState<StartupSyncStatus | null>(null);

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [loadingBridge, setLoadingBridge] = useState(false);
  const [loadingLandsat, setLoadingLandsat] = useState(false);
  const [fetchingFirms, setFetchingFirms] = useState(false);
  const [triggeringSync, setTriggeringSync] = useState(false);
  const [queuingRequest, setQueuingRequest] = useState(false);

  const [firmsBanner, setFirmsBanner] = useState<string | null>(null);
  const [githubQueueMessage, setGithubQueueMessage] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [metaInfo, setMetaInfo] = useState<{
    firmsConfigured: boolean;
    localLlmConfigured: boolean;
    githubRepo: string;
  }>({
    firmsConfigured: false,
    localLlmConfigured: false,
    githubRepo: 'AriyaMon/NasaSpaceAppsFireLedger',
  });

  useEffect(() => {
    fetch('/api/meta')
      .then((r) => r.json())
      .then((d) => {
        setMetaInfo({
          firmsConfigured: Boolean(d.firmsConfigured),
          localLlmConfigured: Boolean(d.localLlmConfigured),
          githubRepo: d.githubRepo || 'AriyaMon/NasaSpaceAppsFireLedger',
        });
        if (d.startupSync) setStartupSync(d.startupSync as StartupSyncStatus);
      })
      .catch(() => {});

    const timer = setTimeout(() => {
      fetch('/api/startup-sync-status')
        .then((r) => r.json())
        .then((s: StartupSyncStatus) => setStartupSync(s))
        .catch(() => {});
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingAnalysis(true);
    const qs = buildQuery({
      west: bbox.west,
      south: bbox.south,
      east: bbox.east,
      north: bbox.north,
      mode,
    });
    fetch(`/api/analyze?${qs}`)
      .then((r) => r.json())
      .then((data: AnalyzeResponse) => {
        if (cancelled) return;
        setAnalysis(data);
        if (!data.series.some((s) => s.ym === selectedYm)) {
          setSelectedYm(data.series[data.series.length - 1]?.ym ?? '2026-07');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAnalysis(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bbox, mode]);

  useEffect(() => {
    let cancelled = false;
    const qs = buildQuery({ ym: selectedYm, mode });
    fetch(`/api/globe-cells?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.cells)) setGlobeCells(d.cells);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedYm, mode]);

  useEffect(() => {
    let cancelled = false;
    const qs = buildQuery({
      west: bbox.west,
      south: bbox.south,
      east: bbox.east,
      north: bbox.north,
      ym: selectedYm,
      mode,
    });
    fetch(`/api/daily-slice?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.daily)) setDailySlice(d.daily);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bbox, selectedYm, mode]);

  useEffect(() => {
    let cancelled = false;
    setLoadingBridge(true);
    const qs = buildQuery({
      west: bbox.west,
      south: bbox.south,
      east: bbox.east,
      north: bbox.north,
      ym: selectedYm,
    });
    fetch(`/api/wait-time-bridge?${qs}`)
      .then((r) => r.json())
      .then((d: WaitTimeBridgeResult) => {
        if (!cancelled) setBridge(d);
      })
      .finally(() => {
        if (!cancelled) setLoadingBridge(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bbox, selectedYm]);

  useEffect(() => {
    let cancelled = false;
    const qs = buildQuery({
      west: bbox.west,
      south: bbox.south,
      east: bbox.east,
      north: bbox.north,
      ym: selectedYm,
    });
    fetch(`/api/landsat-verify?${qs}`)
      .then((r) => r.json())
      .then((d: LandsatVerificationResult) => {
        if (!cancelled) setLandsat(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bbox, selectedYm]);

  useEffect(() => {
    let cancelled = false;
    setLoadingBrief(true);
    fetch('/api/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...bbox,
        ym: selectedYm,
        mode,
        role,
      }),
    })
      .then((r) => r.json())
      .then((d: ResponderBriefResult) => {
        if (!cancelled) setBrief(d);
      })
      .finally(() => {
        if (!cancelled) setLoadingBrief(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bbox, selectedYm, mode, role]);

  const handleSelectPreset = useCallback((presetId: string) => {
    const found = REGION_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setSelectedPresetId(found.id);
    setBbox(found.bbox);
    setFlyTarget(found.center);
    setSelectedYm(found.highlightYm);
    setSelectedCellId(null);
  }, []);

  const handleApplyCustomBbox = useCallback((next: Bbox) => {
    setSelectedPresetId('custom');
    setBbox(next);
    setFlyTarget({
      lat: (next.south + next.north) / 2,
      lon: (next.west + next.east) / 2,
    });
    setSelectedCellId(null);
  }, []);

  const handleSelectGlobeCell = useCallback((cell: GlobeCell) => {
    setSelectedCellId(cell.id);
    const matchingPreset = REGION_PRESETS.find((p) => p.id === cell.biome);
    if (matchingPreset) {
      setSelectedPresetId(matchingPreset.id);
      setBbox(matchingPreset.bbox);
      setFlyTarget({ lat: cell.lat, lon: cell.lon });
    }
  }, []);

  const handleExportCsv = () => {
    const qs = buildQuery({
      west: bbox.west,
      south: bbox.south,
      east: bbox.east,
      north: bbox.north,
      mode,
    });
    window.location.href = `/api/hotspots.csv?${qs}`;
  };

  const handleDownloadGeoJson = () => {
    const qs = buildQuery({
      west: bbox.west,
      south: bbox.south,
      east: bbox.east,
      north: bbox.north,
      ym: selectedYm,
    });
    window.location.href = `/api/perimeter.geojson?${qs}`;
  };

  const handleFetchLiveFirms = async () => {
    setFetchingFirms(true);
    setFirmsBanner(null);
    try {
      const res = await fetch('/api/fetch-firms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bbox, days: 3 }),
      });
      const data = await res.json();
      if (data.liveFetched) {
        const counts = Object.entries(data.countsBySensor as Record<string, number>)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' · ');
        setFirmsBanner(`Live NASA FIRMS NRT synced (${data.days}d): ${counts}`);
      } else {
        setFirmsBanner(data.message || 'Live FIRMS key not configured; using baseline ledger.');
      }
    } catch {
      setFirmsBanner('Failed to reach /api/fetch-firms.');
    } finally {
      setFetchingFirms(false);
    }
  };

  const handleRunLiveLandsatCheck = async () => {
    setLoadingLandsat(true);
    try {
      const qs = buildQuery({
        west: bbox.west,
        south: bbox.south,
        east: bbox.east,
        north: bbox.north,
        ym: selectedYm,
        live: 1,
      });
      const res = await fetch(`/api/landsat-verify?${qs}`);
      const d = (await res.json()) as LandsatVerificationResult;
      setLandsat(d);
    } finally {
      setLoadingLandsat(false);
    }
  };

  const handleTriggerStartupSync = async () => {
    setTriggeringSync(true);
    try {
      const res = await fetch('/api/trigger-startup-sync', { method: 'POST' });
      const d = (await res.json()) as StartupSyncStatus;
      setStartupSync(d);
    } finally {
      setTriggeringSync(false);
    }
  };

  const handleQueueGithubRequest = async () => {
    setQueuingRequest(true);
    setGithubQueueMessage(null);
    try {
      const res = await fetch('/api/github-inference/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bbox, ym: selectedYm, mode, role }),
      });
      const d = await res.json();
      if (d.ok) {
        setPendingRequestId(d.requestId);
        setGithubQueueMessage(
          `Queued in ${d.sqlitePath ?? 'database/inference_queue.sqlite'} as status="unanswered" (${d.requestId}). Waiting for Kaggle Mistral 7B...`
        );
      } else {
        setGithubQueueMessage(d.message || 'Failed to queue SQL request.');
      }
    } catch {
      setGithubQueueMessage('Network error queuing SQL request to GitHub.');
    } finally {
      setQueuingRequest(false);
    }
  };

  useEffect(() => {
    if (!pendingRequestId) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/github-inference/status?requestId=${encodeURIComponent(pendingRequestId)}`
        );
        const d = await res.json();
        if (d.answered && d.answer?.text) {
          setBrief((prev) =>
            prev
              ? {
                  ...prev,
                  text: d.answer.text,
                  source: 'local_mistral_7b',
                  modelName: 'Mistral 7B QLoRA (Kaggle · answered ✓)',
                  verifiedNumbers: Array.isArray(d.answer.verifiedNumbers)
                    ? d.answer.verifiedNumbers
                    : prev.verifiedNumbers,
                  rejectedNumbers: Array.isArray(d.answer.rejectedNumbers)
                    ? d.answer.rejectedNumbers
                    : [],
                }
              : prev
          );
          setGithubQueueMessage(
            `Answered by Kaggle Mistral 7B QLoRA (status="answered" in SQLite queue).`
          );
          setPendingRequestId(null);
        }
      } catch {
        // Keep polling cleanly on transient network blips
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [pendingRequestId]);

  const activePoint = useMemo(() => {
    if (!analysis || analysis.series.length === 0) return null;
    return (
      analysis.series.find((s) => s.ym === selectedYm) ??
      analysis.series[analysis.series.length - 1]
    );
  }, [analysis, selectedYm]);

  return (
    <div className="min-h-screen bg-[#090a0d] text-[#f3f1ec]">
      {/* Top Bar Contract: 3 zones (Wordmark | 4 Nav Links | 1 Primary Action) */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#090a0d]/95 px-5 backdrop-blur sm:px-8">
        <div className="mx-auto flex h-15 max-w-[1440px] items-center justify-between gap-8">
          <div className="flex shrink-0 items-baseline gap-3 whitespace-nowrap">
            <span className="font-editorial text-xl font-medium tracking-tight text-[#f3f1ec]">
              FireLedger
            </span>
            <span className="hidden font-mono text-[11px] text-[#73706a] md:inline">
              MODIS · VIIRS · Landsat
            </span>
          </div>

          <nav className="flex items-center gap-5 overflow-x-auto sm:gap-7">
            {(
              [
                ['overview', 'Observatory'],
                ['calendar', 'Burning Calendar'],
                ['bridge', 'Wait-Time Bridge'],
                ['pipeline', 'Harmonization Pipeline'],
              ] as Array<[WorkspaceTab, string]>
            ).map(([tabId, label]) => {
              const active = activeTab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setActiveTab(tabId)}
                  className={`relative shrink-0 whitespace-nowrap py-4 text-xs font-medium transition-colors ${
                    active ? 'text-[#f3f1ec]' : 'text-[#a19d94] hover:text-[#f3f1ec]'
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute inset-x-0 bottom-0 h-[1.5px] bg-[#e5a93c]" />
                  )}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleExportCsv}
            className="shrink-0 whitespace-nowrap rounded border border-white/20 bg-[#101216] px-3.5 py-1.5 font-mono text-xs font-medium text-[#f3f1ec] transition-colors hover:border-[#e5a93c]"
          >
            Export CSV
          </button>
        </div>
      </header>

      {/* Refined Control Strip */}
      <section className="border-b border-white/[0.08] bg-[#090a0d] px-5 py-3 sm:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <span className="text-[#73706a]">Sector</span>
              <select
                value={selectedPresetId}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="rounded border border-white/15 bg-[#101216] px-2.5 py-1 text-xs text-[#f3f1ec] focus:border-[#e5a93c] focus:outline-none"
              >
                {REGION_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortLabel}
                  </option>
                ))}
                {selectedPresetId === 'custom' && <option value="custom">Custom AOI</option>}
              </select>
            </label>

            <div className="flex items-center gap-1 rounded border border-white/10 bg-[#101216] p-0.5 text-xs">
              {(
                [
                  ['harmonized', 'AI-Harmonized (26 yr)'],
                  ['raw', 'Raw Unharmonized'],
                  ['dual_2012', '2012+ Overlap'],
                ] as Array<[HarmonizationMode, string]>
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    mode === m
                      ? m === 'raw'
                        ? 'bg-[#e05a2b]/25 text-[#f7b199]'
                        : 'bg-white/12 text-[#f3f1ec]'
                      : 'text-[#a19d94] hover:text-[#f3f1ec]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs">
              <span className="text-[#73706a]">Month</span>
              <input
                type="month"
                min="2000-11"
                max="2026-10"
                value={selectedYm}
                onChange={(e) => e.target.value && setSelectedYm(e.target.value)}
                className="rounded border border-white/15 bg-[#101216] px-2 py-0.5 font-mono text-xs text-[#f3f1ec]"
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            {startupSync && (
              <span className="hidden font-mono text-[11px] text-[#73706a] xl:inline">
                DB: {startupSync.rawModisRowCount.toLocaleString()} MODIS ·{' '}
                {startupSync.rawViirsRowCount.toLocaleString()} VIIRS
              </span>
            )}
            <button
              type="button"
              disabled={fetchingFirms}
              onClick={handleFetchLiveFirms}
              className="rounded border border-white/15 bg-[#101216] px-3 py-1 text-xs font-medium text-[#c9c5bc] transition-colors hover:border-sky-400 hover:text-[#f3f1ec] disabled:opacity-50"
            >
              {fetchingFirms ? 'Querying NASA FIRMS...' : 'Query Live FIRMS'}
            </button>
          </div>
        </div>

        {firmsBanner && (
          <div className="mx-auto mt-2 max-w-[1440px] border-l-2 border-sky-400 pl-3 font-mono text-[11px] text-sky-200">
            {firmsBanner}
          </div>
        )}
      </section>

      {/* Main Editorial Observatory Workspace */}
      <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 py-6 sm:px-8">
        {/* Flat Hairline-Divided Telemetry Strip */}
        {analysis && activePoint && (
          <section className="grid grid-cols-1 divide-y divide-white/[0.08] border-b border-white/[0.08] pb-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <div className="pr-4 py-1">
              <div className="text-xs text-[#73706a]">
                {mode === 'raw' ? 'Raw Detections' : 'Harmonized VIIRS-Equivalent'} ·{' '}
                <span className="font-mono">{activePoint.ym}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
                <span className="text-2xl font-medium text-[#f3f1ec]">
                  {activePoint.harmonizedCount.toLocaleString()}
                </span>
                <span className="text-xs text-[#a19d94]">
                  {activePoint.source === 'modis_translated'
                    ? 'MODIS → VIIRS'
                    : activePoint.source === 'modis_raw'
                      ? 'MODIS 1 km raw'
                      : 'VIIRS 375 m'}
                </span>
              </div>
              <div className="mt-0.5 truncate text-xs text-[#a19d94]">{analysis.regionName}</div>
            </div>

            <div className="px-4 py-1">
              <div className="text-xs text-sky-300">90% Conformal &amp; Landsat 8/9 CI</div>
              <div className="mt-1 font-mono tabular-nums text-xl font-medium text-[#f3f1ec]">
                {activePoint.landsatLo.toLocaleString()}–{activePoint.landsatHi.toLocaleString()}
              </div>
              <div className="mt-0.5 font-mono tabular-nums text-[11px] text-[#a19d94]">
                OOF 90% CI: {activePoint.lo90.toLocaleString()}–{activePoint.hi90.toLocaleString()} ·{' '}
                {activePoint.landsatCoincidencePct}% 30 m match
              </div>
            </div>

            <div className="px-4 py-1">
              <div className="text-xs text-[#73706a]">26-Year Anomaly Departure</div>
              <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
                <span
                  className={`text-2xl font-medium ${
                    activePoint.anomaly === 'high'
                      ? 'text-[#e05a2b]'
                      : activePoint.anomaly === 'medium'
                        ? 'text-[#e5a93c]'
                        : 'text-emerald-400'
                  }`}
                >
                  {activePoint.pctOfMedian}%
                </span>
                <span className="text-xs text-[#a19d94]">
                  of median ({activePoint.medianSameMonth.toLocaleString()})
                </span>
              </div>
              <div className="mt-0.5 font-mono tabular-nums text-[11px] text-[#a19d94]">
                Z = {activePoint.zScore} · {activePoint.percentile}th pct ·{' '}
                {activePoint.frpTotalMw.toLocaleString()} MW
              </div>
            </div>

            <div className="pl-4 py-1">
              <div className="text-xs text-[#73706a]">Multi-Sensor Accounting (2000–2026)</div>
              <div className="mt-1 font-mono tabular-nums text-lg font-medium text-[#f3f1ec]">
                {analysis.accounting.totalHarmonizedViirsEq.toLocaleString()} VIIRS-Eq
              </div>
              <div className="mt-0.5 font-mono tabular-nums text-[11px] text-[#a19d94]">
                Non-veg dropped: {analysis.accounting.totalModisNonVegFiltered.toLocaleString()} ·
                VIIRS deduped: {analysis.accounting.totalViirsMultiSatRemoved.toLocaleString()}
              </div>
            </div>
          </section>
        )}

        {/* Active View Switcher */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Primary 60%+ Satellite 3D Globe Stage */}
              <div className="flex flex-col gap-3 lg:col-span-7">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSpatialSubMode('3d')}
                      className={`rounded border px-2.5 py-1 font-medium transition-colors ${
                        spatialSubMode === '3d'
                          ? 'border-[#e5a93c]/60 bg-[#e5a93c]/15 text-[#f7d083]'
                          : 'border-white/10 text-[#a19d94] hover:text-[#f3f1ec]'
                      }`}
                    >
                      Satellite 3D Earth
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpatialSubMode('2d')}
                      className={`rounded border px-2.5 py-1 font-medium transition-colors ${
                        spatialSubMode === '2d'
                          ? 'border-[#e5a93c]/60 bg-[#e5a93c]/15 text-[#f7d083]'
                          : 'border-white/10 text-[#a19d94] hover:text-[#f3f1ec]'
                      }`}
                    >
                      2D BBox Selector
                    </button>
                  </div>
                  <span className="font-mono text-[11px] text-[#73706a]">
                    {loadingAnalysis
                      ? 'Recalibrating ledger...'
                      : 'Drag to orbit · Scroll to inspect terrain · Click hotspot'}
                  </span>
                </div>

                <div className="h-[465px]">
                  {spatialSubMode === '3d' ? (
                    <EarthGlobe3D
                      cells={globeCells}
                      selectedBbox={bbox}
                      flyTarget={flyTarget}
                      selectedCellId={selectedCellId}
                      onSelectCell={handleSelectGlobeCell}
                      perimeterGeoJson={bridge?.perimeterGeoJson ?? null}
                      activeYm={selectedYm}
                      regionName={analysis?.regionName ?? initialPreset.name}
                    />
                  ) : (
                    <RegionSelector2D
                      bbox={bbox}
                      cells={globeCells}
                      onApplyBbox={handleApplyCustomBbox}
                    />
                  )}
                </div>
              </div>

              {/* Right-Hand Editorial Operational Briefing Rail */}
              <div className="lg:col-span-5">
                <ResponderBriefingPanel
                  role={role}
                  onSelectRole={setRole}
                  brief={brief}
                  loading={loadingBrief}
                  localLlmConfigured={metaInfo.localLlmConfigured}
                  onQueueKaggleRequest={handleQueueGithubRequest}
                  queuingKaggleRequest={queuingRequest}
                  kaggleQueueMessage={githubQueueMessage}
                />
              </div>
            </div>

            {analysis && (
              <HarmonizationChart
                series={analysis.series}
                mode={mode}
                metrics={analysis.metrics}
                selectedYm={selectedYm}
                onSelectYm={setSelectedYm}
              />
            )}
          </>
        )}

        {activeTab === 'calendar' && analysis && (
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <BurningCalendar
                series={analysis.series}
                selectedYm={selectedYm}
                onSelectYm={setSelectedYm}
                colorRamp={colorRamp}
                onChangeRamp={setColorRamp}
                dailySlice={dailySlice}
                regionName={analysis.regionName}
              />
            </div>
            <div className="xl:col-span-4">
              <ResponderBriefingPanel
                role={role}
                onSelectRole={setRole}
                brief={brief}
                loading={loadingBrief}
                localLlmConfigured={metaInfo.localLlmConfigured}
                onQueueKaggleRequest={handleQueueGithubRequest}
                queuingKaggleRequest={queuingRequest}
                kaggleQueueMessage={githubQueueMessage}
              />
            </div>
          </div>
        )}

        {activeTab === 'bridge' && (
          <div className="flex flex-col gap-8">
            <WaitTimeBridgeView
              bridge={bridge}
              loading={loadingBridge}
              onDownloadGeoJson={handleDownloadGeoJson}
            />
            <ResponderBriefingPanel
              role={role}
              onSelectRole={setRole}
              brief={brief}
              loading={loadingBrief}
              localLlmConfigured={metaInfo.localLlmConfigured}
              onQueueKaggleRequest={handleQueueGithubRequest}
              queuingKaggleRequest={queuingRequest}
              kaggleQueueMessage={githubQueueMessage}
            />
          </div>
        )}

        {activeTab === 'pipeline' && (
          <PipelineMethodologyPanel
            landsat={landsat}
            loadingLandsat={loadingLandsat}
            onRunLiveLandsatCheck={handleRunLiveLandsatCheck}
            startupSync={startupSync}
            triggeringSync={triggeringSync}
            onTriggerStartupSync={handleTriggerStartupSync}
            githubRepo={metaInfo.githubRepo}
            firmsConfigured={metaInfo.firmsConfigured}
            localLlmConfigured={metaInfo.localLlmConfigured}
            onQueueGithubRequest={handleQueueGithubRequest}
            queuingRequest={queuingRequest}
            githubQueueMessage={githubQueueMessage}
          />
        )}
      </main>
    </div>
  );
}
