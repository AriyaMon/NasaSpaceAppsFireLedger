import 'dotenv/config';
import express from 'express';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getStartupSyncStatus,
  runStartupGithubRawSync,
} from './scripts/syncGithubRawDb.ts';
import {
  buildFactLedger,
  buildMistralResponderPrompt,
  generateDeterministicResponderBrief,
  RESPONDER_ROLE_META,
  verifyBriefNumbers,
} from './src/lib/brief.ts';
import { toHarmonizedCsv, toPerimeterGeoJson } from './src/lib/exports.ts';
import {
  analyzeBbox,
  buildDailySlice,
  buildGlobeCells,
  buildLandsatVerification,
  normalizeConfidence,
} from './src/lib/harmonize.ts';
import { inferRegionName, REGION_PRESETS } from './src/lib/seedData.ts';
import type { Bbox, HarmonizationMode, ResponderRole, SensorDetection } from './src/lib/types.ts';
import { buildWaitTimeBridge } from './src/lib/waitTimeBridge.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const PORT = Number(process.env.PORT ?? 3000);
const GITHUB_REPO = normalizeGithubRepo(process.env.GITHUB_REPO);

function cleanEnv(name: string): string {
  const val = process.env[name]?.trim() || '';
  if (!val || /^(n\/a|na|none|null|my_.*|your_.*)$/i.test(val)) return '';
  return val;
}

interface LiveFirmsCacheEntry {
  fetchedAtIso: string;
  bboxKey: string;
  countsBySensor: Record<string, number>;
  landsatNrtCount: number;
  sampleRows: SensorDetection[];
}

const liveFirmsCache = new Map<string, LiveFirmsCacheEntry>();

function parseBboxQuery(q: Record<string, unknown>): Bbox {
  const west = Number(q.west ?? -68.1);
  const south = Number(q.south ?? -30.1);
  const east = Number(q.east ?? -66.7);
  const north = Number(q.north ?? -28.6);

  const validWest = Number.isFinite(west) ? Math.max(-180, Math.min(180, west)) : -68.1;
  const validEast = Number.isFinite(east) ? Math.max(-180, Math.min(180, east)) : -66.7;
  const validSouth = Number.isFinite(south) ? Math.max(-85, Math.min(85, south)) : -30.1;
  const validNorth = Number.isFinite(north) ? Math.max(-85, Math.min(85, north)) : -28.6;

  return {
    west: Math.min(validWest, validEast),
    south: Math.min(validSouth, validNorth),
    east: Math.max(validWest, validEast),
    north: Math.max(validSouth, validNorth),
  };
}

function bboxToKey(b: Bbox): string {
  return `${b.west.toFixed(2)},${b.south.toFixed(2)},${b.east.toFixed(2)},${b.north.toFixed(2)}`;
}

function parseMode(val: unknown): HarmonizationMode {
  if (val === 'raw' || val === 'dual_2012' || val === 'harmonized') return val;
  return 'harmonized';
}

function parseRole(val: unknown): ResponderRole {
  if (
    val === 'firefighting' ||
    val === 'police' ||
    val === 'ambulance' ||
    val === 'scientist' ||
    val === 'land_manager'
  ) {
    return val;
  }
  return 'firefighting';
}

function parseFirmsCsv(
  csvText: string,
  sensor: SensorDetection['sensor'],
  regionName: string
): SensorDetection[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const iLat = idx('latitude');
  const iLon = idx('longitude');
  const iDate = idx('acq_date');
  const iTime = idx('acq_time');
  const iSat = idx('satellite');
  const iConf = idx('confidence');
  const iFrp = idx('frp');
  const iDn = idx('daynight');
  const iType = idx('type');
  const iScan = idx('scan');
  const iTrack = idx('track');
  const iBright = idx('brightness') !== -1 ? idx('brightness') : idx('bright_ti4');
  const iTir = idx('bright_t31') !== -1 ? idx('bright_t31') : idx('bright_ti5');

  const out: SensorDetection[] = [];
  for (let i = 1; i < Math.min(lines.length, 400); i++) {
    const cols = lines[i].split(',');
    if (cols.length < 6) continue;
    const typeVal = iType !== -1 ? Number(cols[iType] ?? 0) : 0;
    if (typeVal !== 0) continue; // Keep vegetation fires only (type == 0)

    const rawConf = iConf !== -1 ? cols[iConf] : 'n';
    out.push({
      id: `LIVE-${sensor}-${i}`,
      sensor,
      satellite: iSat !== -1 ? cols[iSat] || sensor : sensor,
      lat: Number(cols[iLat] ?? 0),
      lon: Number(cols[iLon] ?? 0),
      acqDate: iDate !== -1 ? cols[iDate] : new Date().toISOString().slice(0, 10),
      acqTime: iTime !== -1 ? cols[iTime] : '1400',
      daynight: iDn !== -1 && cols[iDn] === 'N' ? 'N' : 'D',
      brightnessMidK: iBright !== -1 ? Number(cols[iBright] ?? 330) : 330,
      brightnessTirK: iTir !== -1 ? Number(cols[iTir] ?? 298) : 298,
      frpMw: iFrp !== -1 ? Number(cols[iFrp] ?? 15) : 15,
      confidenceNorm: normalizeConfidence(rawConf),
      rawConfidence: rawConf,
      typeCode: 0,
      scanKm: iScan !== -1 ? Number(cols[iScan] ?? 0.39) : 0.39,
      trackKm: iTrack !== -1 ? Number(cols[iTrack] ?? 0.38) : 0.38,
      biome: regionName,
      isLiveFirms: true,
    });
  }
  return out;
}

async function queryLocalMistralEndpoint(prompt: string): Promise<{ text: string; model: string } | null> {
  const url = cleanEnv('LOCAL_LLM_URL');
  const model = process.env.LOCAL_LLM_MODEL?.trim() || 'fireledger-mistral-7b';
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);
  try {
    let bodyPayload: Record<string, unknown>;
    if (url.includes('/v1/chat/completions')) {
      bodyPayload = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.15,
        max_tokens: 420,
      };
    } else if (url.endsWith('/brief')) {
      bodyPayload = { prompt, model, max_new_tokens: 420 };
    } else {
      // Ollama /api/generate default
      bodyPayload = {
        model,
        prompt,
        stream: false,
        options: { temperature: 0.15, num_predict: 420 },
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const json = (await res.json()) as Record<string, unknown>;
    const text =
      (typeof json.response === 'string' && json.response) ||
      (typeof json.brief === 'string' && json.brief) ||
      (typeof json.text === 'string' && json.text) ||
      (Array.isArray(json.choices) &&
        typeof (json.choices[0] as Record<string, unknown> & { message?: { content?: string } })?.message
          ?.content === 'string' &&
        (json.choices[0] as { message: { content: string } }).message.content) ||
      '';

    if (!text.trim()) return null;
    return { text: text.trim(), model };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'FireLedger',
      port: PORT,
      firmsConfigured: Boolean(cleanEnv('FIRMS_MAP_KEY')),
      localLlmConfigured: Boolean(cleanEnv('LOCAL_LLM_URL')),
      githubRepo: GITHUB_REPO,
    });
  });

  app.get('/api/meta', (_req, res) => {
    res.json({
      presets: REGION_PRESETS,
      startYm: '2000-11',
      endYm: '2026-10',
      firmsConfigured: Boolean(cleanEnv('FIRMS_MAP_KEY')),
      githubTokenConfigured: Boolean(cleanEnv('GITHUB_TOKEN')),
      localLlmConfigured: Boolean(cleanEnv('LOCAL_LLM_URL')),
      localLlmModel: process.env.LOCAL_LLM_MODEL || 'fireledger-mistral-7b',
      githubRepo: GITHUB_REPO,
      startupSync: getStartupSyncStatus(),
      roles: Object.entries(RESPONDER_ROLE_META).map(([id, meta]) => ({
        id,
        ...meta,
      })),
    });
  });

  app.get('/api/startup-sync-status', (_req, res) => {
    res.json(getStartupSyncStatus());
  });

  app.post('/api/trigger-startup-sync', async (_req, res) => {
    const status = await runStartupGithubRawSync();
    res.json(status);
  });

  app.get('/api/analyze', (req, res) => {
    const bbox = parseBboxQuery(req.query);
    const mode = parseMode(req.query.mode);
    const startYm = typeof req.query.startYm === 'string' ? req.query.startYm : '2000-11';
    const endYm = typeof req.query.endYm === 'string' ? req.query.endYm : '2026-10';
    const result = analyzeBbox(bbox, mode, startYm, endYm);

    const cachedLive = liveFirmsCache.get(bboxToKey(bbox));
    if (cachedLive) {
      result.dataOrigin = 'live_firms_merged';
    }
    res.json(result);
  });

  app.get('/api/daily-slice', (req, res) => {
    const bbox = parseBboxQuery(req.query);
    const mode = parseMode(req.query.mode);
    const ym = typeof req.query.ym === 'string' ? req.query.ym : '2026-07';
    const analysis = analyzeBbox(bbox, mode);
    const point = analysis.series.find((s) => s.ym === ym) ?? analysis.series[analysis.series.length - 1];
    const daily = buildDailySlice(point);
    res.json({ ym: point.ym, regionName: analysis.regionName, point, daily });
  });

  app.get('/api/globe-cells', (req, res) => {
    const ym = typeof req.query.ym === 'string' ? req.query.ym : '2026-07';
    const mode = parseMode(req.query.mode);
    const cells = buildGlobeCells(ym, mode);
    res.json({ ym, mode, cells });
  });

  app.get('/api/wait-time-bridge', (req, res) => {
    const bbox = parseBboxQuery(req.query);
    const ym = typeof req.query.ym === 'string' ? req.query.ym : '2026-07';
    const regionName = inferRegionName(bbox);
    const bridge = buildWaitTimeBridge(bbox, regionName, ym);
    res.json(bridge);
  });

  app.get('/api/landsat-verify', async (req, res) => {
    const bbox = parseBboxQuery(req.query);
    const ym = typeof req.query.ym === 'string' ? req.query.ym : '2026-07';
    const cached = liveFirmsCache.get(bboxToKey(bbox));
    let liveLandsatNrtCount = cached?.landsatNrtCount ?? 0;

    const mapKey = cleanEnv('FIRMS_MAP_KEY');
    if (mapKey && req.query.live === '1') {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5000);
        const areaStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
        const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(mapKey)}/LANDSAT_NRT/${areaStr}/5`;
        const fRes = await fetch(url, { signal: controller.signal });
        clearTimeout(t);
        if (fRes.ok) {
          const text = await fRes.text();
          const lines = text.trim().split(/\r?\n/);
          liveLandsatNrtCount = Math.max(0, lines.length - 1);
        }
      } catch {
        // Fallback to cached count cleanly
      }
    }

    const verification = buildLandsatVerification(bbox, ym, liveLandsatNrtCount);
    res.json(verification);
  });

  app.post('/api/fetch-firms', async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const bbox = parseBboxQuery(body);
    const days = Math.min(10, Math.max(1, Number(body.days ?? 3)));
    const regionName = inferRegionName(bbox);
    const mapKey = cleanEnv('FIRMS_MAP_KEY');

    if (!mapKey) {
      res.json({
        ok: false,
        liveFetched: false,
        message:
          'FIRMS_MAP_KEY is not set in server environment. Add FIRMS_MAP_KEY in Secrets or .env to query live NASA FIRMS NRT feeds; displaying validated baseline ledger.',
        countsBySensor: {},
        sampleRows: [],
      });
      return;
    }

    const areaStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
    const feeds: Array<{ apiSource: string; sensor: SensorDetection['sensor'] }> = [
      { apiSource: 'VIIRS_SNPP_NRT', sensor: 'VIIRS_SNPP' },
      { apiSource: 'VIIRS_NOAA20_NRT', sensor: 'VIIRS_N20' },
      { apiSource: 'MODIS_NRT', sensor: 'MODIS' },
      { apiSource: 'LANDSAT_NRT', sensor: 'LANDSAT9' },
    ];

    const countsBySensor: Record<string, number> = {};
    const collectedRows: SensorDetection[] = [];

    for (const feed of feeds) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(mapKey)}/${feed.apiSource}/${areaStr}/${days}`;
        const fRes = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!fRes.ok) {
          countsBySensor[feed.apiSource] = 0;
          continue;
        }
        const csv = await fRes.text();
        const parsed = parseFirmsCsv(csv, feed.sensor, regionName);
        countsBySensor[feed.apiSource] = parsed.length;
        collectedRows.push(...parsed.slice(0, 15));
      } catch {
        clearTimeout(timer);
        countsBySensor[feed.apiSource] = 0;
      }
    }

    const entry: LiveFirmsCacheEntry = {
      fetchedAtIso: new Date().toISOString(),
      bboxKey: bboxToKey(bbox),
      countsBySensor,
      landsatNrtCount: countsBySensor.LANDSAT_NRT ?? 0,
      sampleRows: collectedRows.slice(0, 30),
    };
    liveFirmsCache.set(entry.bboxKey, entry);

    res.json({
      ok: true,
      liveFetched: true,
      fetchedAtIso: entry.fetchedAtIso,
      regionName,
      days,
      countsBySensor,
      sampleRows: entry.sampleRows,
    });
  });

  app.post('/api/sync-github', async (_req, res) => {
    const token = cleanEnv('GITHUB_TOKEN');
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'FireLedger-SpaceApps-2026',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const repoRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!repoRes.ok) {
        res.json({
          ok: false,
          repo: GITHUB_REPO,
          status: repoRes.status,
          message:
            'Repository unreachable or empty. Run kaggle/1_worldwide_ingest_and_harmonize.py to publish harmonized_global_monthly.parquet and dataset_meta.json.',
        });
        return;
      }
      const repoJson = (await repoRes.json()) as {
        full_name: string;
        default_branch: string;
        pushed_at: string;
        html_url: string;
      };

      let datasetMeta: Record<string, unknown> | null = null;
      try {
        const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${repoJson.default_branch || 'main'}/dataset_meta.json`;
        const metaRes = await fetch(rawUrl, { headers });
        if (metaRes.ok) {
          datasetMeta = (await metaRes.json()) as Record<string, unknown>;
        }
      } catch {
        datasetMeta = null;
      }

      res.json({
        ok: true,
        repo: repoJson.full_name,
        htmlUrl: repoJson.html_url,
        defaultBranch: repoJson.default_branch,
        pushedAt: repoJson.pushed_at,
        hasPublishedDatasetMeta: Boolean(datasetMeta),
        datasetMeta,
      });
    } catch {
      clearTimeout(timer);
      res.json({
        ok: false,
        repo: GITHUB_REPO,
        message:
          'GitHub API network timeout; continuing with bundled multi-biome baseline ledger.',
      });
    }
  });

  app.post('/api/brief', async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const bbox = parseBboxQuery(body);
    const mode = parseMode(body.mode);
    const role = parseRole(body.role);
    const ym = typeof body.ym === 'string' ? body.ym : '2026-07';

    const analysis = analyzeBbox(bbox, mode);
    const point = analysis.series.find((s) => s.ym === ym) ?? analysis.series[analysis.series.length - 1];
    const bridge = buildWaitTimeBridge(bbox, analysis.regionName, point.ym);

    const ctx = {
      role,
      regionName: analysis.regionName,
      point,
      metrics: analysis.metrics,
      bridge,
    };

    const fallback = generateDeterministicResponderBrief(ctx);
    const prompt = buildMistralResponderPrompt(ctx);
    const llmReply = await queryLocalMistralEndpoint(prompt);

    if (llmReply) {
      const ledger = buildFactLedger(ctx);
      const check = verifyBriefNumbers(llmReply.text, ledger);
      if (check.rejectedNumbers.length === 0) {
        res.json({
          ...fallback,
          text: llmReply.text,
          source: 'local_mistral_7b',
          modelName: llmReply.model,
          verifiedNumbers: check.verifiedNumbers,
          rejectedNumbers: [],
        });
        return;
      }
      // If local LLM hallucinated any ungrounded digits, enforce deterministic verified text and flag caught tokens
      res.json({
        ...fallback,
        rejectedNumbers: check.rejectedNumbers,
        modelName: `${llmReply.model} (Hallucination blocked → Verified Fallback)`,
      });
      return;
    }

    res.json(fallback);
  });

  app.post('/api/github-inference/request', async (req, res) => {
    const token = cleanEnv('GITHUB_TOKEN');
    if (!token) {
      res.status(400).json({
        ok: false,
        message: 'Set GITHUB_TOKEN in .env to push requests into the GitHub SQL queue.',
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const bbox = parseBboxQuery(body);
    const mode = parseMode(body.mode);
    const role = parseRole(body.role);
    const ym = typeof body.ym === 'string' ? body.ym : '2026-07';

    const analysis = analyzeBbox(bbox, mode);
    const point =
      analysis.series.find((s) => s.ym === ym) ?? analysis.series[analysis.series.length - 1];
    const bridge = buildWaitTimeBridge(bbox, analysis.regionName, point.ym);
    const ctx = {
      role,
      regionName: analysis.regionName,
      point,
      metrics: analysis.metrics,
      bridge,
    };

    const requestId = `req_${Date.now()}_${role}`;
    const createdAtIso = new Date().toISOString();
    const prompt = buildMistralResponderPrompt(ctx);
    const factLedger = buildFactLedger(ctx);
    const payload = {
      requestId,
      status: 'unanswered',
      createdAtIso,
      role,
      ym: point.ym,
      regionName: analysis.regionName,
      prompt,
      factLedger,
    };

    const ghHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'FireLedger-Inference-Queue',
      'Content-Type': 'application/json',
    };

    const sqlitePath = 'database/inference_queue.sqlite';
    const tmpDb = path.join(os.tmpdir(), `fireledger_q_${Date.now()}.sqlite`);
    try {
      const repoRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
        headers: ghHeaders,
      });
      const branch = repoRes.ok
        ? ((await repoRes.json()) as { default_branch?: string }).default_branch || 'main'
        : 'main';

      // Pull existing SQLite queue if present
      let dbSha: string | undefined;
      const dbMetaRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${sqlitePath}?ref=${encodeURIComponent(branch)}`,
        { headers: ghHeaders }
      );
      if (dbMetaRes.ok) {
        const dbMeta = (await dbMetaRes.json()) as { sha?: string; content?: string; download_url?: string };
        dbSha = dbMeta.sha;
        if (dbMeta.content) {
          fs.writeFileSync(tmpDb, Buffer.from(dbMeta.content, 'base64'));
        } else if (dbMeta.download_url) {
          const dl = await fetch(dbMeta.download_url, { headers: ghHeaders });
          if (dl.ok) fs.writeFileSync(tmpDb, Buffer.from(await dl.arrayBuffer()));
        }
      }

      // Insert row tagged status='unanswered' using standard-library python3 sqlite3
      const pyInsert = `
import sqlite3, sys
db_path, req_id, created_at, role, ym, region, prompt, ledger_json = sys.argv[1:9]
with sqlite3.connect(db_path) as conn:
    conn.execute("""CREATE TABLE IF NOT EXISTS inference_requests (
        request_id TEXT PRIMARY KEY, created_at TEXT NOT NULL, role TEXT NOT NULL,
        ym TEXT NOT NULL, region_name TEXT NOT NULL, prompt TEXT NOT NULL,
        fact_ledger_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unanswered',
        response_text TEXT, verified_numbers_json TEXT, rejected_numbers_json TEXT,
        hallucination_free INTEGER, answered_at TEXT, model_name TEXT)""")
    conn.execute(
        "INSERT INTO inference_requests (request_id, created_at, role, ym, region_name, prompt, fact_ledger_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'unanswered')",
        (req_id, created_at, role, ym, region, prompt, ledger_json)
    )
    conn.commit()
`;
      execFileSync('python3', [
        '-c',
        pyInsert,
        tmpDb,
        requestId,
        createdAtIso,
        role,
        point.ym,
        analysis.regionName,
        prompt,
        JSON.stringify(factLedger),
      ]);

      const updatedDbB64 = fs.readFileSync(tmpDb).toString('base64');
      const dbBody: Record<string, string> = {
        message: `queue(sql): add unanswered request ${requestId}`,
        content: updatedDbB64,
        branch,
      };
      if (dbSha) dbBody.sha = dbSha;

      const putDbRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${sqlitePath}`,
        { method: 'PUT', headers: ghHeaders, body: JSON.stringify(dbBody) }
      );

      // Also write JSON mirror in requests/<id>.json with status: 'unanswered'
      await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/requests/${requestId}.json`,
        {
          method: 'PUT',
          headers: ghHeaders,
          body: JSON.stringify({
            message: `queue(inference): request ${role} brief for ${point.ym} [unanswered]`,
            content: Buffer.from(JSON.stringify(payload, null, 2), 'utf-8').toString('base64'),
            branch,
          }),
        }
      );

      if (!putDbRes.ok) {
        const errText = await putDbRes.text();
        res.status(502).json({
          ok: false,
          message: `GitHub API error (${putDbRes.status}): ${errText.slice(0, 140)}`,
        });
        return;
      }

      res.json({
        ok: true,
        requestId,
        status: 'unanswered',
        sqlitePath,
        requestPath: `requests/${requestId}.json`,
        responsePath: `responses/${requestId}.json`,
        branch,
      });
    } catch {
      res.status(500).json({ ok: false, message: 'Failed to submit SQL queue request to GitHub.' });
    } finally {
      if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    }
  });

  app.get('/api/github-inference/status', async (req, res) => {
    const requestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : '';
    const token = cleanEnv('GITHUB_TOKEN');
    const ghHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'FireLedger-Inference-Queue',
    };
    if (token) {
      ghHeaders.Authorization = `Bearer ${token}`;
    }

    const sqlitePath = 'database/inference_queue.sqlite';
    const tmpDb = path.join(os.tmpdir(), `fireledger_q_poll_${Date.now()}.sqlite`);
    try {
      const dbMetaRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${sqlitePath}`,
        { headers: ghHeaders }
      );
      let totalRequests = 0;
      let totalResponses = 0;
      let unansweredCount = 0;
      let answer: Record<string, unknown> | null = null;

      if (dbMetaRes.ok) {
        const dbMeta = (await dbMetaRes.json()) as { content?: string; download_url?: string };
        let gotBytes = false;
        if (dbMeta.content) {
          fs.writeFileSync(tmpDb, Buffer.from(dbMeta.content, 'base64'));
          gotBytes = true;
        } else if (dbMeta.download_url) {
          const dl = await fetch(dbMeta.download_url, { headers: ghHeaders });
          if (dl.ok) {
            fs.writeFileSync(tmpDb, Buffer.from(await dl.arrayBuffer()));
            gotBytes = true;
          }
        }
        if (gotBytes) {
          const pyRead = `
import json, sqlite3, sys
db_path, req_id = sys.argv[1:3]
with sqlite3.connect(db_path) as conn:
    conn.row_factory = sqlite3.Row
    tot = conn.execute("SELECT COUNT(*) FROM inference_requests").fetchone()[0]
    ans_cnt = conn.execute("SELECT COUNT(*) FROM inference_requests WHERE status='answered'").fetchone()[0]
    un_cnt = conn.execute("SELECT COUNT(*) FROM inference_requests WHERE status='unanswered'").fetchone()[0]
    ans = None
    if req_id:
        r = conn.execute("SELECT * FROM inference_requests WHERE request_id=?", (req_id,)).fetchone()
        if r and r["status"] == "answered" and r["response_text"]:
            ans = {
                "requestId": r["request_id"], "status": "answered", "answeredAtIso": r["answered_at"],
                "model": r["model_name"] or "fireledger-mistral-7b-qlora", "role": r["role"], "ym": r["ym"],
                "regionName": r["region_name"], "text": r["response_text"],
                "verifiedNumbers": json.loads(r["verified_numbers_json"] or "[]"),
                "rejectedNumbers": json.loads(r["rejected_numbers_json"] or "[]"),
                "hallucinationFree": bool(r["hallucination_free"]),
            }
    print(json.dumps({"totalRequests": tot, "totalResponses": ans_cnt, "unansweredCount": un_cnt, "answer": ans}))
`;
          const rawOut = execFileSync('python3', ['-c', pyRead, tmpDb, requestId], { encoding: 'utf-8' });
          const parsed = JSON.parse(rawOut) as {
            totalRequests: number;
            totalResponses: number;
            unansweredCount: number;
            answer: Record<string, unknown> | null;
          };
          totalRequests = parsed.totalRequests;
          totalResponses = parsed.totalResponses;
          unansweredCount = parsed.unansweredCount;
          answer = parsed.answer;
        }
      }

      if (requestId && !answer) {
        const ansRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/responses/${encodeURIComponent(requestId)}.json`,
          { headers: ghHeaders }
        );
        if (ansRes.ok) {
          const ansMeta = (await ansRes.json()) as { content?: string };
          if (ansMeta.content) {
            answer = JSON.parse(Buffer.from(ansMeta.content, 'base64').toString('utf-8')) as Record<
              string,
              unknown
            >;
          }
        }
      }

      res.json({
        ok: true,
        sqlitePath,
        totalRequests,
        totalResponses,
        unansweredCount,
        answered: Boolean(answer),
        answer,
      });
    } catch {
      res.json({
        ok: false,
        totalRequests: 0,
        totalResponses: 0,
        unansweredCount: 0,
        answered: false,
        answer: null,
      });
    } finally {
      if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    }
  });

  app.get('/api/hotspots.csv', (req, res) => {
    const bbox = parseBboxQuery(req.query);
    const mode = parseMode(req.query.mode);
    const analysis = analyzeBbox(bbox, mode);
    const csv = toHarmonizedCsv(analysis);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fireledger_${mode}_${analysis.startYm}_${analysis.endYm}.csv"`
    );
    res.send(csv);
  });

  app.get('/api/perimeter.geojson', (req, res) => {
    const bbox = parseBboxQuery(req.query);
    const ym = typeof req.query.ym === 'string' ? req.query.ym : '2026-07';
    const bridge = buildWaitTimeBridge(bbox, inferRegionName(bbox), ym);
    const geojson = toPerimeterGeoJson(bridge);
    res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fireledger_wait_time_bridge_${ym}.geojson"`
    );
    res.send(geojson);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FireLedger server listening on http://localhost:${PORT}`);
    setTimeout(() => {
      runStartupGithubRawSync().catch((err) =>
        console.warn('[FireLedger Startup DB Sync] Background sync warning:', err)
      );
    }, 800);
  });
}

createServer().catch((err) => {
  console.error('Failed to start FireLedger server:', err);
  process.exit(1);
});
