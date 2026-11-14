import React, { useState } from 'react';
import type { WaitTimeBridgeResult } from '../lib/types.ts';

interface WaitTimeBridgeViewProps {
  bridge: WaitTimeBridgeResult | null;
  loading: boolean;
  onDownloadGeoJson: () => void;
}

export const WaitTimeBridgeView: React.FC<WaitTimeBridgeViewProps> = ({
  bridge,
  loading,
  onDownloadGeoJson,
}) => {
  const [showModis, setShowModis] = useState(true);
  const [showBurnPoly, setShowBurnPoly] = useState(true);
  const [showWindCone, setShowWindCone] = useState(true);
  const [showLandsat, setShowLandsat] = useState(true);

  if (loading || !bridge) {
    return (
      <div className="border-t border-white/[0.08] py-8 text-sm text-[#a19d94]">
        Computing 375 m spatial super-resolution grid &amp; 24 h downwind spread cone...
      </div>
    );
  }

  const size = 480;
  const cellW = size / bridge.gridCols;
  const cellH = size / bridge.gridRows;

  const lats = bridge.gridCells.map((c) => c.lat);
  const lons = bridge.gridCells.map((c) => c.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const projectLon = (lon: number) =>
    ((lon - minLon) / Math.max(0.001, maxLon - minLon)) * (size - cellW) + cellW / 2;
  const projectLat = (lat: number) =>
    ((maxLat - lat) / Math.max(0.001, maxLat - minLat)) * (size - cellH) + cellH / 2;

  const ringToPoints = (coords: number[][]) =>
    coords.map(([lon, lat]) => `${projectLon(lon).toFixed(1)},${projectLat(lat).toFixed(1)}`).join(' ');

  const burnFeature = bridge.perimeterGeoJson.features[0];
  const coneFeature = bridge.perimeterGeoJson.features[1];
  const burnRing =
    burnFeature?.geometry.type === 'Polygon'
      ? (burnFeature.geometry.coordinates as number[][][])[0]
      : [];
  const coneRing =
    coneFeature?.geometry.type === 'Polygon'
      ? (coneFeature.geometry.coordinates as number[][][])[0]
      : [];

  return (
    <div className="grid grid-cols-1 gap-8 border-t border-white/[0.08] pt-6 lg:grid-cols-12">
      {/* Left 7 cols: Spatial 375 m Super-Res Stage */}
      <div className="flex flex-col gap-4 lg:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-editorial text-xl font-medium tracking-tight text-[#f3f1ec]">
              {bridge.title}
            </h2>
            <p className="mt-0.5 text-xs text-[#a19d94]">
              Optical Wait-Time Bridge ({bridge.caseId}) · {bridge.acqWindow}
            </p>
          </div>

          <button
            type="button"
            onClick={onDownloadGeoJson}
            className="rounded border border-white/20 bg-[#101216] px-3 py-1.5 font-mono text-xs text-[#f3f1ec] transition-colors hover:border-sky-300"
          >
            Download GeoJSON Perimeter
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowModis((v) => !v)}
            className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              showModis
                ? 'border-[#e5a93c]/60 bg-[#e5a93c]/15 text-[#f7d083]'
                : 'border-white/10 text-[#73706a]'
            }`}
          >
            1 km MODIS Anchors ({bridge.modis1kmCount})
          </button>
          <button
            type="button"
            onClick={() => setShowBurnPoly((v) => !v)}
            className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              showBurnPoly
                ? 'border-[#e05a2b]/60 bg-[#e05a2b]/15 text-[#f7b199]'
                : 'border-white/10 text-[#73706a]'
            }`}
          >
            Day-1 Scar Polygon
          </button>
          <button
            type="button"
            onClick={() => setShowWindCone((v) => !v)}
            className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              showWindCone
                ? 'border-orange-400/60 bg-orange-400/15 text-orange-200'
                : 'border-white/10 text-[#73706a]'
            }`}
          >
            24 h Wind Cone
          </button>
          <button
            type="button"
            onClick={() => setShowLandsat((v) => !v)}
            className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              showLandsat
                ? 'border-sky-400/60 bg-sky-400/15 text-sky-200'
                : 'border-white/10 text-[#73706a]'
            }`}
          >
            Landsat 9 30 m Footprint
          </button>
        </div>

        <div className="flex justify-center border border-white/[0.08] bg-[#060709] p-3">
          <svg viewBox={`0 0 ${size} ${size}`} className="max-h-[430px] w-full max-w-[460px]">
            {bridge.gridCells.map((cell) => {
              const x = cell.col * cellW;
              const y = cell.row * cellH;
              const heatAlpha = Math.min(0.92, cell.viirsDensity * 0.9);
              return (
                <g key={`${cell.row}-${cell.col}`}>
                  <rect
                    x={x}
                    y={y}
                    width={cellW - 0.8}
                    height={cellH - 0.8}
                    fill={
                      cell.viirsDensity > 0.12
                        ? `rgba(224, 90, 43, ${heatAlpha.toFixed(2)})`
                        : 'rgba(18, 20, 26, 0.85)'
                    }
                    stroke="#090a0d"
                    strokeWidth="0.6"
                  />
                  {showLandsat && cell.landsatBurnedFlag && (
                    <rect
                      x={x + 2}
                      y={y + 2}
                      width={cellW - 4.8}
                      height={cellH - 4.8}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="0.8"
                      strokeOpacity={0.55}
                    />
                  )}
                  {showModis && cell.modisRawFlag && (
                    <rect
                      x={x + 3}
                      y={y + 3}
                      width={cellW - 6}
                      height={cellH - 6}
                      fill="#e5a93c"
                      fillOpacity={0.92}
                      stroke="#451a03"
                      strokeWidth="1"
                    />
                  )}
                </g>
              );
            })}

            {showWindCone && coneRing.length > 0 && (
              <polygon
                points={ringToPoints(coneRing)}
                fill="rgba(251, 146, 60, 0.15)"
                stroke="#fb923c"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            )}

            {showBurnPoly && burnRing.length > 0 && (
              <polygon
                points={ringToPoints(burnRing)}
                fill="rgba(224, 90, 43, 0.12)"
                stroke="#e05a2b"
                strokeWidth="2.4"
              />
            )}

            {showWindCone && (
              <g>
                <defs>
                  <marker
                    id="windArrowHead"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L7,3 z" fill="#fb923c" />
                  </marker>
                </defs>
                <line
                  x1={size * 0.5}
                  y1={size * 0.5}
                  x2={
                    size * 0.5 +
                    Math.sin((bridge.windDirectionDeg * Math.PI) / 180) * (size * 0.28)
                  }
                  y2={
                    size * 0.5 -
                    Math.cos((bridge.windDirectionDeg * Math.PI) / 180) * (size * 0.28)
                  }
                  stroke="#fb923c"
                  strokeWidth="2"
                  markerEnd="url(#windArrowHead)"
                />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Right 5 cols: Operational Metrics */}
      <div className="flex flex-col justify-between gap-6 border-t border-white/[0.08] pt-4 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="font-editorial text-lg font-medium text-[#f3f1ec]">
              Day-1 Spatial Perimeter Metrics
            </h3>
            <p className="mt-0.5 text-xs text-[#a19d94]">
              Stage 2 U-Net super-resolution bridging coarse 1 km MODIS onto 375 m tactical scale
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-y border-white/[0.08] py-4 font-mono tabular-nums">
            <div>
              <div className="text-[11px] text-[#73706a]">Day-1 Estimated Scar</div>
              <div className="mt-0.5 text-2xl font-semibold text-[#e05a2b]">
                {bridge.predictedBurnedHa.toLocaleString()}{' '}
                <span className="text-xs font-normal text-[#a19d94]">ha</span>
              </div>
              <div className="text-[11px] text-[#a19d94]">
                90% CI: {bridge.predictedBurnedLoHa.toLocaleString()}–
                {bridge.predictedBurnedHiHa.toLocaleString()} ha
              </div>
            </div>

            <div>
              <div className="text-[11px] text-[#73706a]">Landsat 9 30 m Check</div>
              <div className="mt-0.5 text-2xl font-semibold text-sky-300">
                {bridge.landsatValidationHa.toLocaleString()}{' '}
                <span className="text-xs font-normal text-[#a19d94]">ha</span>
              </div>
              <div className="text-[11px] text-emerald-400">
                {bridge.landsatAgreementPct}% spatial IoU match
              </div>
            </div>

            <div>
              <div className="text-[11px] text-[#73706a]">Resolution Upscaling</div>
              <div className="mt-0.5 text-sm font-medium text-[#e5a93c]">
                {bridge.modis1kmCount} MODIS → {bridge.viirs375mPredictedCount} 375 m
              </div>
            </div>

            <div>
              <div className="text-[11px] text-[#73706a]">Wind &amp; Terrain Slope</div>
              <div className="mt-0.5 text-sm font-medium text-[#f3f1ec]">
                {bridge.windSpeedKmh} km/h · {bridge.slopeMeanDeg}°
              </div>
              <div className="text-[11px] text-[#a19d94]">{bridge.windDirectionLabel}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="text-xs font-semibold text-[#f3f1ec]">
              Operational Bridge Highlights
            </div>
            <ul className="space-y-2.5 text-xs leading-relaxed text-[#c9c5bc]">
              {bridge.summaryPoints.map((pt, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="font-mono text-[#e5a93c]">0{i + 1}</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/[0.08] pt-3 font-mono text-[11px] text-[#a19d94]">
          Location: <span className="text-[#f3f1ec]">{bridge.location}</span>
          <br />
          Wait-Time Saved:{' '}
          <span className="text-emerald-400">{bridge.opticalWaitHours} hours</span> ahead of
          clear-sky optical pass
        </div>
      </div>
    </div>
  );
};
