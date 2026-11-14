import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeLocalAnalyze,
  computeLocalBrief,
  computeLocalDailySlice,
  computeLocalGlobeCells,
  computeLocalLandsatVerify,
  computeLocalWaitTimeBridge,
} from './apiClient.ts';
import { toHarmonizedCsv, toPerimeterGeoJson } from './exports.ts';
import { REGION_PRESETS } from './seedData.ts';

const chilecito = REGION_PRESETS[0].bbox;

test('static GitHub Pages fallback computes full analyze series and exports valid CSV/GeoJSON', () => {
  const analysis = computeLocalAnalyze(chilecito, 'harmonized');
  assert.ok(analysis.series.length >= 300);
  const csv = toHarmonizedCsv(analysis);
  assert.ok(csv.includes('ym,year,month,region,mode'));
  assert.ok(csv.includes('harmonized_viirs_eq'));

  const bridge = computeLocalWaitTimeBridge(chilecito, '2026-07');
  assert.ok(bridge.predictedBurnedHa > 0);
  const geojson = JSON.parse(toPerimeterGeoJson(bridge));
  assert.equal(geojson.type, 'FeatureCollection');
  assert.ok(geojson.features.length > 0);
});

test('static fallback computes daily progression globe cells, daily slice, Landsat check, and verified brief', () => {
  const globeDay28 = computeLocalGlobeCells('2026-07', 'harmonized', 28);
  assert.equal(globeDay28.day, 28);
  assert.ok(globeDay28.cells.some((c) => c.cellKind === 'fire'));

  const slice = computeLocalDailySlice(chilecito, '2026-07', 'harmonized');
  assert.ok(slice.daily.length >= 28);

  const landsat = computeLocalLandsatVerify(chilecito, '2026-07');
  assert.ok(landsat.geeScript.includes('ee.Geometry.Rectangle'));

  const brief = computeLocalBrief(chilecito, '2026-07', 'harmonized', 'firefighting');
  assert.ok(brief.verifiedNumbers.length > 0);
  assert.equal(brief.rejectedNumbers.length, 0);
});
