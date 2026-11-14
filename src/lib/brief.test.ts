import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFactLedger,
  buildMistralResponderPrompt,
  generateDeterministicResponderBrief,
  verifyBriefNumbers,
} from './brief.ts';
import { analyzeBbox } from './harmonize.ts';
import { REGION_PRESETS } from './seedData.ts';
import type { ResponderRole } from './types.ts';
import { buildWaitTimeBridge } from './waitTimeBridge.ts';

test('deterministic briefs for Firefighting, Police, Ambulance, Scientist, and Land Manager pass strict numeric verifier', () => {
  const chilecito = REGION_PRESETS.find((p) => p.id === 'chilecito')!;
  const analysis = analyzeBbox(chilecito.bbox, 'harmonized');
  const point = analysis.series.find((s) => s.ym === '2026-07')!;
  const bridge = buildWaitTimeBridge(chilecito.bbox, analysis.regionName, '2026-07');

  const roles: ResponderRole[] = [
    'firefighting',
    'police',
    'ambulance',
    'scientist',
    'land_manager',
  ];

  for (const role of roles) {
    const brief = generateDeterministicResponderBrief({
      role,
      regionName: analysis.regionName,
      point,
      metrics: analysis.metrics,
      bridge,
    });
    assert.equal(
      brief.rejectedNumbers.length,
      0,
      `Role ${role} produced unverified numbers: ${brief.rejectedNumbers.join(', ')}`
    );
    assert.ok(brief.verifiedNumbers.length >= 5, `Role ${role} should cite grounded figures`);
    assert.equal(brief.tacticalChecklist.length, 3);
  }

  // Ensure role differentiation in content
  const fireBrief = generateDeterministicResponderBrief({
    role: 'firefighting',
    regionName: analysis.regionName,
    point,
    metrics: analysis.metrics,
    bridge,
  });
  const policeBrief = generateDeterministicResponderBrief({
    role: 'police',
    regionName: analysis.regionName,
    point,
    metrics: analysis.metrics,
    bridge,
  });
  const emsBrief = generateDeterministicResponderBrief({
    role: 'ambulance',
    regionName: analysis.regionName,
    point,
    metrics: analysis.metrics,
    bridge,
  });

  assert.match(fireBrief.text, /Containment|flanks|dozer/i);
  assert.match(policeBrief.text, /Evacuation|roadblocks|traffic/i);
  assert.match(emsBrief.text, /PM2\.5|Respiratory|Ambulance|ALS/i);
});

test('verifyBriefNumbers rejects hallucinated numbers not present in fact ledger', () => {
  const chilecito = REGION_PRESETS.find((p) => p.id === 'chilecito')!;
  const analysis = analyzeBbox(chilecito.bbox, 'harmonized');
  const point = analysis.series.find((s) => s.ym === '2026-07')!;
  const ledger = buildFactLedger({
    role: 'police',
    regionName: analysis.regionName,
    point,
    metrics: analysis.metrics,
  });

  const hallucinatedText =
    `Highway 9999 is blocked with 482 evacuated households and 87.3 km fireline in ${point.ym}.`;
  const check = verifyBriefNumbers(hallucinatedText, ledger);
  assert.ok(check.rejectedNumbers.includes('9999'));
  assert.ok(check.rejectedNumbers.includes('482'));
  assert.ok(check.rejectedNumbers.includes('87.3'));

  const prompt = buildMistralResponderPrompt({
    role: 'firefighting',
    regionName: analysis.regionName,
    point,
    metrics: analysis.metrics,
  });
  assert.match(prompt, /\[INST\]/);
  assert.match(prompt, /FACT LEDGER/);
});
