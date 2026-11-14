import assert from 'node:assert/strict';
import test from 'node:test';
import { toHarmonizedCsv, toPerimeterGeoJson } from './exports.ts';
import { analyzeBbox } from './harmonize.ts';
import { REGION_PRESETS } from './seedData.ts';
import { buildWaitTimeBridge } from './waitTimeBridge.ts';

test('buildWaitTimeBridge produces calibrated ~7,456 ha Chilecito ACT#356 perimeter and wind cone GeoJSON', () => {
  const chilecito = REGION_PRESETS.find((p) => p.id === 'chilecito')!;
  const bridge = buildWaitTimeBridge(chilecito.bbox, chilecito.name, '2026-07');

  assert.equal(bridge.caseId, 'CONAE-ACT-356');
  assert.equal(bridge.predictedBurnedHa, 7456);
  assert.ok(bridge.viirs375mPredictedCount > bridge.modis1kmCount);
  assert.ok(bridge.landsatAgreementPct >= 82);
  assert.equal(bridge.gridCells.length, bridge.gridRows * bridge.gridCols);
  assert.equal(bridge.perimeterGeoJson.features.length, 2);
  assert.equal(
    bridge.perimeterGeoJson.features[0].properties.layer,
    'day1_superres_burn_perimeter'
  );
  assert.equal(
    bridge.perimeterGeoJson.features[1].properties.layer,
    '24h_downwind_spread_cone'
  );

  const geojsonStr = toPerimeterGeoJson(bridge);
  const parsed = JSON.parse(geojsonStr);
  assert.equal(parsed.type, 'FeatureCollection');
});

test('toHarmonizedCsv exports header and full series with Landsat confidence bounds', () => {
  const quebec = REGION_PRESETS.find((p) => p.id === 'quebec')!;
  const analysis = analyzeBbox(quebec.bbox, 'harmonized');
  const csv = toHarmonizedCsv(analysis);
  const lines = csv.split('\n');
  assert.equal(lines.length, analysis.series.length + 1);
  assert.ok(lines[0].includes('landsat_ci_lo'));
  assert.ok(lines[0].includes('conformal_hi90'));
});
