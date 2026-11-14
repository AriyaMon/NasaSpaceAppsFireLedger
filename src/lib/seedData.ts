import type { Bbox, MonthlyRawInput, RegionPreset, SensorDetection } from './types.ts';

export const REGION_PRESETS: RegionPreset[] = [
  {
    id: 'chilecito',
    name: 'Chilecito, La Rioja & Córdoba (CONAE ACT#356)',
    shortLabel: 'Chilecito ACT#356',
    biome: 'Monte / Dry Chaco Shrubland',
    bbox: { west: -68.1, south: -30.1, east: -66.7, north: -28.6 },
    center: { lat: -29.16, lon: -67.5 },
    highlightYm: '2026-07',
    description:
      'July 28–29, 2026 CONAE emergency activation (~7,456 ha). Pre-loaded Wait-Time Bridge case study pairing MODIS/VIIRS hotspots with July 29 Landsat 9 optical validation.',
  },
  {
    id: 'quebec',
    name: 'Québec Boreal Shield (Canada)',
    shortLabel: 'Québec Boreal',
    biome: 'Boreal Coniferous Forest',
    bbox: { west: -79.5, south: 45.0, east: -57.0, north: 56.0 },
    center: { lat: 50.8, lon: -72.4 },
    highlightYm: '2023-06',
    description:
      'Extreme June–July 2023 boreal fire anomaly exceeding 1,100% of the 26-year historical same-calendar-month baseline.',
  },
  {
    id: 'amazon',
    name: 'Southern Amazon Arc of Deforestation',
    shortLabel: 'Amazon Arc',
    biome: 'Tropical Moist Broadleaf',
    bbox: { west: -66.0, south: -14.0, east: -48.0, north: -4.0 },
    center: { lat: -9.2, lon: -57.5 },
    highlightYm: '2024-09',
    description:
      'Dense agricultural-frontier burning with high multi-satellite afternoon VIIRS overlap requiring strict deduplication and daytime/nighttime calibration.',
  },
  {
    id: 'california',
    name: 'California & Sierra Nevada',
    shortLabel: 'California',
    biome: 'Mediterranean Chaparral & Conifer',
    bbox: { west: -124.5, south: 32.5, east: -114.0, north: 42.0 },
    center: { lat: 38.6, lon: -120.5 },
    highlightYm: '2020-09',
    description:
      'High-intensity crown fires (2020–2021) where VIIRS I4 saturates near 367 K while MODIS Channel 21 measures peak 450–500 K FRP extremes.',
  },
  {
    id: 'africa',
    name: 'Central Africa Savanna Belt',
    shortLabel: 'Central Africa',
    biome: 'Tropical Savanna & Woodland',
    bbox: { west: 12.0, south: -12.0, east: 32.0, north: 8.0 },
    center: { lat: -3.5, lon: 22.0 },
    highlightYm: '2024-07',
    description:
      'Persistent seasonal dry-grass burns with small 1–4 MW fires that MODIS 1 km routinely under-detects by ~3.8x relative to VIIRS 375 m.',
  },
  {
    id: 'mediterranean',
    name: 'Mediterranean Basin',
    shortLabel: 'Mediterranean',
    biome: 'Mediterranean Woodland & Scrub',
    bbox: { west: -9.5, south: 35.0, east: 30.0, north: 44.5 },
    center: { lat: 39.2, lon: 14.5 },
    highlightYm: '2023-08',
    description:
      'Wildland-urban interface fires requiring rapid first-responder evacuation corridors and Landsat 8/9 burned-area confidence intervals.',
  },
  {
    id: 'borneo',
    name: 'Borneo & Sumatra Peatlands',
    shortLabel: 'Borneo Peat',
    biome: 'Tropical Peat Swamp Forest',
    bbox: { west: 100.0, south: -5.0, east: 118.5, north: 5.0 },
    center: { lat: -1.4, lon: 111.5 },
    highlightYm: '2015-10',
    description:
      'El Niño peat-smoldering anomalies (2006, 2015, 2019, 2023) marked by heavy nighttime thermal emissions and dense smoke blocking optical satellites.',
  },
  {
    id: 'australia',
    name: 'Eastern Australia & NSW',
    shortLabel: 'E. Australia',
    biome: 'Temperate Eucalypt Forest',
    bbox: { west: 141.0, south: -38.5, east: 154.0, north: -24.0 },
    center: { lat: -32.4, lon: 149.2 },
    highlightYm: '2019-12',
    description:
      'Black Summer 2019–2020 megafires captured across Terra, Aqua, Suomi NPP, NOAA-20, and Landsat 8.',
  },
  {
    id: 'siberia',
    name: 'Eastern Siberia & Sakha Taiga',
    shortLabel: 'Siberia Taiga',
    biome: 'Subarctic Boreal Taiga',
    bbox: { west: 110.0, south: 56.0, east: 142.0, north: 68.0 },
    center: { lat: 62.5, lon: 126.0 },
    highlightYm: '2021-07',
    description:
      'High-latitude summer fire waves with frequent polar-orbit overlaps requiring swath-edge bowtie distortion accounting.',
  },
  {
    id: 'world',
    name: 'Global Planetary Aggregate (All Continents)',
    shortLabel: 'Entire World',
    biome: 'Multi-Biome Global Composite',
    bbox: { west: -180, south: -65, east: 180, north: 75 },
    center: { lat: 12.0, lon: 10.0 },
    highlightYm: '2023-08',
    description:
      'Full 2000–2026 global MODIS + VIIRS + Landsat 8/9 ledger demonstrating the artificial 2012 VIIRS detection jump vs. AI-harmonized 26-year continuity.',
  },
];

interface BiomeProfile {
  id: string;
  label: string;
  centerLat: number;
  centerLon: number;
  bbox: Bbox;
  baseModis: number;
  ratioViirsToModis: number; // physical small-fire + 375m multiplier
  peakMonths: number[]; // 1-12
  spikeYears: Record<string, number>; // YYYY-MM -> multiplier
  meanFrpMw: number;
  nonVegFraction: number;
  nightShare: number;
  landsatCoincidenceBase: number;
}

export const BIOME_PROFILES: BiomeProfile[] = [
  {
    id: 'chilecito',
    label: 'Chilecito, La Rioja (AR)',
    centerLat: -29.16,
    centerLon: -67.5,
    bbox: { west: -68.1, south: -30.1, east: -66.7, north: -28.6 },
    baseModis: 14,
    ratioViirsToModis: 3.15,
    peakMonths: [7, 8, 9, 10],
    spikeYears: {
      '2003-08': 2.2,
      '2009-09': 2.4,
      '2011-08': 2.1,
      '2020-09': 2.6,
      '2026-07': 5.8, // CONAE ACT#356 July 28-29, 2026 event (~7,456 ha)
    },
    meanFrpMw: 38.4,
    nonVegFraction: 0.04,
    nightShare: 21,
    landsatCoincidenceBase: 86,
  },
  {
    id: 'quebec',
    label: 'Québec Boreal Shield (CA)',
    centerLat: 50.8,
    centerLon: -72.4,
    bbox: { west: -79.5, south: 45.0, east: -57.0, north: 56.0 },
    baseModis: 48,
    ratioViirsToModis: 2.85,
    peakMonths: [5, 6, 7, 8],
    spikeYears: {
      '2002-07': 2.5,
      '2010-05': 2.4,
      '2013-07': 2.7,
      '2023-06': 12.4,
      '2023-07': 8.9,
      '2025-07': 2.1,
    },
    meanFrpMw: 64.2,
    nonVegFraction: 0.05,
    nightShare: 28,
    landsatCoincidenceBase: 89,
  },
  {
    id: 'amazon',
    label: 'Southern Amazon Arc (BR/BO)',
    centerLat: -9.2,
    centerLon: -57.5,
    bbox: { west: -66.0, south: -14.0, east: -48.0, north: -4.0 },
    baseModis: 820,
    ratioViirsToModis: 3.45,
    peakMonths: [7, 8, 9, 10],
    spikeYears: {
      '2004-09': 1.85,
      '2007-09': 1.95,
      '2010-08': 1.8,
      '2019-08': 1.65,
      '2020-09': 1.75,
      '2024-09': 2.35,
    },
    meanFrpMw: 34.1,
    nonVegFraction: 0.03,
    nightShare: 18,
    landsatCoincidenceBase: 83,
  },
  {
    id: 'california',
    label: 'California & Sierra Nevada (US)',
    centerLat: 38.6,
    centerLon: -120.5,
    bbox: { west: -124.5, south: 32.5, east: -114.0, north: 42.0 },
    baseModis: 95,
    ratioViirsToModis: 2.65,
    peakMonths: [7, 8, 9, 10],
    spikeYears: {
      '2008-06': 2.2,
      '2018-11': 2.5,
      '2020-08': 4.4,
      '2020-09': 5.2,
      '2021-08': 4.1,
      '2024-07': 2.8,
    },
    meanFrpMw: 71.5,
    nonVegFraction: 0.08,
    nightShare: 32,
    landsatCoincidenceBase: 91,
  },
  {
    id: 'africa',
    label: 'Central Africa Savanna',
    centerLat: -3.5,
    centerLon: 22.0,
    bbox: { west: 12.0, south: -12.0, east: 32.0, north: 8.0 },
    baseModis: 1450,
    ratioViirsToModis: 3.82,
    peakMonths: [6, 7, 8, 12, 1, 2],
    spikeYears: {
      '2005-07': 1.2,
      '2016-07': 1.25,
      '2024-07': 1.32,
    },
    meanFrpMw: 22.4,
    nonVegFraction: 0.02,
    nightShare: 14,
    landsatCoincidenceBase: 79,
  },
  {
    id: 'mediterranean',
    label: 'Mediterranean Basin',
    centerLat: 39.2,
    centerLon: 14.5,
    bbox: { west: -9.5, south: 35.0, east: 30.0, north: 44.5 },
    baseModis: 110,
    ratioViirsToModis: 3.1,
    peakMonths: [7, 8, 9],
    spikeYears: {
      '2007-08': 2.4,
      '2017-10': 2.1,
      '2021-08': 2.9,
      '2023-08': 3.3,
    },
    meanFrpMw: 45.8,
    nonVegFraction: 0.11,
    nightShare: 24,
    landsatCoincidenceBase: 87,
  },
  {
    id: 'borneo',
    label: 'Borneo & Sumatra Peatlands',
    centerLat: -1.4,
    centerLon: 111.5,
    bbox: { west: 100.0, south: -5.0, east: 118.5, north: 5.0 },
    baseModis: 230,
    ratioViirsToModis: 3.35,
    peakMonths: [8, 9, 10],
    spikeYears: {
      '2006-10': 3.2,
      '2015-09': 4.8,
      '2015-10': 5.4,
      '2019-09': 3.6,
      '2023-09': 2.7,
    },
    meanFrpMw: 29.5,
    nonVegFraction: 0.06,
    nightShare: 36,
    landsatCoincidenceBase: 74,
  },
  {
    id: 'australia',
    label: 'Eastern Australia & NSW',
    centerLat: -32.4,
    centerLon: 149.2,
    bbox: { west: 141.0, south: -38.5, east: 154.0, north: -24.0 },
    baseModis: 185,
    ratioViirsToModis: 2.95,
    peakMonths: [10, 11, 12, 1, 2],
    spikeYears: {
      '2003-01': 2.6,
      '2009-02': 2.4,
      '2019-11': 5.1,
      '2019-12': 6.4,
      '2020-01': 4.9,
    },
    meanFrpMw: 58.6,
    nonVegFraction: 0.05,
    nightShare: 26,
    landsatCoincidenceBase: 88,
  },
  {
    id: 'siberia',
    label: 'Eastern Siberia & Sakha',
    centerLat: 62.5,
    centerLon: 126.0,
    bbox: { west: 110.0, south: 56.0, east: 142.0, north: 68.0 },
    baseModis: 260,
    ratioViirsToModis: 3.05,
    peakMonths: [6, 7, 8],
    spikeYears: {
      '2003-06': 2.3,
      '2012-07': 2.5,
      '2020-06': 3.1,
      '2021-07': 4.7,
      '2021-08': 4.2,
    },
    meanFrpMw: 51.0,
    nonVegFraction: 0.04,
    nightShare: 22,
    landsatCoincidenceBase: 84,
  },
];

function deterministicNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function bboxOverlapAreaRatio(a: Bbox, b: Bbox): number {
  const west = Math.max(a.west, b.west);
  const east = Math.min(a.east, b.east);
  const south = Math.max(a.south, b.south);
  const north = Math.min(a.north, b.north);
  if (east <= west || north <= south) return 0;
  const interArea = (east - west) * (north - south);
  const bArea = Math.max(0.01, (b.east - b.west) * (b.north - b.south));
  return Math.min(1, interArea / bArea);
}

export function inferRegionName(bbox: Bbox): string {
  const matchedPreset = REGION_PRESETS.find(
    (p) =>
      Math.abs(p.bbox.west - bbox.west) < 0.3 &&
      Math.abs(p.bbox.south - bbox.south) < 0.3 &&
      Math.abs(p.bbox.east - bbox.east) < 0.3 &&
      Math.abs(p.bbox.north - bbox.north) < 0.3
  );
  if (matchedPreset) return matchedPreset.name;

  const overlaps = BIOME_PROFILES.map((p) => ({
    label: p.label,
    ratio: bboxOverlapAreaRatio(bbox, p.bbox),
  }))
    .filter((o) => o.ratio > 0.05)
    .sort((a, b) => b.ratio - a.ratio);

  if (overlaps.length >= 4) return 'Global / Multi-Continental Selection';
  if (overlaps.length > 0) {
    return `${overlaps[0].label} Corridor (${bbox.south.toFixed(1)}° to ${bbox.north.toFixed(1)}°)`;
  }
  return `Custom AOI [${bbox.west.toFixed(1)}°, ${bbox.south.toFixed(1)}°]–[${bbox.east.toFixed(1)}°, ${bbox.north.toFixed(1)}°]`;
}

/**
 * Generates deterministic, physically grounded monthly multi-sensor records (2000-11 to 2026-10)
 * for any requested bounding box, reflecting:
 * - Terra-only regime (2000-11 to 2002-06)
 * - MODIS Dual Terra+Aqua regime (2002-07 to 2026-10)
 * - VIIRS Suomi NPP (2012-01+), NOAA-20 (2018-04+), NOAA-21 (2024-01+)
 * - Landsat 8 (2013-04+) and Landsat 9 (2021-11+) 30 m thermal/dNBR cross-checks
 */
export function generateMonthlyInputForBbox(
  bbox: Bbox,
  startYm = '2000-11',
  endYm = '2026-10'
): MonthlyRawInput[] {
  const weights = BIOME_PROFILES.map((p) => ({
    profile: p,
    weight: bboxOverlapAreaRatio(bbox, p.bbox),
  })).filter((w) => w.weight > 0.001);

  // If custom bbox doesn't overlap a named biome directly, synthesize realistic background fire activity
  // scaled by geographic span and latitude fire-climate curve
  const effectiveWeights =
    weights.length > 0
      ? weights
      : [
          {
            profile: {
              id: 'custom',
              label: 'Custom Sector',
              centerLat: (bbox.south + bbox.north) / 2,
              centerLon: (bbox.west + bbox.east) / 2,
              bbox,
              baseModis: Math.max(
                6,
                Math.round(
                  Math.min(400, (bbox.east - bbox.west) * (bbox.north - bbox.south) * 0.45) *
                    Math.max(0.25, Math.cos(((bbox.south + bbox.north) / 2) * (Math.PI / 180)))
                )
              ),
              ratioViirsToModis: 3.1,
              peakMonths:
                (bbox.south + bbox.north) / 2 >= 0 ? [6, 7, 8, 9] : [12, 1, 2, 8, 9],
              spikeYears: {},
              meanFrpMw: 36,
              nonVegFraction: 0.05,
              nightShare: 22,
              landsatCoincidenceBase: 82,
            },
            weight: 1,
          },
        ];

  const [sY, sM] = startYm.split('-').map(Number);
  const [eY, eM] = endYm.split('-').map(Number);

  const rows: MonthlyRawInput[] = [];
  let y = sY;
  let m = sM;

  while (y < eY || (y === eY && m <= eM)) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    const isTerraOnly = y < 2002 || (y === 2002 && m < 7);
    const hasViirsSnpp = y >= 2012;
    const hasNoaa20 = y > 2018 || (y === 2018 && m >= 4);
    const hasNoaa21 = y > 2024 || (y === 2024 && m >= 1);
    const hasLandsat8 = y > 2013 || (y === 2013 && m >= 4);
    const hasLandsat9 = y > 2021 || (y === 2021 && m >= 11);

    let modisVeg = 0;
    let modisNonVeg = 0;
    let viirsSnpp = 0;
    let viirsN20 = 0;
    let viirsN21 = 0;
    let viirsDedupDropped = 0;
    let viirsLowConfDropped = 0;
    let landsatDet = 0;
    let coincidenceWeighted = 0;
    let coincidenceWeightSum = 0;
    let dnbrAreaKm2 = 0;
    let frpTotalMw = 0;
    let nightWeighted = 0;
    let note: string | undefined;

    for (const { profile, weight } of effectiveWeights) {
      const n1 = deterministicNoise(y * 100 + m + profile.centerLon * 3.1);
      const n2 = deterministicNoise(y * 37 + m * 13 + profile.centerLat * 5.7);

      // Seasonality curve
      const inPeak = profile.peakMonths.includes(m);
      const nearPeak = profile.peakMonths.some(
        (pm) => Math.abs(pm - m) === 1 || Math.abs(pm - m) === 11
      );
      const seasonMult = inPeak ? 1.75 : nearPeak ? 0.92 : 0.34;
      const spikeMult = profile.spikeYears[ym] ?? 1.0;

      // MODIS orbital drift slight decline in late 2025-2026
      const driftFactor = y === 2026 ? 0.88 : y === 2025 ? 0.94 : 1.0;
      const terraFactor = isTerraOnly ? 0.56 : 1.0;

      const rawModisFloat =
        profile.baseModis *
        weight *
        seasonMult *
        spikeMult *
        terraFactor *
        driftFactor *
        (0.84 + 0.32 * n1);

      const mCount = Math.max(0, Math.round(rawModisFloat));
      const mNonVeg = Math.round(mCount * profile.nonVegFraction);
      modisVeg += mCount;
      modisNonVeg += mNonVeg;

      // True VIIRS-equivalent fire signal (sub-pixel + nocturnal sensitivity)
      const trueViirsEq =
        (rawModisFloat / (terraFactor * driftFactor)) *
        profile.ratioViirsToModis *
        (0.92 + 0.16 * n2);

      if (hasViirsSnpp) {
        const snpp = Math.max(0, Math.round(trueViirsEq * 0.94));
        const n20 = hasNoaa20 ? Math.max(0, Math.round(trueViirsEq * 0.89)) : 0;
        const n21 = hasNoaa21 ? Math.max(0, Math.round(trueViirsEq * 0.91)) : 0;

        // Deduplicated afternoon pass retains primary cluster plus unique passes
        const dedupedViirs = Math.max(snpp, Math.round(trueViirsEq));
        const multiSatRawSum = snpp + n20 + n21;
        const removedOverlap = Math.max(0, multiSatRawSum - dedupedViirs);

        viirsSnpp += Math.round(dedupedViirs * (hasNoaa20 ? (hasNoaa21 ? 0.36 : 0.52) : 1));
        viirsN20 += hasNoaa20 ? Math.round(dedupedViirs * (hasNoaa21 ? 0.34 : 0.48)) : 0;
        viirsN21 += hasNoaa21 ? Math.round(dedupedViirs * 0.3) : 0;
        viirsDedupDropped += removedOverlap;
        viirsLowConfDropped += Math.round(dedupedViirs * 0.045);
      }

      if (hasLandsat8) {
        const satFactor = hasLandsat9 ? 1.78 : 1.0; // L8+L9 8-day revisit vs 16-day
        const lCount = Math.max(
          0,
          Math.round((trueViirsEq * 0.14 * satFactor) * (0.85 + 0.3 * n1))
        );
        landsatDet += lCount;
        const coinc = Math.min(
          97,
          Math.max(
            62,
            profile.landsatCoincidenceBase +
              (hasLandsat9 ? 4 : 0) +
              (spikeMult > 2 ? 4 : 0) +
              (n2 - 0.5) * 6
          )
        );
        coincidenceWeighted += coinc * Math.max(1, weight);
        coincidenceWeightSum += Math.max(1, weight);

        // Burned area in km2 anchored around ~0.18 km2 per VIIRS-eq cluster (Chilecito 2026-07 calibrates to ~74.56 km2 = 7,456 ha)
        const km2 =
          profile.id === 'chilecito' && ym === '2026-07'
            ? 74.56
            : Number((trueViirsEq * 0.24 * (0.9 + 0.2 * n2)).toFixed(2));
        dnbrAreaKm2 += km2 * weight;
      }

      const activeCountForFrp = hasViirsSnpp ? trueViirsEq : rawModisFloat * profile.ratioViirsToModis;
      frpTotalMw += activeCountForFrp * profile.meanFrpMw * (0.88 + 0.24 * n1);
      nightWeighted += profile.nightShare * (hasViirsSnpp ? 1.18 : 0.72) * weight;

      if (profile.id === 'chilecito' && ym === '2026-07' && weight > 0.4) {
        note = 'CONAE ACT#356 (July 28–29, 2026): 7,456 ha burned area verified by Landsat 9';
      } else if (profile.id === 'quebec' && ym === '2023-06' && weight > 0.4) {
        note = '2023 Québec Boreal Mega-Fire Peak (>1,100% of 26-yr June median)';
      } else if (profile.id === 'australia' && ym === '2019-12' && weight > 0.4) {
        note = 'Black Summer Peak (NSW / Victoria multi-sensor corridor)';
      } else if (profile.id === 'california' && ym === '2020-09' && weight > 0.4) {
        note = '2020 Western US Megafire Complex (MODIS Ch21 high-FRP unsaturated anchor)';
      }
    }

    const totalWeight = effectiveWeights.reduce((acc, w) => acc + w.weight, 0) || 1;
    const avgCoincidence =
      hasLandsat8 && coincidenceWeightSum > 0
        ? Number((coincidenceWeighted / coincidenceWeightSum).toFixed(1))
        : 0;
    const dnbrUnc = hasLandsat8
      ? Number((dnbrAreaKm2 * (hasLandsat9 ? 0.068 : 0.115)).toFixed(2))
      : 0;

    rows.push({
      year: y,
      month: m,
      ym,
      modisVegetation: modisVeg,
      modisNonVegetationDropped: modisNonVeg,
      viirsSnppVegetation: viirsSnpp,
      viirsNoaa20Vegetation: viirsN20,
      viirsNoaa21Vegetation: viirsN21,
      viirsDedupDropped,
      viirsLowConfDropped,
      landsatDetections: landsatDet,
      landsatCoincidencePct: avgCoincidence,
      landsatDnbrBurnedKm2: Number(dnbrAreaKm2.toFixed(2)),
      landsatDnbrUncertaintyKm2: dnbrUnc,
      frpTotalMw: Number(frpTotalMw.toFixed(1)),
      nighttimeSharePct: Number(Math.min(58, nightWeighted / totalWeight).toFixed(1)),
      note,
    });

    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return rows;
}

/**
 * Generates sample cleaned detection rows for CSV / inspection table / live FIRMS merging.
 */
export function generateSampleDetectionsForBbox(
  bbox: Bbox,
  ym = '2026-07',
  limit = 60
): SensorDetection[] {
  const [yr, mo] = ym.split('-').map(Number);
  const rows: SensorDetection[] = [];
  const centerLat = (bbox.south + bbox.north) / 2;
  const centerLon = (bbox.west + bbox.east) / 2;
  const latSpan = Math.min(4.0, Math.max(0.3, (bbox.north - bbox.south) * 0.45));
  const lonSpan = Math.min(4.0, Math.max(0.3, (bbox.east - bbox.west) * 0.45));

  const isPreViirs = yr < 2012;
  const sensors: Array<SensorDetection['sensor']> = isPreViirs
    ? ['MODIS']
    : ['VIIRS_SNPP', 'VIIRS_N20', 'VIIRS_N21', 'MODIS', 'LANDSAT9'];

  for (let i = 0; i < limit; i++) {
    const n1 = deterministicNoise(i * 17 + yr * 13 + mo);
    const n2 = deterministicNoise(i * 31 + yr * 7 + mo * 3);
    const n3 = deterministicNoise(i * 43 + mo * 19);
    const sensor = sensors[i % sensors.length];
    const day = 1 + Math.floor(n1 * 27);
    const isChilecitoTarget =
      bbox.west <= -67.5 && bbox.east >= -67.5 && bbox.south <= -29.16 && bbox.north >= -29.16;

    const acqDay = isChilecitoTarget && ym === '2026-07' ? (i % 2 === 0 ? 28 : 29) : day;
    const lat = Number((centerLat + (n1 - 0.5) * latSpan).toFixed(4));
    const lon = Number((centerLon + (n2 - 0.5) * lonSpan).toFixed(4));
    const isNight = n3 > 0.72;

    const rawConfidence =
      sensor === 'MODIS'
        ? Math.round(62 + n3 * 36)
        : sensor.startsWith('VIIRS')
          ? n3 > 0.75
            ? 'h'
            : 'n'
          : 'high';
    const confidenceNorm =
      typeof rawConfidence === 'number'
        ? rawConfidence
        : rawConfidence === 'h' || rawConfidence === 'high'
          ? 92
          : 74;

    rows.push({
      id: `${sensor}-${ym}-${i + 1}`,
      sensor,
      satellite:
        sensor === 'MODIS'
          ? i % 2 === 0
            ? 'Aqua'
            : 'Terra'
          : sensor === 'VIIRS_SNPP'
            ? 'Suomi NPP'
            : sensor === 'VIIRS_N20'
              ? 'NOAA-20'
              : sensor === 'VIIRS_N21'
                ? 'NOAA-21'
                : 'Landsat 9',
      lat,
      lon,
      acqDate: `${yr}-${String(mo).padStart(2, '0')}-${String(acqDay).padStart(2, '0')}`,
      acqTime: isNight ? '0435' : sensor === 'MODIS' ? '1415' : '1740',
      daynight: isNight ? 'N' : 'D',
      brightnessMidK: Number((sensor === 'MODIS' ? 328 + n1 * 72 : 332 + n2 * 35).toFixed(1)),
      brightnessTirK: Number((294 + n3 * 18).toFixed(1)),
      frpMw: Number((12 + n1 * 88).toFixed(1)),
      confidenceNorm,
      rawConfidence,
      typeCode: 0,
      scanKm: sensor === 'MODIS' ? Number((1.0 + n2 * 1.6).toFixed(2)) : 0.39,
      trackKm: sensor === 'MODIS' ? Number((1.0 + n1 * 0.8).toFixed(2)) : 0.38,
      biome: inferRegionName(bbox),
    });
  }

  return rows;
}
