import React from 'react';
import type { ColorRamp, DailySlicePoint, MonthlyPoint } from '../lib/types.ts';

interface BurningCalendarProps {
  series: MonthlyPoint[];
  selectedYm: string;
  onSelectYm: (ym: string) => void;
  colorRamp: ColorRamp;
  onChangeRamp: (ramp: ColorRamp) => void;
  dailySlice: DailySlicePoint[];
  regionName: string;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function interpolateStops(t: number, stops: Array<[number, number, number]>): string {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;
  const a = stops[idx];
  const b = stops[Math.min(stops.length - 1, idx + 1)];
  const r = Math.round(a[0] + (b[0] - a[0]) * frac);
  const g = Math.round(a[1] + (b[1] - a[1]) * frac);
  const bl = Math.round(a[2] + (b[2] - a[2]) * frac);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function rampColor(t: number, ramp: ColorRamp): string {
  if (ramp === 'viridis') {
    return interpolateStops(t, [
      [28, 18, 56],
      [59, 82, 139],
      [33, 145, 140],
      [94, 201, 98],
      [253, 231, 37],
    ]);
  }
  if (ramp === 'cividis') {
    return interpolateStops(t, [
      [0, 32, 76],
      [44, 68, 108],
      [112, 113, 114],
      [189, 174, 102],
      [253, 234, 69],
    ]);
  }
  return interpolateStops(t, [
    [15, 11, 34],
    [87, 16, 110],
    [187, 55, 84],
    [249, 142, 9],
    [252, 255, 164],
  ]);
}

export const BurningCalendar: React.FC<BurningCalendarProps> = ({
  series,
  selectedYm,
  onSelectYm,
  colorRamp,
  onChangeRamp,
  dailySlice,
  regionName,
}) => {
  const byYm = new Map<string, MonthlyPoint>();
  for (const pt of series) byYm.set(pt.ym, pt);

  const years = Array.from(new Set(series.map((s) => s.year))).sort((a, b) => a - b);
  const maxVal = Math.max(10, ...series.map((s) => s.harmonizedCount));
  const selectedPt = byYm.get(selectedYm) ?? series[series.length - 1];
  const maxDaily = Math.max(1, ...dailySlice.map((d) => d.harmonizedCount));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <h2 className="font-editorial text-xl font-medium tracking-tight text-[#f3f1ec]">
            2000–2026 Burning Activity Calendar
          </h2>
          <p className="mt-0.5 text-xs text-[#a19d94]">
            {regionName} · Select any cell to inspect daily fire tempo, Landsat CI &amp; responder brief
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="mr-1 font-mono text-[11px] text-[#73706a]">Scale</span>
          {(['inferno', 'viridis', 'cividis'] as ColorRamp[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onChangeRamp(r)}
              className={`rounded border px-2.5 py-1 font-mono text-[11px] capitalize transition-colors ${
                colorRamp === r
                  ? 'border-[#e5a93c]/70 bg-[#e5a93c]/15 text-[#f7d083]'
                  : 'border-white/10 bg-[#101216] text-[#a19d94] hover:text-[#f3f1ec]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Matrix */}
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="mb-1.5 grid grid-cols-[54px_repeat(12,minmax(0,1fr))] gap-1 text-center font-mono text-[11px] text-[#73706a]">
            <div className="text-left">Year</div>
            {MONTH_LABELS.map((m) => (
              <div key={m}>{m}</div>
            ))}
          </div>

          <div className="flex flex-col gap-0.5">
            {years.map((yr) => (
              <div
                key={yr}
                className="grid grid-cols-[54px_repeat(12,minmax(0,1fr))] items-center gap-0.5"
              >
                <div className="font-mono tabular-nums text-[10px] text-[#a19d94]">
                  {yr}
                  {yr === 2012 && (
                    <span className="ml-1 text-[9px] text-sky-300" title="VIIRS era begins">
                      ★
                    </span>
                  )}
                </div>

                {Array.from({ length: 12 }, (_, idx) => {
                  const mo = idx + 1;
                  const ym = `${yr}-${String(mo).padStart(2, '0')}`;
                  const pt = byYm.get(ym);
                  if (!pt) {
                    return (
                      <div
                        key={ym}
                        className="h-4.5 rounded-[2px] border border-white/[0.04] bg-[#101216]"
                        title={`${ym}: No orbital coverage`}
                      />
                    );
                  }

                  const t = Math.pow(pt.harmonizedCount / maxVal, 0.52);
                  const bg = rampColor(t, colorRamp);
                  const isSelected = ym === selectedYm;
                  const isModisCalibrated = pt.source === 'modis_translated' || pt.source === 'modis_raw';
                  const isHighAnomaly = pt.anomaly === 'high';

                  return (
                    <button
                      key={ym}
                      type="button"
                      onClick={() => onSelectYm(ym)}
                      style={{ backgroundColor: bg }}
                      title={`${ym} | ${pt.harmonizedCount.toLocaleString()} VIIRS-Eq (${pt.pctOfMedian}% of 26-yr median) | Landsat CI: ${pt.landsatLo}–${pt.landsatHi}`}
                      className={`relative flex h-4.5 items-center justify-center rounded-[2px] text-[9px] font-mono tabular-nums transition-transform hover:scale-105 ${
                        isSelected
                          ? 'ring-2 ring-[#f3f1ec] ring-offset-1 ring-offset-[#090a0d]'
                          : isModisCalibrated
                            ? 'border border-dashed border-white/30'
                            : 'border border-black/30'
                      }`}
                    >
                      {isHighAnomaly && (
                        <span
                          className="font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
                          style={{ color: t > 0.65 ? '#090a0d' : '#fef08a' }}
                        >
                          ▲
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Colorbar & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-3 text-[11px] font-mono text-[#73706a]">
        <div className="flex items-center gap-2">
          <span>0</span>
          <div
            className="h-2.5 w-36 rounded-sm border border-white/15"
            style={{
              background: `linear-gradient(90deg, ${rampColor(0, colorRamp)}, ${rampColor(0.33, colorRamp)}, ${rampColor(0.66, colorRamp)}, ${rampColor(1, colorRamp)})`,
            }}
          />
          <span className="tabular-nums text-[#a19d94]">{maxVal.toLocaleString()} VIIRS-Eq</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span>Dashed = MODIS Translated (2000–2011)</span>
          <span>·</span>
          <span>★ 2012 = VIIRS Era</span>
          <span>·</span>
          <span className="text-[#e5a93c]">▲ Extreme Anomaly (≥2.1σ)</span>
        </div>
      </div>

      {/* Daily Drill-Down Strip */}
      {selectedPt && dailySlice.length > 0 && (
        <div className="border-t border-white/[0.08] pt-4">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="font-mono text-[#f3f1ec]">
              Daily Resolution · {selectedPt.ym} ({selectedPt.harmonizedCount.toLocaleString()} VIIRS-Eq ·{' '}
              {selectedPt.pctOfMedian}% of 26-yr baseline)
            </div>
            <div className="font-mono tabular-nums text-[11px] text-[#a19d94]">
              90% CI: {selectedPt.lo90.toLocaleString()}–{selectedPt.hi90.toLocaleString()} · Landsat CI:{' '}
              {selectedPt.landsatLo.toLocaleString()}–{selectedPt.landsatHi.toLocaleString()}
            </div>
          </div>

          <div className="flex h-16 items-end gap-1">
            {dailySlice.map((d) => {
              const hPct = Math.max(8, Math.round((d.harmonizedCount / maxDaily) * 100));
              return (
                <div
                  key={d.day}
                  className="group relative flex flex-1 flex-col items-center justify-end"
                  style={{ height: '100%' }}
                  title={`${d.dateStr}: ${d.harmonizedCount} VIIRS-Eq (Landsat CI: ${d.landsatLo}–${d.landsatHi}) · ${d.frpMw} MW`}
                >
                  <div
                    className={`w-full rounded-t-[2px] transition-colors ${
                      d.isAnomaly
                        ? 'bg-[#e05a2b] group-hover:bg-[#f0764c]'
                        : 'bg-[#e5a93c]/75 group-hover:bg-sky-300'
                    }`}
                    style={{ height: `${hPct}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-[#73706a]">
            <span>Day 1</span>
            <span>Day 10</span>
            <span>Day 20</span>
            <span>Day {dailySlice.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};
