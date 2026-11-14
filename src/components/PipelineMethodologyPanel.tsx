import React, { useState } from 'react';
import type { StartupSyncStatus } from '../../scripts/syncGithubRawDb.ts';
import {
  HARMONIZATION_PIPELINE_STAGES,
  SENSOR_SCHEMA_MAPPING,
} from '../lib/pipelineSpec.ts';
import type { LandsatVerificationResult } from '../lib/types.ts';

interface PipelineMethodologyPanelProps {
  landsat: LandsatVerificationResult | null;
  loadingLandsat: boolean;
  onRunLiveLandsatCheck: () => void;
  startupSync: StartupSyncStatus | null;
  triggeringSync: boolean;
  onTriggerStartupSync: () => void;
  githubRepo: string;
  firmsConfigured: boolean;
  localLlmConfigured: boolean;
  onQueueGithubRequest?: () => void;
  queuingRequest?: boolean;
  githubQueueMessage?: string | null;
}

export const PipelineMethodologyPanel: React.FC<PipelineMethodologyPanelProps> = ({
  landsat,
  loadingLandsat,
  onRunLiveLandsatCheck,
  startupSync,
  triggeringSync,
  onTriggerStartupSync,
  githubRepo,
  firmsConfigured,
  localLlmConfigured,
  onQueueGithubRequest,
  queuingRequest,
  githubQueueMessage,
}) => {
  const [copiedGee, setCopiedGee] = useState(false);

  const handleCopyGee = async () => {
    if (!landsat?.geeScript) return;
    try {
      await navigator.clipboard.writeText(landsat.geeScript);
      setCopiedGee(true);
      setTimeout(() => setCopiedGee(false), 2000);
    } catch {
      setCopiedGee(false);
    }
  };

  const syncBadgeLabel =
    startupSync?.state === 'completed'
      ? 'Synced to GitHub'
      : startupSync?.state === 'partial_local_only'
        ? 'Local Snapshot Ready (Token Needed for Push)'
        : startupSync?.state === 'syncing'
          ? 'Syncing Feeds...'
          : startupSync?.state === 'error'
            ? 'Sync Warning'
            : 'Standby';

  const syncStatusColor =
    startupSync?.state === 'completed'
      ? 'text-emerald-400'
      : startupSync?.state === 'error'
        ? 'text-rose-400'
        : 'text-amber-300';

  return (
    <div className="flex flex-col gap-10">
      {/* Section 1: 5-Stage Harmonization Pipeline Specification */}
      <section className="border-t border-white/[0.08] pt-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="font-editorial text-2xl font-medium tracking-tight text-[#f3f1ec]">
              MODIS to VIIRS Harmonization Pipeline
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#a19d94]">
              Retiring 1 km MODIS (Terra 1999, Aqua 2002) and 375 m VIIRS (Suomi NPP 2011, NOAA-20
              2017, NOAA-21 2021) differ by pixel area, thermal saturation ceiling, confidence
              encoding, swath distortion, and afternoon revisit frequency. Every record passes
              through five deterministic transformations before entering the 26-year calendar.
            </p>
          </div>
          <div className="font-mono text-xs text-[#a19d94] tabular-nums">
            Training Overlap Window · Jan 2012 – Oct 2026
          </div>
        </div>

        <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {HARMONIZATION_PIPELINE_STAGES.map((stage) => (
            <div
              key={stage.step}
              className="grid grid-cols-1 gap-4 py-5 lg:grid-cols-12 lg:items-start"
            >
              <div className="flex items-baseline gap-3 lg:col-span-4">
                <span className="font-mono text-xs text-[#e5a93c] tabular-nums">
                  0{stage.step}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#f3f1ec]">{stage.title}</h3>
                  <div className="mt-1 font-mono text-[11px] text-[#73706a]">
                    In: {stage.inputState}
                  </div>
                </div>
              </div>

              <div className="text-sm leading-relaxed text-[#c9c5bc] lg:col-span-5">
                {stage.operation}
              </div>

              <div className="flex flex-col gap-1.5 lg:col-span-3">
                <div className="border-l border-white/[0.12] pl-3 font-mono text-[11px] leading-relaxed text-sky-300">
                  {stage.mathematicalDetail}
                </div>
                <div className="pl-3 text-xs text-[#a19d94]">
                  Out: <span className="text-[#f3f1ec]">{stage.outputState}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Cross-Sensor Schema & Physical Mapping Table */}
      <section className="pt-2">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-editorial text-xl font-medium tracking-tight text-[#f3f1ec]">
            Cross-Sensor Physical Schema Mapping
          </h2>
          <span className="font-mono text-xs text-[#73706a]">
            MODIS Collection 6.1 (MCD14DL) ↔ VIIRS 375 m (VNP14IMGTDL)
          </span>
        </div>

        <div className="overflow-x-auto border-y border-white/[0.08]">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] font-mono text-[11px] text-[#73706a]">
                <th className="py-3 pr-4 font-medium">Physical Dimension</th>
                <th className="py-3 pr-4 font-medium">MODIS (1 km Retiring)</th>
                <th className="py-3 pr-4 font-medium">VIIRS (375 m Operational)</th>
                <th className="py-3 font-medium">Harmonization Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {SENSOR_SCHEMA_MAPPING.map((row) => (
                <tr key={row.concept} className="align-top">
                  <td className="py-3 pr-4 font-medium text-[#f3f1ec]">{row.concept}</td>
                  <td className="py-3 pr-4 font-mono text-[11px] text-[#e5a93c]">
                    {row.modisField}
                  </td>
                  <td className="py-3 pr-4 font-mono text-[11px] text-sky-300">
                    {row.viirsField}
                  </td>
                  <td className="py-3 text-[#c9c5bc]">{row.harmonizationRule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: Startup GitHub Raw Database Sync & 3rd-Satellite Landsat Verification */}
      <section className="grid grid-cols-1 gap-8 border-t border-white/[0.08] pt-6 lg:grid-cols-12">
        {/* Left 6 cols: Startup GitHub Raw MODIS & VIIRS Database Updater */}
        <div className="flex flex-col gap-4 lg:col-span-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-editorial text-xl font-medium tracking-tight text-[#f3f1ec]">
                Startup GitHub Raw Database Sync
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#a19d94]">
                On server startup (or via <code className="text-[#f3f1ec]">npm run sync-db</code>),
                FireLedger ingests live raw MODIS and VIIRS feeds across global fire sectors, writes
                local archival files in <code className="text-[#f3f1ec]">/data/</code>, and commits
                updated datasets into <code className="text-sky-300">{githubRepo}</code>.
              </p>
            </div>
            <button
              type="button"
              disabled={triggeringSync}
              onClick={onTriggerStartupSync}
              className="shrink-0 rounded border border-white/20 bg-[#101216] px-3 py-1.5 text-xs font-medium text-[#f3f1ec] transition-colors hover:border-[#e5a93c] disabled:opacity-50"
            >
              {triggeringSync ? 'Syncing Database...' : 'Run GitHub DB Sync Now'}
            </button>
          </div>

          <div className="grid grid-cols-2 divide-x divide-white/[0.08] border-y border-white/[0.08] py-3 font-mono tabular-nums sm:grid-cols-4">
            <div className="pr-3">
              <div className="text-[11px] text-[#73706a]">Status</div>
              <div className={`mt-0.5 text-xs font-medium ${syncStatusColor}`}>
                {syncBadgeLabel}
              </div>
            </div>
            <div className="px-3">
              <div className="text-[11px] text-[#73706a]">Raw MODIS Rows</div>
              <div className="mt-0.5 text-base font-medium text-[#f3f1ec]">
                {(startupSync?.rawModisRowCount ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="px-3">
              <div className="text-[11px] text-[#73706a]">Raw VIIRS Rows</div>
              <div className="mt-0.5 text-base font-medium text-[#f3f1ec]">
                {(startupSync?.rawViirsRowCount ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="pl-3">
              <div className="text-[11px] text-[#73706a]">Ledger Months</div>
              <div className="mt-0.5 text-base font-medium text-sky-300">
                {(startupSync?.harmonizedMonthlyRows ?? 312).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="space-y-2 bg-[#101216] p-3.5 font-mono text-[11px] leading-relaxed text-[#a19d94]">
            <div className="text-[#f3f1ec]">
              {startupSync?.message ?? 'Initializing startup database sync...'}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[#73706a]">
              <span>
                FIRMS Key:{' '}
                <span className={firmsConfigured ? 'text-emerald-400' : 'text-amber-300'}>
                  {firmsConfigured ? 'Active' : 'Missing FIRMS_MAP_KEY'}
                </span>
              </span>
              <span>
                GitHub Push Token:{' '}
                <span
                  className={
                    startupSync?.githubTokenConfigured ? 'text-emerald-400' : 'text-amber-300'
                  }
                >
                  {startupSync?.githubTokenConfigured
                    ? 'Active'
                    : 'Unset (Local /data/ Archive Only)'}
                </span>
              </span>
              <span>
                Kaggle Worker Queue:{' '}
                <span className="text-sky-300">
                  SQLite (`status = &apos;unanswered&apos; → &apos;answered&apos;`)
                </span>
              </span>
            </div>

            {startupSync?.githubFilesUpdated && startupSync.githubFilesUpdated.length > 0 && (
              <div className="border-t border-white/[0.06] pt-2 text-emerald-400">
                Committed ({startupSync.lastCommitSha?.slice(0, 7) ?? 'HEAD'}):{' '}
                {startupSync.githubFilesUpdated.join(' · ')}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
              <span>
                Kaggle Scripts: /kaggle/1_worldwide_ingest_and_harmonize.py &amp;
                2_finetune_mistral7b_responders.py
              </span>
              <div className="flex items-center gap-3">
                {onQueueGithubRequest && (
                  <button
                    type="button"
                    disabled={queuingRequest}
                    onClick={onQueueGithubRequest}
                    className="text-[#e5a93c] hover:underline disabled:opacity-50"
                  >
                    {queuingRequest ? 'Queuing SQLite...' : 'Queue Unanswered SQL Request'}
                  </button>
                )}
                <a
                  href={`https://github.com/${githubRepo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-300 hover:underline"
                >
                  Open GitHub ↗
                </a>
              </div>
            </div>
            {githubQueueMessage && (
              <div className="border-t border-white/[0.06] pt-2 text-sky-300">
                {githubQueueMessage}
              </div>
            )}
          </div>
        </div>

        {/* Right 6 cols: Landsat 8/9 30 m dNBR Verification */}
        <div className="flex flex-col gap-4 lg:col-span-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-editorial text-xl font-medium tracking-tight text-[#f3f1ec]">
                Landsat 8 & 9 Third-Satellite Verification
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#a19d94]">
                Independent 30 m thermal detections and Collection 2 Level-2 dNBR scar area anchor
                the Stage 1 temporal confidence intervals against ground truth.
              </p>
            </div>
            <button
              type="button"
              disabled={loadingLandsat}
              onClick={onRunLiveLandsatCheck}
              className="shrink-0 rounded border border-white/20 bg-[#101216] px-3 py-1.5 text-xs font-medium text-[#f3f1ec] transition-colors hover:border-sky-400 disabled:opacity-50"
            >
              {loadingLandsat ? 'Verifying...' : 'Run Landsat 8/9 Check'}
            </button>
          </div>

          {landsat ? (
            <>
              <div className="grid grid-cols-2 divide-x divide-white/[0.08] border-y border-white/[0.08] py-3 font-mono tabular-nums sm:grid-cols-4">
                <div className="pr-3">
                  <div className="text-[11px] text-[#73706a]">30 m Thermal Hits</div>
                  <div className="mt-0.5 text-base font-medium text-[#f3f1ec]">
                    {landsat.landsatDetections30m.toLocaleString()}
                  </div>
                </div>
                <div className="px-3">
                  <div className="text-[11px] text-[#73706a]">≤ 1 km Coincidence</div>
                  <div className="mt-0.5 text-base font-medium text-emerald-400">
                    {landsat.coincidenceWithin1KmPct}%
                  </div>
                </div>
                <div className="px-3">
                  <div className="text-[11px] text-[#73706a]">dNBR Scar Area</div>
                  <div className="mt-0.5 text-base font-medium text-[#e5a93c]">
                    {landsat.dnbrBurnedAreaKm2} km²
                  </div>
                </div>
                <div className="pl-3">
                  <div className="text-[11px] text-[#73706a]">Landsat 90% CI</div>
                  <div className="mt-0.5 text-xs font-medium text-sky-300">
                    {landsat.confidenceInterval90Ha[0].toLocaleString()}–
                    {landsat.confidenceInterval90Ha[1].toLocaleString()} ha
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] text-[#73706a]">
                  Google Earth Engine (GEE) Verification Script (dNBR &gt; 0.27)
                </span>
                <button
                  type="button"
                  onClick={handleCopyGee}
                  className="font-mono text-[11px] text-sky-300 hover:underline"
                >
                  {copiedGee ? 'Copied GEE Script ✓' : 'Copy GEE Script'}
                </button>
              </div>

              <pre className="max-h-52 overflow-auto border border-white/[0.08] bg-[#060709] p-3 font-mono text-[11px] leading-relaxed text-[#c9c5bc]">
                {landsat.geeScript}
              </pre>
            </>
          ) : (
            <div className="text-xs text-[#73706a]">Loading Landsat verification metrics...</div>
          )}
        </div>
      </section>
    </div>
  );
};
