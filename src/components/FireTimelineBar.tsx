import React from 'react';
import type { GlobeCell, HarmonizationMode, MonthlyPoint } from '../lib/types.ts';

export type TimelineGranularity = 'month' | 'day';

interface HistoricalLandmark {
  ym: string;
  label: string;
  presetId?: string;
}

const LANDMARKS: HistoricalLandmark[] = [
  { ym: '2001-09', label: '2001 Terra' },
  { ym: '2012-01', label: '2012 VIIRS' },
  { ym: '2015-10', label: '2015 Borneo', presetId: 'borneo' },
  { ym: '2019-12', label: '2019 Australia', presetId: 'australia' },
  { ym: '2020-09', label: '2020 California', presetId: 'california' },
  { ym: '2021-07', label: '2021 Siberia', presetId: 'siberia' },
  { ym: '2023-06', label: '2023 Québec', presetId: 'quebec' },
  { ym: '2024-09', label: '2024 Amazon', presetId: 'amazon' },
  { ym: '2026-07', label: '2026 Chilecito', presetId: 'chilecito' },
];

interface FireTimelineBarProps {
  series: MonthlyPoint[];
  selectedYm: string;
  onSelectYm: (ym: string) => void;
  granularity: TimelineGranularity;
  onChangeGranularity: (g: TimelineGranularity) => void;
  selectedDay: number;
  daysInMonth: number;
  onSelectDay: (day: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: 1 | 2 | 4;
  onChangeSpeed: (s: 1 | 2 | 4) => void;
  mode: HarmonizationMode;
  globeCells: GlobeCell[];
  onJumpLandmark?: (ym: string, presetId?: string) => void;
}

export const FireTimelineBar: React.FC<FireTimelineBarProps> = ({
  series,
  selectedYm,
  onSelectYm,
  granularity,
  onChangeGranularity,
  selectedDay,
  daysInMonth,
  onSelectDay,
  isPlaying,
  onTogglePlay,
  speed,
  onChangeSpeed,
  mode,
  globeCells,
  onJumpLandmark,
}) => {
  if (series.length === 0) return null;

  const currentIdx = Math.max(
    0,
    series.findIndex((s) => s.ym === selectedYm)
  );
  const currentPoint = series[currentIdx] ?? series[series.length - 1];
  const [yrNum, moNum] = (currentPoint?.ym || selectedYm).split('-').map(Number);

  const sensorEraLabel =
    yrNum < 2002 || (yrNum === 2002 && moNum < 7)
      ? 'MODIS Terra Only (1 km)'
      : yrNum < 2012
        ? mode === 'raw'
          ? 'MODIS Terra+Aqua Raw (1 km)'
          : 'MODIS Dual → VIIRS-Eq Calibrated'
        : yrNum < 2018
          ? 'VIIRS S-NPP (375 m) + Landsat 8'
          : yrNum < 2024
            ? 'VIIRS S-NPP + NOAA-20 + Landsat 8/9'
            : 'VIIRS S-NPP/N20/N21 + Landsat 8/9';

  const activeFireCount = globeCells.filter((c) => c.cellKind === 'fire').length;
  const activeTimestampLabel =
    granularity === 'day'
      ? `${selectedYm}-${String(selectedDay).padStart(2, '0')}`
      : selectedYm;

  const handleStep = (delta: number) => {
    if (granularity === 'month') {
      const nextIdx = Math.max(0, Math.min(series.length - 1, currentIdx + delta));
      if (series[nextIdx]) onSelectYm(series[nextIdx].ym);
    } else {
      const nextDay = Math.max(1, Math.min(daysInMonth, selectedDay + delta));
      onSelectDay(nextDay);
    }
  };

  return (
    <section
      aria-label="Global Fire Timeline Simulator"
      className="flex flex-col gap-3 rounded-md border border-white/[0.08] bg-[#101216] px-4 py-3"
    >
      {/* Top Row: Playback Controls + Scope + Active Fire Stamp */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 rounded border px-3 py-1 font-mono text-xs font-medium transition-colors ${
              isPlaying
                ? 'border-[#e05a2b] bg-[#e05a2b]/20 text-[#f7b199]'
                : 'border-[#e5a93c]/70 bg-[#e5a93c]/15 text-[#f7d083] hover:bg-[#e5a93c]/25'
            }`}
          >
            <span>{isPlaying ? '❚❚' : '▶'}</span>
            <span>{isPlaying ? 'Pause Fire Sim' : 'Simulate Fires'}</span>
          </button>

          <div className="flex items-center rounded border border-white/10 bg-[#090a0d]">
            <button
              type="button"
              onClick={() => handleStep(-1)}
              className="px-2 py-1 font-mono text-xs text-[#a19d94] hover:text-[#f3f1ec]"
              title={granularity === 'month' ? 'Previous month' : 'Previous day'}
            >
              ◀
            </button>
            <span className="border-x border-white/10 px-2.5 py-1 font-mono tabular-nums text-xs font-medium text-[#f3f1ec]">
              {activeTimestampLabel}
            </span>
            <button
              type="button"
              onClick={() => handleStep(1)}
              className="px-2 py-1 font-mono text-xs text-[#a19d94] hover:text-[#f3f1ec]"
              title={granularity === 'month' ? 'Next month' : 'Next day'}
            >
              ▶
            </button>
          </div>

          <div className="flex items-center gap-0.5 rounded border border-white/10 bg-[#090a0d] p-0.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => onChangeGranularity('month')}
              className={`rounded px-2 py-0.5 transition-colors ${
                granularity === 'month'
                  ? 'bg-white/12 text-[#f3f1ec]'
                  : 'text-[#73706a] hover:text-[#c9c5bc]'
              }`}
            >
              26-Yr Monthly
            </button>
            <button
              type="button"
              onClick={() => onChangeGranularity('day')}
              className={`rounded px-2 py-0.5 transition-colors ${
                granularity === 'day'
                  ? 'bg-sky-400/20 text-sky-200'
                  : 'text-[#73706a] hover:text-[#c9c5bc]'
              }`}
            >
              Daily Spread ({selectedYm})
            </button>
          </div>

          <div className="flex items-center gap-0.5 rounded border border-white/10 bg-[#090a0d] p-0.5 text-[11px] font-mono">
            {([1, 2, 4] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChangeSpeed(s)}
                className={`rounded px-1.5 py-0.5 transition-colors ${
                  speed === s ? 'bg-white/12 text-[#e5a93c]' : 'text-[#73706a] hover:text-[#c9c5bc]'
                }`}
                title={`Simulation speed ${s}x`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[11px]">
          <span className="text-[#a19d94]">{sensorEraLabel}</span>
          <span className="text-white/20">|</span>
          <span className="text-[#f7d083]">
            {activeFireCount.toLocaleString()} simulated fires on map
          </span>
          {currentPoint && (
            <>
              <span className="text-white/20">|</span>
              <span className="text-[#c9c5bc]">
                Sector: {currentPoint.harmonizedCount.toLocaleString()} VIIRS-Eq
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main Scrubber Track */}
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono tabular-nums text-[10px] text-[#73706a]">
          {granularity === 'month' ? series[0].ym : `${selectedYm}-01`}
        </span>
        <input
          type="range"
          aria-label="Fire simulation timeline scrubber"
          min={granularity === 'month' ? 0 : 1}
          max={granularity === 'month' ? Math.max(0, series.length - 1) : daysInMonth}
          value={granularity === 'month' ? currentIdx : selectedDay}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (granularity === 'month') {
              if (series[val]) onSelectYm(series[val].ym);
            } else {
              onSelectDay(val);
            }
          }}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-[#e5a93c]"
        />
        <span className="shrink-0 font-mono tabular-nums text-[10px] text-[#73706a]">
          {granularity === 'month'
            ? series[series.length - 1].ym
            : `${selectedYm}-${String(daysInMonth).padStart(2, '0')}`}
        </span>
      </div>

      {/* Historical Event Landmarks + Active Note */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-[#73706a]">Events:</span>
          {LANDMARKS.map((lm) => {
            const isActive = selectedYm === lm.ym;
            return (
              <button
                key={lm.ym}
                type="button"
                onClick={() => {
                  if (onJumpLandmark) {
                    onJumpLandmark(lm.ym, lm.presetId);
                  } else {
                    onSelectYm(lm.ym);
                  }
                }}
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                  isActive
                    ? 'border-[#e5a93c]/70 bg-[#e5a93c]/15 text-[#f7d083]'
                    : 'border-white/10 bg-[#090a0d] text-[#a19d94] hover:border-white/25 hover:text-[#f3f1ec]'
                }`}
              >
                {lm.label}
              </button>
            );
          })}
        </div>

        {currentPoint?.note && (
          <span className="truncate font-mono text-[10px] text-amber-300">
            {currentPoint.note}
          </span>
        )}
      </div>
    </section>
  );
};
