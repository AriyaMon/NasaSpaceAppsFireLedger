export interface PipelineStageSpec {
  step: number;
  title: string;
  inputState: string;
  operation: string;
  outputState: string;
  mathematicalDetail: string;
}

export interface SchemaMappingRow {
  concept: string;
  modisField: string;
  viirsField: string;
  harmonizationRule: string;
}

export const HARMONIZATION_PIPELINE_STAGES: PipelineStageSpec[] = [
  {
    step: 1,
    title: 'Cross-Sensor Schema & Thermal Band Normalization',
    inputState: 'Raw MODIS_SP/NRT CSVs & VIIRS_SNPP/NOAA20/NOAA21 CSVs',
    operation:
      'Maps divergent mid-infrared (brightness 3.96 μm vs. bright_ti4 3.74 μm) and thermal background (bright_t31 11.0 μm vs. bright_ti5 11.45 μm) columns into a unified physical schema, and converts VIIRS categorical confidence ("l", "n", "h") into continuous 0–100 scores (30, 75, 95).',
    outputState: 'Unified vegetation-candidate schema with comparable confidence & Kelvin bands',
    mathematicalDetail: 'conf_norm = map({"l": 30, "n": 75, "h": 95}) | clamp(numeric, 0, 100)',
  },
  {
    step: 2,
    title: 'Non-Vegetation Filtering & Swath-Edge Bowtie Weighting',
    inputState: 'All raw thermal anomalies including gas flares, smelters, volcanoes, and off-nadir edges',
    operation:
      'Retains presumed vegetation fires strictly (type == 0), dropping ~2–11% persistent industrial/volcanic false positives, and accounts for MODIS off-nadir bowtie expansion (1.0 km² nadir stretching to ~10 km² at swath edge) vs. VIIRS hardware pixel aggregation.',
    outputState: 'Clean vegetative fire detections free of industrial clutter and double-counted edges',
    mathematicalDetail: 'keep(type == 0) · bowtie_weight = 1 / max(1, (scan_km × track_km) / 1.0)',
  },
  {
    step: 3,
    title: 'Afternoon Multi-Satellite VIIRS Deduplication',
    inputState: 'Overlapping ~1:30 PM local passes across Suomi NPP, NOAA-20, and NOAA-21 (~50 min apart)',
    operation:
      'Clusters same-day, same-daynight VIIRS detections within 0.01° (~1.1 km) spatial cells and retains the peak-FRP pixel per fire event, preventing artificial 2×–3× fire count inflation after NOAA-20 (2018) and NOAA-21 (2024) joined Suomi NPP.',
    outputState: 'Single-pass-equivalent deduplicated VIIRS hotspot ledger (2012–2026)',
    mathematicalDetail: 'groupby(round(lat,2), round(lon,2), acq_date, daynight).max(frp_mw)',
  },
  {
    step: 4,
    title: 'Stage 1 Temporal Calibration & Conformal 90% Intervals',
    inputState: '15-year overlap "Rosetta Stone" (2012–2026) pairing MODIS 1 km and deduplicated VIIRS 375 m',
    operation:
      'Fits alternating-year out-of-fold log-log calibration (log1p(VIIRS) ~ log1p(MODIS) + seasonality/FRP) to translate 2000–2011 MODIS records onto the 375 m VIIRS scale. Computes distribution-free 90% conformal prediction intervals widened 1.5× during Terra-only months (< 2002-07) and 2.0× for sparse AOIs.',
    outputState: 'Seamless 26-year VIIRS-equivalent time series (2000–2026) with calibrated [lo90, hi90]',
    mathematicalDetail: 'y_hat = expm1(β₁·log1p(MODIS) + β₀) · τ_terra ± q₉₀(|log1p(y) - ŷ|)',
  },
  {
    step: 5,
    title: 'Stage 2 Spatial Super-Resolution & Landsat 8/9 3rd-Satellite CI',
    inputState: 'Coarse 1 km MODIS Day-1 clusters + DEM slope + wind vectors + Landsat 8/9 30 m passes',
    operation:
      'U-Net downscales 1 km MODIS clusters into a 375 m fire density grid and projects a terrain- and wind-weighted 24 h spread cone ("Optical Wait-Time Bridge"). Anchors temporal uncertainty against Landsat 8/9 30 m thermal coincidence (≤ 1 km) and Collection 2 Level-2 dNBR (> 0.27) scar bounds.',
    outputState: 'Day-1 burn perimeter GeoJSON + Landsat-anchored confidence envelope [landsatLo, landsatHi]',
    mathematicalDetail: 'dNBR = NBR_pre - NBR_post > 0.27 · CI_L89 = ŷ ± (0.55·(1 - coinc) + 0.45·σ_dNBR)',
  },
];

export const SENSOR_SCHEMA_MAPPING: SchemaMappingRow[] = [
  {
    concept: 'Pixel Footprint',
    modisField: '1,000 m × 1,000 m (1.0 km²)',
    viirsField: '375 m × 375 m (0.14 km²)',
    harmonizationRule: '~7.1 VIIRS pixels per MODIS cell; resolved via Stage 1 log-log & Stage 2 U-Net.',
  },
  {
    concept: 'Mid-IR Fire Channel',
    modisField: 'brightness (3.96 μm, sat ~500 K)',
    viirsField: 'bright_ti4 (3.74 μm, sat ~367 K)',
    harmonizationRule: 'Unified as brightnessMidK; MODIS anchors extreme >367 K saturation peaks.',
  },
  {
    concept: 'Thermal Background',
    modisField: 'bright_t31 (11.0 μm)',
    viirsField: 'bright_ti5 (11.45 μm)',
    harmonizationRule: 'Unified as brightnessTirK with regional seasonal baseline normalization.',
  },
  {
    concept: 'Detection Confidence',
    modisField: 'Integer 0–100',
    viirsField: 'Categorical "l" / "n" / "h"',
    harmonizationRule: 'Mapped to 0–100 continuous scale ("l"→30, "n"→75, "h"→95).',
  },
  {
    concept: 'Afternoon Overpass Overlap',
    modisField: 'Terra ~10:30 AM · Aqua ~1:30 PM',
    viirsField: 'S-NPP, NOAA-20, NOAA-21 (~1:30 PM ±50m)',
    harmonizationRule: '0.01° same-day/night max-FRP deduplication prevents 3× counting.',
  },
  {
    concept: 'Small-Fire & Night Floor',
    modisField: 'Misses burns < 10–15 MW',
    viirsField: 'Detects 1–2 MW burns & night embers',
    harmonizationRule: 'Stage 1 regression + nocturnal share calibration lifts 2000–2011 baseline.',
  },
];
