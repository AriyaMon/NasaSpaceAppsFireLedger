import type { AnalyzeResponse, WaitTimeBridgeResult } from './types.ts';

export function toHarmonizedCsv(analysis: AnalyzeResponse): string {
  const headers = [
    'ym',
    'year',
    'month',
    'region',
    'mode',
    'regime',
    'source',
    'modis_raw_veg',
    'viirs_dedup_veg',
    'raw_combined_count',
    'harmonized_viirs_eq',
    'conformal_lo90',
    'conformal_hi90',
    'landsat_ci_lo',
    'landsat_ci_hi',
    'landsat_coincidence_pct',
    'landsat_dnbr_burned_km2',
    'landsat_dnbr_unc_km2',
    'frp_total_mw',
    'frp_mean_mw',
    'nighttime_share_pct',
    'median_26yr_same_month',
    'pct_of_median',
    'z_score',
    'percentile',
    'anomaly_tier',
    'confidence_tier',
  ];

  const escapeCsv = (val: string | number | undefined) => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [headers.join(',')];
  for (const row of analysis.series) {
    lines.push(
      [
        row.ym,
        row.year,
        row.month,
        analysis.regionName,
        analysis.mode,
        row.regime,
        row.source,
        row.modisRaw,
        row.viirsRaw,
        row.rawCombinedCount,
        row.harmonizedCount,
        row.lo90,
        row.hi90,
        row.landsatLo,
        row.landsatHi,
        row.landsatCoincidencePct,
        row.landsatDnbrBurnedKm2,
        row.landsatDnbrUncertaintyKm2,
        row.frpTotalMw,
        row.frpMeanMw,
        row.nighttimeSharePct,
        row.medianSameMonth,
        row.pctOfMedian,
        row.zScore,
        row.percentile,
        row.anomaly,
        row.confidenceTier,
      ]
        .map(escapeCsv)
        .join(',')
    );
  }
  return lines.join('\n');
}

export function toPerimeterGeoJson(bridge: WaitTimeBridgeResult): string {
  return JSON.stringify(bridge.perimeterGeoJson, null, 2);
}
