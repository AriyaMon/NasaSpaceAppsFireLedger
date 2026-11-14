import React, { useRef, useState } from 'react';
import type { Bbox, GlobeCell } from '../lib/types.ts';

interface RegionSelector2DProps {
  bbox: Bbox;
  cells: GlobeCell[];
  onApplyBbox: (next: Bbox, label?: string) => void;
}

export const RegionSelector2D: React.FC<RegionSelector2DProps> = ({
  bbox,
  cells,
  onApplyBbox,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragStart, setDragStart] = useState<{ lon: number; lat: number } | null>(null);
  const [dragCurr, setDragCurr] = useState<{ lon: number; lat: number } | null>(null);

  const [westIn, setWestIn] = useState(String(bbox.west));
  const [southIn, setSouthIn] = useState(String(bbox.south));
  const [eastIn, setEastIn] = useState(String(bbox.east));
  const [northIn, setNorthIn] = useState(String(bbox.north));

  React.useEffect(() => {
    setWestIn(String(bbox.west));
    setSouthIn(String(bbox.south));
    setEastIn(String(bbox.east));
    setNorthIn(String(bbox.north));
  }, [bbox.west, bbox.south, bbox.east, bbox.north]);

  const toCoords = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { lon: 0, lat: 0 };
    const rect = svg.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return {
      lon: Number((-180 + nx * 360).toFixed(2)),
      lat: Number((85 - ny * 155).toFixed(2)),
    };
  };

  const lonToX = (lon: number) => ((lon + 180) / 360) * 720;
  const latToY = (lat: number) => ((85 - Math.max(-70, Math.min(85, lat))) / 155) * 310;

  const activeBox: Bbox =
    dragStart && dragCurr
      ? {
          west: Math.min(dragStart.lon, dragCurr.lon),
          east: Math.max(dragStart.lon, dragCurr.lon),
          south: Math.min(dragStart.lat, dragCurr.lat),
          north: Math.max(dragStart.lat, dragCurr.lat),
        }
      : bbox;

  const rectX = lonToX(activeBox.west);
  const rectY = latToY(activeBox.north);
  const rectW = Math.max(4, lonToX(activeBox.east) - rectX);
  const rectH = Math.max(4, latToY(activeBox.south) - rectY);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = Number(westIn);
    const s = Number(southIn);
    const ea = Number(eastIn);
    const n = Number(northIn);
    if ([w, s, ea, n].every(Number.isFinite)) {
      onApplyBbox({
        west: Math.max(-180, Math.min(w, ea)),
        east: Math.min(180, Math.max(w, ea)),
        south: Math.max(-85, Math.min(s, n)),
        north: Math.min(85, Math.max(s, n)),
      });
    }
  };

  return (
    <div className="flex h-full flex-col justify-between gap-3 rounded-md border border-white/[0.08] bg-[#101216] p-3.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[#f3f1ec]">
          Equirectangular Bounding-Box Selector (Drag Rectangle)
        </span>
        <span className="font-mono tabular-nums text-[11px] text-[#a19d94]">
          [{bbox.west.toFixed(1)}°, {bbox.south.toFixed(1)}°] → [{bbox.east.toFixed(1)}°,{' '}
          {bbox.north.toFixed(1)}°]
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 720 310"
        className="w-full cursor-crosshair select-none rounded border border-white/[0.08] bg-[#060709]"
        onPointerDown={(e) => {
          const pt = toCoords(e);
          setDragStart(pt);
          setDragCurr(pt);
        }}
        onPointerMove={(e) => {
          if (dragStart) setDragCurr(toCoords(e));
        }}
        onPointerUp={() => {
          if (dragStart && dragCurr) {
            const w = Math.min(dragStart.lon, dragCurr.lon);
            const ea = Math.max(dragStart.lon, dragCurr.lon);
            const s = Math.min(dragStart.lat, dragCurr.lat);
            const n = Math.max(dragStart.lat, dragCurr.lat);
            if (ea - w >= 1.5 && n - s >= 1.5) {
              onApplyBbox({ west: w, south: s, east: ea, north: n });
            }
          }
          setDragStart(null);
          setDragCurr(null);
        }}
      >
        {[-120, -60, 0, 60, 120].map((lon) => (
          <line
            key={lon}
            x1={lonToX(lon)}
            y1={0}
            x2={lonToX(lon)}
            y2={310}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}
        {[-30, 0, 30, 60].map((lat) => (
          <line
            key={lat}
            x1={0}
            y1={latToY(lat)}
            x2={720}
            y2={latToY(lat)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}

        <path
          d="M24,42 L100,32 L210,36 L250,58 L230,96 L195,124 L170,136 L195,152 L215,172 L245,190 L225,250 L205,285 L188,242 L182,190 L165,154 L118,125 L80,95 L32,68 Z"
          fill="#1b2029"
          stroke="#2d3544"
        />
        <path
          d="M342,58 L415,44 L480,38 L665,42 L700,66 L645,108 L595,134 L558,158 L525,150 L500,174 L484,142 L440,126 L418,136 L426,162 L442,196 L422,248 L394,252 L382,202 L364,174 L336,162 L338,128 L368,118 L350,94 Z"
          fill="#1b2029"
          stroke="#2d3544"
        />
        <path
          d="M578,195 L635,192 L658,218 L645,252 L590,248 L570,224 Z"
          fill="#1b2029"
          stroke="#2d3544"
        />

        {cells.map((c) => (
          <circle
            key={c.id}
            cx={lonToX(c.lon)}
            cy={latToY(c.lat)}
            r={c.anomalyScore >= 2 ? 5 : 3.2}
            fill={c.anomalyScore >= 2 ? '#e05a2b' : '#e5a93c'}
            fillOpacity={0.85}
          />
        ))}

        <rect
          x={rectX}
          y={rectY}
          width={rectW}
          height={rectH}
          fill="rgba(56, 189, 248, 0.14)"
          stroke="#38bdf8"
          strokeWidth="2"
        />
      </svg>

      <form onSubmit={handleManualSubmit} className="grid grid-cols-5 gap-2 text-xs">
        <label className="flex flex-col gap-1 text-[10px] font-mono text-[#73706a]">
          West
          <input
            type="number"
            step="0.1"
            value={westIn}
            onChange={(e) => setWestIn(e.target.value)}
            className="rounded border border-white/15 bg-[#090a0d] px-2 py-1 font-mono text-[#f3f1ec]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-mono text-[#73706a]">
          South
          <input
            type="number"
            step="0.1"
            value={southIn}
            onChange={(e) => setSouthIn(e.target.value)}
            className="rounded border border-white/15 bg-[#090a0d] px-2 py-1 font-mono text-[#f3f1ec]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-mono text-[#73706a]">
          East
          <input
            type="number"
            step="0.1"
            value={eastIn}
            onChange={(e) => setEastIn(e.target.value)}
            className="rounded border border-white/15 bg-[#090a0d] px-2 py-1 font-mono text-[#f3f1ec]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-mono text-[#73706a]">
          North
          <input
            type="number"
            step="0.1"
            value={northIn}
            onChange={(e) => setNorthIn(e.target.value)}
            className="rounded border border-white/15 bg-[#090a0d] px-2 py-1 font-mono text-[#f3f1ec]"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded border border-white/20 bg-[#090a0d] px-2 py-1 font-mono text-xs font-medium text-[#f3f1ec] hover:border-sky-400"
          >
            Apply AOI
          </button>
        </div>
      </form>
    </div>
  );
};
