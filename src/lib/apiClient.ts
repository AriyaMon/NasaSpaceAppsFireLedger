import type { StartupSyncStatus } from '../../scripts/syncGithubRawDb.ts';
import { generateDeterministicResponderBrief } from './brief.ts';
import { toHarmonizedCsv, toPerimeterGeoJson } from './exports.ts';
import {
  analyzeBbox,
  buildDailySlice,
  buildGlobeCells,
  buildLandsatVerification,
} from './harmonize.ts';
import { inferRegionName } from './seedData.ts';
import type {
  AnalyzeResponse,
  Bbox,
  DailySlicePoint,
  GlobeCell,
  HarmonizationMode,
  LandsatVerificationResult,
  ResponderBriefResult,
  ResponderRole,
  WaitTimeBridgeResult,
} from './types.ts';
import { buildWaitTimeBridge } from './waitTimeBridge.ts';

export const DEFAULT_GITHUB_REPO = 'HackathonTeam12341/NasaSpaceAppsFireLedger';

export interface MetaResponse {
  firmsConfigured: boolean;
  localLlmConfigured: boolean;
  githubRepo: string;
  startupSync?: StartupSyncStatus;
  staticHosted?: boolean;
}

let backendAvailablePromise: Promise<boolean> | null = null;

async function isBackendAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (
    window.location.hostname.endsWith('.github.io') ||
    window.location.protocol === 'file:'
  ) {
    return false;
  }
  if (!backendAvailablePromise) {
    backendAvailablePromise = fetch('/api/health', {
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        const ct = res.headers.get('content-type') || '';
        return res.ok && ct.includes('application/json');
      })
      .catch(() => false);
  }
  return backendAvailablePromise;
}

async function fetchBackendJson<T>(
  url: string,
  init?: RequestInit
): Promise<T | null> {
  const hasBackend = await isBackendAvailable();
  if (!hasBackend) return null;
  try {
    const res = await fetch(url, init);
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function buildQuery(params: Record<string, string | number>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, String(v));
  }
  return qs.toString();
}

export function computeLocalAnalyze(
  bbox: Bbox,
  mode: HarmonizationMode
): AnalyzeResponse {
  return analyzeBbox(bbox, mode);
}

export function computeLocalGlobeCells(
  ym: string,
  mode: HarmonizationMode,
  day?: number | null
): { ym: string; day: number | null; mode: HarmonizationMode; cells: GlobeCell[] } {
  const activeDay =
    typeof day === 'number' && Number.isFinite(day) ? day : null;
  return {
    ym,
    day: activeDay,
    mode,
    cells: buildGlobeCells(ym, mode, activeDay),
  };
}

export function computeLocalDailySlice(
  bbox: Bbox,
  ym: string,
  mode: HarmonizationMode
): { ym: string; regionName: string; daily: DailySlicePoint[] } {
  const analysis = analyzeBbox(bbox, mode);
  const point =
    analysis.series.find((s) => s.ym === ym) ??
    analysis.series[analysis.series.length - 1];
  const daily = buildDailySlice(point);
  return { ym: point.ym, regionName: analysis.regionName, daily };
}

export function computeLocalWaitTimeBridge(
  bbox: Bbox,
  ym: string
): WaitTimeBridgeResult {
  return buildWaitTimeBridge(bbox, inferRegionName(bbox), ym);
}

export function computeLocalLandsatVerify(
  bbox: Bbox,
  ym: string
): LandsatVerificationResult {
  return buildLandsatVerification(bbox, ym);
}

export function computeLocalBrief(
  bbox: Bbox,
  ym: string,
  mode: HarmonizationMode,
  role: ResponderRole
): ResponderBriefResult {
  const analysis = analyzeBbox(bbox, mode);
  const point =
    analysis.series.find((s) => s.ym === ym) ??
    analysis.series[analysis.series.length - 1];
  const bridge = buildWaitTimeBridge(bbox, analysis.regionName, point.ym);
  return generateDeterministicResponderBrief({
    role,
    regionName: analysis.regionName,
    point,
    metrics: analysis.metrics,
    bridge,
  });
}

function buildStaticStartupSyncStatus(
  repo = DEFAULT_GITHUB_REPO,
  rawModisRowCount = 0,
  rawViirsRowCount = 0
): StartupSyncStatus {
  return {
    state: 'partial_local_only',
    startedAtIso: null,
    completedAtIso: new Date().toISOString(),
    githubRepo: repo,
    firmsKeyConfigured: false,
    githubTokenConfigured: false,
    rawModisRowCount,
    rawViirsRowCount,
    rawLandsatRowCount: 0,
    harmonizedMonthlyRows: 312,
    githubFilesUpdated: [],
    lastCommitSha: null,
    message:
      'Public GitHub Observatory mode active — running browser-side MODIS/VIIRS harmonization & Landsat CI checks.',
  };
}

async function fetchPublicGithubDatasetCounts(repo: string): Promise<{
  modisRows: number;
  viirsRows: number;
  cells: GlobeCell[];
}> {
  let modisRows = 0;
  let viirsRows = 0;
  const cells: GlobeCell[] = [];

  try {
    const metaResp = await fetch(
      `https://raw.githubusercontent.com/${repo}/dev/data/dataset_meta.json`
    );
    if (metaResp.ok) {
      const meta = (await metaResp.json()) as {
        rawModisRows?: number;
        rawViirsRows?: number;
        rawModisRowsSynced?: number;
        rawViirsRowsSynced?: number;
      };
      modisRows = Number(meta.rawModisRowsSynced ?? meta.rawModisRows ?? 0);
      viirsRows = Number(meta.rawViirsRowsSynced ?? meta.rawViirsRows ?? 0);
    }
  } catch {
    // Non-fatal in offline/sandboxed mode
  }

  return { modisRows, viirsRows, cells };
}

export async function fetchMeta(): Promise<MetaResponse> {
  const backend = await fetchBackendJson<MetaResponse>('/api/meta');
  if (backend) return backend;

  const counts = await fetchPublicGithubDatasetCounts(DEFAULT_GITHUB_REPO);
  return {
    firmsConfigured: false,
    localLlmConfigured: false,
    githubRepo: DEFAULT_GITHUB_REPO,
    staticHosted: true,
    startupSync: buildStaticStartupSyncStatus(
      DEFAULT_GITHUB_REPO,
      counts.modisRows,
      counts.viirsRows
    ),
  };
}

export async function fetchStartupSyncStatus(): Promise<StartupSyncStatus> {
  const backend = await fetchBackendJson<StartupSyncStatus>(
    '/api/startup-sync-status'
  );
  if (backend) return backend;

  const counts = await fetchPublicGithubDatasetCounts(DEFAULT_GITHUB_REPO);
  return buildStaticStartupSyncStatus(
    DEFAULT_GITHUB_REPO,
    counts.modisRows,
    counts.viirsRows
  );
}

export async function fetchAnalyze(
  bbox: Bbox,
  mode: HarmonizationMode
): Promise<AnalyzeResponse> {
  const qs = buildQuery({
    west: bbox.west,
    south: bbox.south,
    east: bbox.east,
    north: bbox.north,
    mode,
  });
  const backend = await fetchBackendJson<AnalyzeResponse>(`/api/analyze?${qs}`);
  return backend ?? computeLocalAnalyze(bbox, mode);
}

export async function fetchGlobeCells(
  ym: string,
  mode: HarmonizationMode,
  day?: number | null
): Promise<{ ym: string; day: number | null; mode: HarmonizationMode; cells: GlobeCell[] }> {
  const params: Record<string, string | number> = { ym, mode };
  if (typeof day === 'number' && Number.isFinite(day)) {
    params.day = day;
  }
  const qs = buildQuery(params);
  const backend = await fetchBackendJson<{
    ym: string;
    day: number | null;
    mode: HarmonizationMode;
    cells: GlobeCell[];
  }>(`/api/globe-cells?${qs}`);
  return backend ?? computeLocalGlobeCells(ym, mode, day);
}

export async function fetchDailySlice(
  bbox: Bbox,
  ym: string,
  mode: HarmonizationMode
): Promise<{ ym: string; regionName: string; daily: DailySlicePoint[] }> {
  const qs = buildQuery({
    west: bbox.west,
    south: bbox.south,
    east: bbox.east,
    north: bbox.north,
    ym,
    mode,
  });
  const backend = await fetchBackendJson<{
    ym: string;
    regionName: string;
    daily: DailySlicePoint[];
  }>(`/api/daily-slice?${qs}`);
  return backend ?? computeLocalDailySlice(bbox, ym, mode);
}

export async function fetchWaitTimeBridge(
  bbox: Bbox,
  ym: string
): Promise<WaitTimeBridgeResult> {
  const qs = buildQuery({
    west: bbox.west,
    south: bbox.south,
    east: bbox.east,
    north: bbox.north,
    ym,
  });
  const backend = await fetchBackendJson<WaitTimeBridgeResult>(
    `/api/wait-time-bridge?${qs}`
  );
  return backend ?? computeLocalWaitTimeBridge(bbox, ym);
}

export async function fetchLandsatVerify(
  bbox: Bbox,
  ym: string,
  live = false
): Promise<LandsatVerificationResult> {
  const params: Record<string, string | number> = {
    west: bbox.west,
    south: bbox.south,
    east: bbox.east,
    north: bbox.north,
    ym,
  };
  if (live) params.live = 1;
  const qs = buildQuery(params);
  const backend = await fetchBackendJson<LandsatVerificationResult>(
    `/api/landsat-verify?${qs}`
  );
  return backend ?? computeLocalLandsatVerify(bbox, ym);
}

export async function fetchResponderBrief(
  bbox: Bbox,
  ym: string,
  mode: HarmonizationMode,
  role: ResponderRole
): Promise<ResponderBriefResult> {
  const backend = await fetchBackendJson<ResponderBriefResult>('/api/brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...bbox, ym, mode, role }),
  });
  return backend ?? computeLocalBrief(bbox, ym, mode, role);
}

export async function triggerLiveFirms(
  bbox: Bbox,
  days = 3
): Promise<{
  liveFetched: boolean;
  days?: number;
  countsBySensor?: Record<string, number>;
  message?: string;
}> {
  const backend = await fetchBackendJson<{
    liveFetched: boolean;
    days?: number;
    countsBySensor?: Record<string, number>;
    message?: string;
  }>('/api/fetch-firms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...bbox, days }),
  });
  if (backend) return backend;

  return {
    liveFetched: false,
    message:
      'Public static GitHub Pages mode: using baseline harmonized ledger (run server.ts with FIRMS_MAP_KEY for live NRT polling).',
  };
}

export async function triggerStartupSync(): Promise<StartupSyncStatus> {
  const backend = await fetchBackendJson<StartupSyncStatus>(
    '/api/trigger-startup-sync',
    { method: 'POST' }
  );
  if (backend) return backend;

  const counts = await fetchPublicGithubDatasetCounts(DEFAULT_GITHUB_REPO);
  return buildStaticStartupSyncStatus(
    DEFAULT_GITHUB_REPO,
    counts.modisRows,
    counts.viirsRows
  );
}

export async function queueGithubInference(
  bbox: Bbox,
  ym: string,
  mode: HarmonizationMode,
  role: ResponderRole
): Promise<{ ok: boolean; requestId?: string; sqlitePath?: string; message?: string }> {
  const backend = await fetchBackendJson<{
    ok: boolean;
    requestId?: string;
    sqlitePath?: string;
    message?: string;
  }>('/api/github-inference/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...bbox, ym, mode, role }),
  });
  if (backend) return backend;

  return {
    ok: false,
    message:
      'Kaggle SQLite queue requires the Node/Python backend with GITHUB_TOKEN; showing fact-verified deterministic brief.',
  };
}

export async function pollGithubInferenceStatus(requestId: string): Promise<{
  answered: boolean;
  answer?: { text?: string; verifiedNumbers?: string[]; rejectedNumbers?: string[] };
} | null> {
  return fetchBackendJson(
    `/api/github-inference/status?requestId=${encodeURIComponent(requestId)}`
  );
}

function triggerBrowserDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadCsvExport(
  bbox: Bbox,
  mode: HarmonizationMode
): Promise<void> {
  const hasBackend = await isBackendAvailable();
  if (hasBackend) {
    const qs = buildQuery({
      west: bbox.west,
      south: bbox.south,
      east: bbox.east,
      north: bbox.north,
      mode,
    });
    window.location.href = `/api/hotspots.csv?${qs}`;
    return;
  }
  const analysis = computeLocalAnalyze(bbox, mode);
  const csv = toHarmonizedCsv(analysis);
  triggerBrowserDownload(
    `fireledger_${mode}_${analysis.startYm}_${analysis.endYm}.csv`,
    csv,
    'text/csv;charset=utf-8'
  );
}

export async function downloadGeoJsonExport(
  bbox: Bbox,
  ym: string
): Promise<void> {
  const hasBackend = await isBackendAvailable();
  if (hasBackend) {
    const qs = buildQuery({
      west: bbox.west,
      south: bbox.south,
      east: bbox.east,
      north: bbox.north,
      ym,
    });
    window.location.href = `/api/perimeter.geojson?${qs}`;
    return;
  }
  const bridge = computeLocalWaitTimeBridge(bbox, ym);
  const geojson = toPerimeterGeoJson(bridge);
  triggerBrowserDownload(
    `fireledger_wait_time_bridge_${ym}.geojson`,
    geojson,
    'application/geo+json;charset=utf-8'
  );
}
