import * as satellite from "satellite.js";

// Swath widths are approximate instrument scan widths (not guaranteed usable fire coverage).
// Suomi NPP VIIRS ceased delivering new FIRMS observations on 2026-11-02.
export const SATELLITES = Object.freeze([
  { id: "terra", name: "Terra", norad: 25994, sensor: "MODIS", swathKm: 2330, source: "MODIS_NRT", operational: true, note: "End of science expected February 2027; verify current mission status" },
  { id: "aqua", name: "Aqua", norad: 27424, sensor: "MODIS", swathKm: 2330, source: "MODIS_NRT", operational: true, note: "End of science expected September 2027; verify current mission status" },
  { id: "snpp", name: "Suomi NPP", norad: 37849, sensor: "VIIRS", swathKm: 3040, source: "VIIRS_SNPP_NRT", operational: false, note: "New FIRMS VIIRS data ended November 2, 2026" },
  { id: "noaa20", name: "NOAA-20", norad: 43013, sensor: "VIIRS", swathKm: 3040, source: "VIIRS_NOAA20_NRT", operational: true, note: "Operational; verify data status before deployment" },
  { id: "noaa21", name: "NOAA-21", norad: 54234, sensor: "VIIRS", swathKm: 3040, source: "VIIRS_NOAA21_NRT", operational: true, note: "Operational; verify data status before deployment" }
]);
const RAD = Math.PI / 180;
const normLon = lon => ((lon + 540) % 360) - 180;
export const isFresh = (date, now = new Date(), maxDays = 7) => Number.isFinite(+date) && Math.abs(now - date) <= maxDays * 86400000;
export function parseTLE(text, now = new Date()) {
  const lines = text.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const records = [];
  for (let i=0; i<lines.length-1; i++) {
    if (!lines[i].startsWith("1 ") || !lines[i+1].startsWith("2 ")) continue;
    const first = lines[i], second=lines[++i];
    const norad=Number(first.slice(2,7).trim());
    const meta=SATELLITES.find(s=>s.norad===norad);
    if (!meta) continue;
    try {
      const satrec=satellite.twoline2satrec(first,second);
      const epoch = new Date(Date.UTC(2000, 0, 1) + (satrec.jdsatepoch - 2451544.5) * 86400000);
      // jdsatepoch uses Julian dates; explicitly reject old/replayed ephemerides.
      records.push({ ...meta, satrec, epoch, tleFresh:isFresh(epoch,now), line1:first, line2:second });
    } catch { /* bad record; other spacecraft can still load */ }
  }
  return records;
}
export function positionAt(record, date) {
  const state=satellite.propagate(record.satrec,date);
  if (!state?.position || typeof state.position === "boolean") return null;
  const gmst=satellite.gstime(date);
  const geo=satellite.eciToGeodetic(state.position,gmst);
  const lat=geo.latitude / RAD, lon=normLon(geo.longitude / RAD);
  const altitudeKm=geo.height;
  if (![lat,lon,altitudeKm].every(Number.isFinite)) return null;
  return { lat, lon, altitudeKm };
}
export function distanceKm(a,b) {
  const x1=a.lat*RAD, x2=b.lat*RAD;
  const dx=(b.lon-a.lon)*RAD;
  const hav=Math.sin((x2-x1)/2)**2+Math.cos(x1)*Math.cos(x2)*Math.sin(dx/2)**2;
  return 6371.0088*2*Math.asin(Math.sqrt(Math.min(1,hav)));
}
export function normalizeAOI(aoi) {
  const a={west:+aoi?.west,south:+aoi?.south,east:+aoi?.east,north:+aoi?.north};
  if (Object.values(a).some(v=>!Number.isFinite(v)) || a.west < -180 || a.east > 180 || a.south < -90 || a.north > 90 || a.west >= a.east || a.south >= a.north)
    throw new Error("AOI must be a non-antimeridian bounding box: west < east and south < north.");
  return a;
}
export function aoiSamplePoints(aoi) {
  const a=normalizeAOI(aoi), points=[];
  // 5x5 sample grid: coverage is approximate, not guaranteed for arbitrary AOI shapes.
  for(let y=0;y<=4;y++) for(let x=0;x<=4;x++)
    points.push({lat:a.south+(a.north-a.south)*y/4,lon:a.west+(a.east-a.west)*x/4});
  return points;
}
