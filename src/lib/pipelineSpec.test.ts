import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runStartupGithubRawSync } from '../../scripts/syncGithubRawDb.ts';
import { HARMONIZATION_PIPELINE_STAGES, SENSOR_SCHEMA_MAPPING } from './pipelineSpec.ts';

test('HARMONIZATION_PIPELINE_STAGES documents all 5 stages with non-empty operations and math', () => {
  assert.equal(HARMONIZATION_PIPELINE_STAGES.length, 5);
  HARMONIZATION_PIPELINE_STAGES.forEach((stage, i) => {
    assert.equal(stage.step, i + 1);
    assert.ok(stage.title.length > 5);
    assert.ok(stage.operation.length > 30);
    assert.ok(stage.mathematicalDetail.length > 5);
  });
});

test('SENSOR_SCHEMA_MAPPING covers key MODIS vs VIIRS divergences', () => {
  assert.equal(SENSOR_SCHEMA_MAPPING.length, 6);
  const joined = SENSOR_SCHEMA_MAPPING.map((r) => `${r.modisField} ${r.viirsField}`).join(' ');
  assert.ok(joined.includes('brightness'));
  assert.ok(joined.includes('bright_ti4'));
  assert.ok(joined.includes('bright_t31'));
  assert.ok(joined.includes('bright_ti5'));
});

test('runStartupGithubRawSync writes local raw MODIS/VIIRS CSVs and harmonized ledger cleanly', async () => {
  const prevToken = process.env.GITHUB_TOKEN;
  const prevFirms = process.env.FIRMS_MAP_KEY;
  delete process.env.GITHUB_TOKEN;
  delete process.env.FIRMS_MAP_KEY;

  try {
    const status = await runStartupGithubRawSync();
    assert.equal(status.state, 'partial_local_only');
    assert.ok(status.harmonizedMonthlyRows > 300);

    const dataDir = path.resolve(process.cwd(), 'data');
    assert.ok(fs.existsSync(path.join(dataDir, 'raw_modis_detections.csv')));
    assert.ok(fs.existsSync(path.join(dataDir, 'raw_viirs_detections.csv')));
    assert.ok(fs.existsSync(path.join(dataDir, 'harmonized_monthly_ledger.json')));
    assert.ok(fs.existsSync(path.join(dataDir, 'dataset_meta.json')));
  } finally {
    if (prevToken !== undefined) process.env.GITHUB_TOKEN = prevToken;
    if (prevFirms !== undefined) process.env.FIRMS_MAP_KEY = prevFirms;
  }
});
