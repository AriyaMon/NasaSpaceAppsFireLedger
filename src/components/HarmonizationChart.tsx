import React, { useState } from 'react';
import type { HarmonizationMetrics, HarmonizationMode, MonthlyPoint } from '../lib/types.ts';

interface HarmonizationChartProps {
  series: MonthlyPoint[];
  mode: HarmonizationMode;
  metrics: HarmonizationMetrics;
  selectedYm: string;
  onSelectYm: (ym: string) => void;
}

export const HarmonizationChart: React.FC<HarmonizationChartProps> = ({
  series,
  mode,
  metrics,
  selectedYm,
  onSelectYm,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [showLandsatBand, setShowLandsatBand] = useState(true);
  const [showRawOverlay, setShowRawOverlay] = useState(true);

  if (series.length === 0) return null;

  const W = 940;
  const H = 265;
  const padL = 52;
  const padR = 16;
  const padT = 18;
  const padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const allUpperValues = series.flatMap((s) => [
    s.harmonizedCount,
    s.hi90,
    s.landsatHi,
    showRawOverlay ? s.rawCombinedCount : 0,
  ]);
  const maxY = Math.max(10, ...allUpperValues) * 1.06;

  const xOf = (i: number) =>
    padL + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const yOf = (v: number) => padT + innerH - Math.min(1, Math.max(0, v / maxY)) * innerH;

  const buildAreaPath = (loFn: (p: MonthlyPoint) => number, hiFn: (p: MonthlyPoint) => number) => {
    const top = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(hiFn(p)).toFixed(1)}`);
    const bot = [...series]
      .reverse()
      .map((p, idx) => {
        const i = series.length - 1 - idx;
        return `L${xOf(i).toFixed(1)},${yOf(loFn(p)).toFixed(1)}`;
      });
    return `${top.join(' ')} ${bot.join(' ')} Z`;
  };

  const buildLinePath = (valFn: (p: MonthlyPoint) => number) =>
    series
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(valFn(p)).toFixed(1)}`)
      .join(' ');

  const idx2012 = series.findIndex((s) => s.year >= 2012);
  const selectedIdx = series.findIndex((s) => s.ym === selectedYm);
  const activeIdx = hoverIdx ?? (selectedIdx !== -1 ? selectedIdx : series.length - 1);
  const activePt = series[activeIdx];

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));
  const yearTicks = series
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.month === 1 && s.year % 4 === 0);

  return (
    <section className="flex flex-col gap-4 border-t border-white/[0.08] pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-editorial text-xl font-medium tracking-tight text-[#f3f1ec]">
            26-Year Sensor Continuity &amp; Landsat Confidence Envelope
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-[#a19d94] tabular-nums">
            OOF R² = {metrics.r2} · MAE = {metrics.mae} · 90% Conformal Coverage ={' '}
            {metrics.coverage90Pct}% · Landsat Anchored = {metrics.landsatAnchoredCoveragePct}%
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowLandsatBand((v) => !v)}
            className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              showLandsatBand
                ? 'border-sky-400/50 bg-sky-400/12 text-sky-200'
                : 'border-white/10 bg-transparent text-[#73706a] hover:text-[#f3f1ec]'
            }`}
          >
            Landsat 8/9 CI Band
          </button>
          <button
            type="button"
            onClick={() => setShowRawOverlay((v) => !v)}
            className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              showRawOverlay
                ? 'border-[#e05a2b]/60 bg-[#e05a2b]/15 text-[#f7b199]'
                : 'border-white/10 bg-transparent text-[#73706a] hover:text-[#f3f1ec]'
            }`}
          >
            Raw 2012 Sensor Jump
          </button>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full select-none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {yTicks.map((val) => {
            const y = yOf(val);
            return (
              <g key={val}>
                <line
                  x1={padL}
                  y1={y}
                  x2={W - padR}
                  y2={y}
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth="1"
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#73706a"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                </text>
              </g>
            );
          })}

          {/* 2012 VIIRS Launch Divider */}
          {idx2012 > 0 && (
            <g>
              <line
                x1={xOf(idx2012)}
                y1={padT}
                x2={xOf(idx2012)}
                y2={H - padB}
                stroke="#60a5fa"
                strokeDasharray="4 3"
                strokeOpacity={0.55}
              />
              <text
                x={xOf(idx2012) + 5}
                y={padT + 11}
                fill="#93c5fd"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                2012 VIIRS Era →
              </text>
            </g>
          )}

          {/* 90% Conformal CI Band */}
          {mode !== 'raw' && (
            <path
              d={buildAreaPath((p) => p.lo90, (p) => p.hi90)}
              fill="rgba(229, 169, 60, 0.14)"
            />
          )}

          {/* 3rd-Satellite Landsat 8/9 CI Band */}
          {showLandsatBand && mode !== 'raw' && (
            <path
              d={buildAreaPath((p) => p.landsatLo, (p) => p.landsatHi)}
              fill="rgba(56, 189, 248, 0.16)"
            />
          )}

          {/* Raw Unharmonized Overlay (shows broken 2012 jump) */}
          {showRawOverlay && mode !== 'raw' && (
            <path
              d={buildLinePath((p) => p.rawCombinedCount)}
              fill="none"
              stroke="#e05a2b"
              strokeWidth="1.25"
              strokeDasharray="3 3"
              strokeOpacity={0.78}
            />
          )}

          {/* 26-Year Same-Calendar-Month Baseline */}
          <path
            d={buildLinePath((p) => p.medianSameMonth)}
            fill="none"
            stroke="#73706a"
            strokeWidth="1"
            strokeDasharray="2 4"
          />

          {/* Primary Harmonized / Active Line */}
          <path
            d={buildLinePath((p) => p.harmonizedCount)}
            fill="none"
            stroke={mode === 'raw' ? '#e05a2b' : '#e5a93c'}
            strokeWidth="2.1"
          />

          {yearTicks.map(({ s, i }) => (
            <text
              key={s.ym}
              x={xOf(i)}
              y={H - 10}
              textAnchor="middle"
              fill="#73706a"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              {s.year}
            </text>
          ))}

          {activePt && (
            <g>
              <line
                x1={xOf(activeIdx)}
                y1={padT}
                x2={xOf(activeIdx)}
                y2={H - padB}
                stroke="rgba(243,241,236,0.4)"
                strokeWidth="1"
              />
              <circle
                cx={xOf(activeIdx)}
                cy={yOf(activePt.harmonizedCount)}
                r="4.5"
                fill="#e5a93c"
                stroke="#090a0d"
                strokeWidth="1.5"
              />
            </g>
          )}

          <rect
            x={padL}
            y={padT}
            width={innerW}
            height={innerH}
            fill="transparent"
            className="cursor-crosshair"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const idx = Math.round(ratio * (series.length - 1));
              setHoverIdx(idx);
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const idx = Math.round(ratio * (series.length - 1));
              if (series[idx]) onSelectYm(series[idx].ym);
            }}
          />
        </svg>
      </div>

      {/* Clean Hairline Telemetry Readout Strip */}
      {activePt && (
        <div className="grid grid-cols-2 divide-y divide-white/[0.06] border-t border-white/[0.08] pt-3 font-mono tabular-nums text-xs sm:grid-cols-6 sm:divide-x sm:divide-y-0">
          <div className="pr-3">
            <span className="block text-[10px] text-[#73706a]">Inspected Month</span>
            <span className="font-medium text-[#f3f1ec]">{activePt.ym}</span>
          </div>
          <div className="px-3">
            <span className="block text-[10px] text-[#73706a]">
              {mode === 'raw' ? 'Raw Unharmonized' : 'Harmonized VIIRS-Eq'}
            </span>
            <span className="font-medium text-[#e5a93c]">
              {activePt.harmonizedCount.toLocaleString()}
            </span>
          </div>
          <div className="px-3">
            <span className="block text-[10px] text-[#73706a]">90% Conformal CI</span>
            <span className="text-[#c9c5bc]">
              {activePt.lo90.toLocaleString()}–{activePt.hi90.toLocaleString()}
            </span>
          </div>
          <div className="px-3">
            <span className="block text-[10px] text-sky-300">Landsat 8/9 3rd-Sat CI</span>
            <span className="text-sky-200">
              {activePt.landsatLo.toLocaleString()}–{activePt.landsatHi.toLocaleString()}
            </span>
          </div>
          <div className="px-3">
            <span className="block text-[10px] text-[#73706a]">vs 26-Yr Median</span>
            <span
              className={
                activePt.pctOfMedian >= 180 ? 'font-medium text-[#e05a2b]' : 'text-emerald-400'
              }
            >
              {activePt.pctOfMedian}% (Z={activePt.zScore})
            </span>
          </div>
          <div className="pl-3">
            <span className="block text-[10px] text-[#73706a]">Total FRP</span>
            <span className="text-[#c9c5bc]">{activePt.frpTotalMw.toLocaleString()} MW</span>
          </div>
        </div>
      )}
    </section>
  );
};
