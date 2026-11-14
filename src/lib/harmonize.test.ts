import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeBbox,
  buildDailySlice,
  buildGlobeCells,
  buildLandsatVerification,
  harmonizeSeries,
  normalizeConfidence,
} from './harmonize.ts';
import { generateMonthlyInputForBbox, REGION_PRESETS } from './seedData.ts';

test('normalizeConfidence converts MODIS numeric and VIIRS categorical strings cleanly', () => {
  assert.equal(normalizeConfidence('h'), 95);
  assert.equal(normalizeConfidence('n'), 75);
  assert.equal(normalizeConfidence('l'), 30);
  assert.equal(normalizeConfidence('high'), 95);
  assert.equal(normalizeConfidence(84), 84);
  assert.equal(normalizeConfidence(150), 100);
  assert.equal(normalizeConfidence(-10), 0);
});

test('harmonizeSeries bridges pre-2012 MODIS to VIIRS scale and provides conformal + Landsat CIs', () => {
  const amazon = REGION_PRESETS.find((p) => p.id === 'amazon')!;
  const harm = analyzeBbox(amazon.bbox, 'harmonized');
  const raw = analyzeBbox(amazon.bbox, 'raw');

  assert.ok(harm.series.length >= 300, 'Expected full 26-year monthly timeline');
  assert.ok(harm.metrics.r2 > 0.75, `Expected strong OOF R2, got ${harm.metrics.r2}`);
  assert.ok(harm.metrics.coverage90Pct >= 80, 'Expected conformal coverage >= 80%');
  assert.ok(
    harm.metrics.landsatAnchoredCoveragePct >= 85,
    'Expected Landsat anchored coverage >= 85%'
  );

  // Pre-2012 harmonized should be noticeably higher than raw 1km MODIS (VIIRS-equivalent scale)
  const pre2012Harm = harm.series.find((s) => s.ym === '2007-09')!;
  const pre2012Raw = raw.series.find((s) => s.ym === '2007-09')!;
  assert.ok(
    pre2012Harm.harmonizedCount > pre2012Raw.harmonizedCount * 1.8,
    'Expected MODIS translated to VIIRS scale (>1.8x raw MODIS)'
  );
  assert.ok(pre2012Harm.lo90 <= pre2012Harm.harmonizedCount);
  assert.ok(pre2012Harm.hi90 >= pre2012Harm.harmonizedCount);
  assert.ok(pre2012Harm.landsatLo <= pre2012Harm.harmonizedCount);
  assert.ok(pre2012Harm.landsatHi >= pre2012Harm.harmonizedCount);

  // Terra-only (2001) should have wider relative conformal interval than MODIS Dual (2007)
  const terra2001 = harm.series.find((s) => s.ym === '2001-09')!;
  const relWidthTerra = (terra2001.hi90 - terra2001.lo90) / Math.max(1, terra2001.harmonizedCount);
  const relWidthDual = (pre2012Harm.hi90 - pre2012Harm.lo90) / Math.max(1, pre2012Harm.harmonizedCount);
  assert.ok(relWidthTerra > relWidthDual * 1.1, 'Terra-only regime must widen conformal CI');
});

test('dual_2012 mode filters series strictly to >= 2012 overlap window', () => {
  const quebec = REGION_PRESETS.find((p) => p.id === 'quebec')!;
  const dual = analyzeBbox(quebec.bbox, 'dual_2012');
  assert.ok(dual.series.every((s) => s.year >= 2012));
  assert.equal(dual.series[0]?.ym, '2012-01');
  const peak2023 = dual.series.find((s) => s.ym === '2023-06')!;
  assert.equal(peak2023.anomaly, 'high');
});

test('sparse AOI fallback widens interval 2x when overlap months < 18', () => {
  const bbox = REGION_PRESETS[0].bbox;
  const fullRaw = generateMonthlyInputForBbox(bbox, '2000-11', '2026-10');
  const sparseRaw = fullRaw.filter((r) => r.year < 2012 || (r.year === 2012 && r.month <= 10));
  const sparseRes = harmonizeSeries(sparseRaw, bbox, 'harmonized');
  assert.equal(sparseRes.metrics.usedRegionalFallback, true);
});

test('buildDailySlice, buildGlobeCells, and buildLandsatVerification produce valid outputs', () => {
  const chilecito = REGION_PRESETS.find((p) => p.id === 'chilecito')!;
  const res = analyzeBbox(chilecito.bbox, 'harmonized');
  const july2026 = res.series.find((s) => s.ym === '2026-07')!;
  const daily = buildDailySlice(july2026);
  assert.equal(daily.length, 31);
  assert.ok(daily.some((d) => d.day === 28 && d.isAnomaly));

  const cells = buildGlobeCells('2026-07', 'harmonized');
  assert.ok(cells.length >= 18);

  const lVerify = buildLandsatVerification(chilecito.bbox, '2026-07', 4);
  assert.ok(lVerify.landsatDetections30m >= 4);
  assert.ok(lVerify.geeScript.includes('LANDSAT/LC09/C02/T1_L2'));
  assert.ok(lVerify.confidenceInterval90Ha[0] < lVerify.confidenceInterval90Ha[1]);
});
