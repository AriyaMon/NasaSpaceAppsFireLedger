export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type HarmonizationMode = 'harmonized' | 'raw' | 'dual_2012';
export type ColorRamp = 'viridis' | 'inferno' | 'cividis';
export type ResponderRole =
  | 'firefighting'
  | 'police'
  | 'ambulance'
  | 'scientist'
  | 'land_manager';

export type SensorCode =
  | 'MODIS'
  | 'VIIRS_SNPP'
  | 'VIIRS_N20'
  | 'VIIRS_N21'
  | 'LANDSAT8'
  | 'LANDSAT9';

export interface SensorDetection {
  id: string;
  sensor: SensorCode;
  satellite: string;
  lat: number;
  lon: number;
  acqDate: string; // YYYY-MM-DD
  acqTime: string; // HHMM
  daynight: 'D' | 'N';
  brightnessMidK: number; // MODIS Ch21/22 or VIIRS I4
  brightnessTirK: number; // MODIS Ch31 or VIIRS I5
  frpMw: number;
  confidenceNorm: number; // Normalized 0-100
  rawConfidence: string | number;
  typeCode: 0 | 1 | 2 | 3; // 0 = presumed vegetation fire
  scanKm: number;
  trackKm: number;
  biome: string;
  isLiveFirms?: boolean;
}

export interface MonthlyRawInput {
  year: number;
  month: number;
  ym: string;
  modisVegetation: number; // type == 0 cleaned
  modisNonVegetationDropped: number; // type != 0 filtered
  viirsSnppVegetation: number;
  viirsNoaa20Vegetation: number;
  viirsNoaa21Vegetation: number;
  viirsDedupDropped: number; // multi-satellite 1:30 PM overlap deduped
  viirsLowConfDropped: number;
  landsatDetections: number;
  landsatCoincidencePct: number; // 0-100 within 1 km of VIIRS/MODIS
  landsatDnbrBurnedKm2: number;
  landsatDnbrUncertaintyKm2: number;
  frpTotalMw: number;
  nighttimeSharePct: number;
  note?: string;
}

export interface MonthlyPoint {
  year: number;
  month: number;
  ym: string;
  modisRaw: number;
  viirsRaw: number; // deduplicated VIIRS count
  landsatRaw: number;
  rawCombinedCount: number; // unharmonized broken series (shows 2012 spike)
  harmonizedCount: number; // VIIRS-equivalent harmonized count
  lo90: number; // 90% conformal lower bound
  hi90: number; // 90% conformal upper bound
  landsatLo: number; // 3rd-satellite Landsat 8/9 anchored CI lower bound
  landsatHi: number; // 3rd-satellite Landsat 8/9 anchored CI upper bound
  landsatCoincidencePct: number;
  landsatDnbrBurnedKm2: number;
  landsatDnbrUncertaintyKm2: number;
  frpTotalMw: number;
  frpMeanMw: number;
  nighttimeSharePct: number;
  source: 'modis_translated' | 'viirs_observed' | 'modis_raw' | 'dual_overlap';
  regime: 'terra_only' | 'modis_dual' | 'viirs_era';
  medianSameMonth: number;
  pctOfMedian: number;
  zScore: number;
  percentile: number;
  anomaly: 'high' | 'medium' | 'low' | 'normal';
  confidenceTier: 'high' | 'medium' | 'low';
  note?: string;
}

export interface DailySlicePoint {
  day: number;
  dateStr: string;
  modisRaw: number;
  viirsRaw: number;
  harmonizedCount: number;
  lo90: number;
  hi90: number;
  landsatLo: number;
  landsatHi: number;
  frpMw: number;
  isAnomaly: boolean;
}

export interface HarmonizationMetrics {
  slope: number;
  intercept: number;
  r2: number;
  mae: number;
  rmse: number;
  biasPct: number;
  coverage90Pct: number;
  landsatAnchoredCoveragePct: number;
  overlapMonths: number;
  usedRegionalFallback: boolean;
  modelType: string;
}

export interface DataAccountingSummary {
  totalModisVegetation: number;
  totalModisNonVegFiltered: number;
  totalViirsDeduplicated: number;
  totalViirsMultiSatRemoved: number;
  totalLandsatCrossChecks: number;
  totalHarmonizedViirsEq: number;
}

export interface AnalyzeResponse {
  bbox: Bbox;
  regionName: string;
  mode: HarmonizationMode;
  startYm: string;
  endYm: string;
  series: MonthlyPoint[];
  metrics: HarmonizationMetrics;
  accounting: DataAccountingSummary;
  dataOrigin: 'cached_global_baseline' | 'live_firms_merged' | 'github_synced';
}

export interface RegionPreset {
  id: string;
  name: string;
  shortLabel: string;
  biome: string;
  bbox: Bbox;
  center: { lat: number; lon: number };
  highlightYm: string;
  description: string;
}

export interface GlobeCell {
  id: string;
  lat: number;
  lon: number;
  regionLabel: string;
  biome: string;
  harmonizedCount: number;
  rawCount: number;
  lo90: number;
  hi90: number;
  landsatLo: number;
  landsatHi: number;
  landsatCoincidencePct: number;
  frpMw: number;
  anomalyScore: number;
  confidenceTier: 'high' | 'medium' | 'low';
  dominantSensor: string;
}

export interface SuperResCell {
  row: number;
  col: number;
  lat: number;
  lon: number;
  modisRawFlag: boolean; // true if inside coarse 1 km MODIS footprint
  viirsDensity: number; // 0..1 Stage 2 U-Net super-resolved intensity
  slopeWeight: number; // terrain DEM slope multiplier
  inBurnPolygon: boolean;
  inWindCone: boolean;
  landsatBurnedFlag: boolean;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: Record<string, string | number | boolean>;
    geometry: {
      type: 'Polygon' | 'Point' | 'LineString';
      coordinates: number[][][] | number[][] | number[];
    };
  }>;
}

export interface WaitTimeBridgeResult {
  caseId: string;
  title: string;
  location: string;
  acqWindow: string;
  opticalWaitHours: number;
  modis1kmCount: number;
  viirs375mPredictedCount: number;
  predictedBurnedHa: number;
  predictedBurnedLoHa: number;
  predictedBurnedHiHa: number;
  landsatValidationHa: number;
  landsatAgreementPct: number;
  windDirectionDeg: number; // meteorological origin or spread vector
  windDirectionLabel: string;
  windSpeedKmh: number;
  slopeMeanDeg: number;
  gridRows: number;
  gridCols: number;
  gridCells: SuperResCell[];
  perimeterGeoJson: GeoJsonFeatureCollection;
  summaryPoints: string[];
}

export interface LandsatVerificationResult {
  bbox: Bbox;
  regionName: string;
  landsatDetections30m: number;
  coincidenceWithin1KmPct: number;
  dnbrBurnedAreaKm2: number;
  dnbrUncertaintyKm2: number;
  confidenceInterval90Ha: [number, number];
  liveLandsatNrtCount: number;
  lastPassIso: string;
  geeScript: string;
}

export interface ResponderBriefResult {
  role: ResponderRole;
  roleLabel: string;
  ym: string;
  regionName: string;
  text: string;
  source: 'local_mistral_7b' | 'curated_verified_fallback';
  modelName: string;
  verifiedNumbers: string[];
  rejectedNumbers: string[];
  factLedger: Record<string, number | string>;
  tacticalChecklist: string[];
}
