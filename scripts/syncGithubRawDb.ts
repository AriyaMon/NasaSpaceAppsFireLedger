import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyzeBbox } from '../src/lib/harmonize.ts';
import { BIOME_PROFILES, REGION_PRESETS } from '../src/lib/seedData.ts';

export interface StartupSyncStatus {
  state: 'idle' | 'syncing' | 'completed' | 'partial_local_only' | 'error';
  startedAtIso: string | null;
  completedAtIso: string | null;
  githubRepo: string;
  firmsKeyConfigured: boolean;
  githubTokenConfigured: boolean;
  rawModisRowCount: number;
  rawViirsRowCount: number;
  rawLandsatRowCount: number;
  harmonizedMonthlyRows: number;
  githubFilesUpdated: string[];
  lastCommitSha: string | null;
  message: string;
}

function normalizeGithubRepo(raw?: string): string {
  const s = (raw ?? '')
    .trim()
    .split('?')[0]
    .split('#')[0]
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\/(tree|blob)\/.*$/, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  return s || 'AriyaMon/NasaSpaceAppsFireLedger';
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DEFAULT_REPO = normalizeGithubRepo(process.env.GITHUB_REPO);

function cleanEnv(name: string): string {
  const val = process.env[name]?.trim() || '';
  if (!val || /^(n\/a|na|none|null|my_.*|your_.*)$/i.test(val)) return '';
  return val;
}

let currentStatus: StartupSyncStatus = {
  state: 'idle',
  startedAtIso: null,
  completedAtIso: null,
  githubRepo: DEFAULT_REPO,
  firmsKeyConfigured: Boolean(cleanEnv('FIRMS_MAP_KEY')),
  githubTokenConfigured: Boolean(cleanEnv('GITHUB_TOKEN')),
  rawModisRowCount: 0,
  rawViirsRowCount: 0,
  rawLandsatRowCount: 0,
  harmonizedMonthlyRows: 0,
  githubFilesUpdated: [],
  lastCommitSha: null,
  message: 'Waiting for startup database synchronization...',
};

export function getStartupSyncStatus(): StartupSyncStatus {
  return { ...currentStatus };
}

const MODIS_HEADER =
  'sector,source_feed,latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type';
const VIIRS_HEADER =
  'sector,source_feed,latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight,type';

function countCsvDataRows(csvText: string): number {
  const lines = csvText.trim().split(/\r?\n/);
  return Math.max(0, lines.length - 1);
}

async function fetchFirmsCsvFeed(
  mapKey: string,
  source: string,
  west: number,
  south: number,
  east: number,
  north: number,
  days = 5
): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(mapKey)}/${source}/${west},${south},${east},${north}/${days}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    return lines.slice(1);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

async function resolveDefaultBranch(repo: string, token: string): Promise<string> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'FireLedger-Startup-Sync',
      },
    });
    if (res.ok) {
      const json = (await res.json()) as { default_branch?: string };
      if (json.default_branch) return json.default_branch;
    }
  } catch {
    // Fallback to main
  }
  return 'main';
}

async function upsertFileToGitHub(
  repo: string,
  token: string,
  branch: string,
  repoPath: string,
  content: string,
  commitMessage: string
): Promise<{ ok: boolean; commitSha?: string; error?: string }> {
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${repoPath}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'FireLedger-Startup-Sync',
    'Content-Type': 'application/json',
  };

  let existingSha: string | undefined;
  try {
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
    if (getRes.ok) {
      const existingJson = (await getRes.json()) as { sha?: string };
      existingSha = existingJson.sha;
    }
  } catch {
    // Proceed to create if lookup fails
  }

  const body: Record<string, string> = {
    message: commitMessage,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
  };
  if (existingSha) {
    body.sha = existingSha;
  }

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    return { ok: false, error: `HTTP ${putRes.status}: ${errText.slice(0, 160)}` };
  }
  const putJson = (await putRes.json()) as { commit?: { sha?: string } };
  return { ok: true, commitSha: putJson.commit?.sha };
}

export async function runStartupGithubRawSync(): Promise<StartupSyncStatus> {
  const mapKey = cleanEnv('FIRMS_MAP_KEY');
  const githubToken = cleanEnv('GITHUB_TOKEN');
  const githubRepo = normalizeGithubRepo(process.env.GITHUB_REPO || DEFAULT_REPO);

  currentStatus = {
    ...currentStatus,
    state: 'syncing',
    startedAtIso: new Date().toISOString(),
    githubRepo,
    firmsKeyConfigured: Boolean(mapKey),
    githubTokenConfigured: Boolean(githubToken),
    githubFilesUpdated: [],
    message: 'Fetching raw MODIS & VIIRS detections across global sectors...',
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const modisRows: string[] = [];
  const viirsRows: string[] = [];
  let landsatCount = 0;

  if (mapKey) {
    // Query core sectors in parallel batches with bounded days for rapid startup sync
    for (const sector of BIOME_PROFILES) {
      const { west, south, east, north } = sector.bbox;
      const [mNrt, vSnpp, vN20, vN21, lNrt] = await Promise.all([
        fetchFirmsCsvFeed(mapKey, 'MODIS_NRT', west, south, east, north, 5),
        fetchFirmsCsvFeed(mapKey, 'VIIRS_SNPP_NRT', west, south, east, north, 5),
        fetchFirmsCsvFeed(mapKey, 'VIIRS_NOAA20_NRT', west, south, east, north, 5),
        fetchFirmsCsvFeed(mapKey, 'VIIRS_NOAA21_NRT', west, south, east, north, 5),
        fetchFirmsCsvFeed(mapKey, 'LANDSAT_NRT', west, south, east, north, 5),
      ]);

      for (const line of mNrt) modisRows.push(`${sector.id},MODIS_NRT,${line}`);
      for (const line of vSnpp) viirsRows.push(`${sector.id},VIIRS_SNPP_NRT,${line}`);
      for (const line of vN20) viirsRows.push(`${sector.id},VIIRS_NOAA20_NRT,${line}`);
      for (const line of vN21) viirsRows.push(`${sector.id},VIIRS_NOAA21_NRT,${line}`);
      landsatCount += lNrt.length;
    }
  }

  // Always maintain a complete local & GitHub-ready raw + harmonized snapshot
  const worldPreset = REGION_PRESETS.find((p) => p.id === 'world')!;
  const worldHarmonized = analyzeBbox(worldPreset.bbox, 'harmonized');
  const chilecitoPreset = REGION_PRESETS.find((p) => p.id === 'chilecito')!;
  const chilecitoHarmonized = analyzeBbox(chilecitoPreset.bbox, 'harmonized');

  const modisCsv = [MODIS_HEADER, ...modisRows.slice(0, 4000)].join('\n');
  const viirsCsv = [VIIRS_HEADER, ...viirsRows.slice(0, 6000)].join('\n');

  const metaPayload = {
    updatedAtIso: new Date().toISOString(),
    repo: githubRepo,
    rawModisRowsSynced: countCsvDataRows(modisCsv),
    rawViirsRowsSynced: countCsvDataRows(viirsCsv),
    rawLandsatNrtRowsSynced: landsatCount,
    harmonizedGlobalMonths: worldHarmonized.series.length,
    pipelineVersion: 'FireLedger-2026.1',
    sensorsIncluded: ['MODIS (Terra/Aqua 1 km)', 'VIIRS (S-NPP/NOAA-20/NOAA-21 375 m)', 'Landsat 8/9 (30 m)'],
    harmonizationSummary: {
      oofR2: worldHarmonized.metrics.r2,
      conformalCoverage90Pct: worldHarmonized.metrics.coverage90Pct,
      landsatAnchoredCoveragePct: worldHarmonized.metrics.landsatAnchoredCoveragePct,
    },
  };

  const ledgerPayload = {
    meta: metaPayload,
    chilecitoAct356: chilecitoHarmonized.series.slice(-24),
    globalMonthlySummary: worldHarmonized.series,
  };

  fs.writeFileSync(path.join(DATA_DIR, 'raw_modis_detections.csv'), modisCsv, 'utf-8');
  fs.writeFileSync(path.join(DATA_DIR, 'raw_viirs_detections.csv'), viirsCsv, 'utf-8');
  fs.writeFileSync(
    path.join(DATA_DIR, 'harmonized_monthly_ledger.json'),
    JSON.stringify(ledgerPayload, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'dataset_meta.json'),
    JSON.stringify(metaPayload, null, 2),
    'utf-8'
  );

  const updatedFiles: string[] = [];
  let lastSha: string | null = null;
  let githubErrorMsg: string | null = null;

  if (githubToken) {
    const targetBranch = await resolveDefaultBranch(githubRepo, githubToken);
    const commitStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const uploads: Array<[string, string]> = [
      ['database/dataset_meta.json', JSON.stringify(metaPayload, null, 2)],
      ['database/raw_modis_detections.csv', modisCsv],
      ['database/raw_viirs_detections.csv', viirsCsv],
      ['database/harmonized_monthly_ledger.json', JSON.stringify(ledgerPayload, null, 2)],
    ];

    for (const [repoPath, content] of uploads) {
      const res = await upsertFileToGitHub(
        githubRepo,
        githubToken,
        targetBranch,
        repoPath,
        content,
        `chore(db): sync raw MODIS/VIIRS & harmonized ledger (${commitStamp} UTC)`
      );
      if (res.ok) {
        updatedFiles.push(repoPath);
        if (res.commitSha) lastSha = res.commitSha;
      } else {
        githubErrorMsg = res.error ?? 'Unknown GitHub API error';
      }
    }
  }

  const finalState: StartupSyncStatus['state'] = !githubToken
    ? 'partial_local_only'
    : githubErrorMsg && updatedFiles.length === 0
      ? 'error'
      : 'completed';

  const summaryMessage =
    finalState === 'completed'
      ? `Synced ${metaPayload.rawModisRowsSynced} raw MODIS + ${metaPayload.rawViirsRowsSynced} raw VIIRS rows & updated ${updatedFiles.length} files on ${githubRepo}.`
      : finalState === 'partial_local_only'
        ? `Saved raw MODIS (${metaPayload.rawModisRowsSynced} rows) & VIIRS (${metaPayload.rawViirsRowsSynced} rows) locally in /data/. Set GITHUB_TOKEN in .env to auto-push to ${githubRepo}.`
        : `Local /data/ updated; GitHub push error: ${githubErrorMsg}`;

  currentStatus = {
    state: finalState,
    startedAtIso: currentStatus.startedAtIso,
    completedAtIso: new Date().toISOString(),
    githubRepo,
    firmsKeyConfigured: Boolean(mapKey),
    githubTokenConfigured: Boolean(githubToken),
    rawModisRowCount: metaPayload.rawModisRowsSynced,
    rawViirsRowCount: metaPayload.rawViirsRowsSynced,
    rawLandsatRowCount: landsatCount,
    harmonizedMonthlyRows: worldHarmonized.series.length,
    githubFilesUpdated: updatedFiles,
    lastCommitSha: lastSha,
    message: summaryMessage,
  };

  console.log(`[FireLedger Startup DB Sync] ${summaryMessage}`);
  return currentStatus;
}

// Allow direct CLI execution: `npm run sync-db`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runStartupGithubRawSync()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Startup GitHub sync failed:', err);
      process.exit(1);
    });
}
