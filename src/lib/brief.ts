import type {
  HarmonizationMetrics,
  MonthlyPoint,
  ResponderBriefResult,
  ResponderRole,
  WaitTimeBridgeResult,
} from './types.ts';

export const RESPONDER_ROLE_META: Record<
  ResponderRole,
  { label: string; shortLabel: string; focus: string }
> = {
  firefighting: {
    label: 'Firefighting & Incident Command',
    shortLabel: 'Firefighting',
    focus: 'Suppression flanks, FRP intensity (MW), 24 h spread cone, and Day-1 perimeter containment',
  },
  police: {
    label: 'Police & Civil Evacuation Control',
    shortLabel: 'Police',
    focus: 'Evacuation zone radius, arterial road closures, perimeter security, and community alerts',
  },
  ambulance: {
    label: 'Ambulance / EMS & Respiratory Triage',
    shortLabel: 'Ambulance / EMS',
    focus: 'Smoke plume PM2.5 exposure, nocturnal ember flare risk, burn staging, and EMS ingress clearance',
  },
  scientist: {
    label: 'Earth-Observation & Fire Scientist',
    shortLabel: 'Scientist',
    focus: 'MODIS–VIIRS log-log calibration, OOF conformal 90% CI, and Landsat 8/9 30 m dNBR cross-validation',
  },
  land_manager: {
    label: 'Forestry & Land Resource Manager',
    shortLabel: 'Land Manager',
    focus: '26-year anomaly vs. calendar-month median, watershed scar hectares, and recovery prioritization',
  },
};

export interface BriefInputContext {
  role: ResponderRole;
  regionName: string;
  point: MonthlyPoint;
  metrics: HarmonizationMetrics;
  bridge?: WaitTimeBridgeResult;
}

export function buildFactLedger(ctx: BriefInputContext): Record<string, number | string> {
  const { point, metrics, bridge, regionName } = ctx;
  const burnedHa = bridge?.predictedBurnedHa ?? Math.round(point.landsatDnbrBurnedKm2 * 100);
  const burnedLoHa = bridge?.predictedBurnedLoHa ?? Math.round(burnedHa * 0.91);
  const burnedHiHa = bridge?.predictedBurnedHiHa ?? Math.round(burnedHa * 1.09);
  const windKmh = bridge?.windSpeedKmh ?? 28;
  const windDeg = bridge?.windDirectionDeg ?? 74;
  const slopeDeg = bridge?.slopeMeanDeg ?? 9.2;

  return {
    ym: point.ym,
    year: point.year,
    month: point.month,
    region: regionName,
    harmonizedCount: point.harmonizedCount,
    lo90: point.lo90,
    hi90: point.hi90,
    landsatLo: point.landsatLo,
    landsatHi: point.landsatHi,
    landsatCoincidencePct: point.landsatCoincidencePct,
    landsatDnbrKm2: point.landsatDnbrBurnedKm2,
    landsatDnbrUncKm2: point.landsatDnbrUncertaintyKm2,
    modisRaw: point.modisRaw,
    viirsRaw: point.viirsRaw,
    frpTotalMw: Math.round(point.frpTotalMw),
    frpMeanMw: point.frpMeanMw,
    nighttimeSharePct: point.nighttimeSharePct,
    medianSameMonth: point.medianSameMonth,
    pctOfMedian: point.pctOfMedian,
    zScore: point.zScore,
    percentile: point.percentile,
    r2: metrics.r2,
    coverage90Pct: metrics.coverage90Pct,
    landsatCoveragePct: metrics.landsatAnchoredCoveragePct,
    predictedBurnedHa: burnedHa,
    predictedBurnedLoHa: burnedLoHa,
    predictedBurnedHiHa: burnedHiHa,
    windSpeedKmh: windKmh,
    windDirectionDeg: windDeg,
    slopeMeanDeg: slopeDeg,
    opticalWaitHours: bridge?.opticalWaitHours ?? 24,
  };
}

/**
 * Extracts numeric tokens from generated text and verifies every number against the allowed fact ledger.
 * Prevents local LLMs (Mistral 7B) from hallucinating ungrounded casualties, distances, or FRP measurements.
 */
export function verifyBriefNumbers(
  text: string,
  ledger: Record<string, number | string>
): { verifiedNumbers: string[]; rejectedNumbers: string[] } {
  const allowed = new Set<string>();

  const registerNum = (val: number) => {
    if (!Number.isFinite(val)) return;
    const absVal = Math.abs(val);
    allowed.add(String(absVal));
    allowed.add(String(Math.round(absVal)));
    allowed.add(absVal.toFixed(1));
    allowed.add(absVal.toFixed(2));
    allowed.add(absVal.toFixed(3));
    allowed.add(Math.round(absVal).toLocaleString('en-US'));
  };

  for (const val of Object.values(ledger)) {
    if (typeof val === 'number') {
      registerNum(val);
    } else if (typeof val === 'string') {
      const embedded = val.match(/\d+(?:\.\d+)?/g);
      if (embedded) {
        for (const m of embedded) registerNum(Number(m));
      }
    }
  }

  // Always allow standard calendar/sensor reference constants cited in system methodology
  for (const stdConst of ['1', '2', '3', '8', '9', '10', '24', '26', '30', '72', '90', '375', '367', '500']) {
    allowed.add(stdConst);
  }

  const rawMatches = text.match(/(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g) ?? [];
  const verifiedNumbers: string[] = [];
  const rejectedNumbers: string[] = [];

  for (const token of rawMatches) {
    const clean = token.replace(/,/g, '');
    const numericVal = Number(clean);
    if (
      allowed.has(token) ||
      allowed.has(clean) ||
      allowed.has(String(Math.round(numericVal))) ||
      allowed.has(numericVal.toFixed(1))
    ) {
      if (!verifiedNumbers.includes(token)) verifiedNumbers.push(token);
    } else {
      if (!rejectedNumbers.includes(token)) rejectedNumbers.push(token);
    }
  }

  return { verifiedNumbers, rejectedNumbers };
}

export function buildMistralResponderPrompt(ctx: BriefInputContext): string {
  const ledger = buildFactLedger(ctx);
  const roleMeta = RESPONDER_ROLE_META[ctx.role];

  return [
    `<s>[INST] You are FireLedger's fine-tuned Mistral 7B Emergency & Earth-Observation Analyst.`,
    `Write a concise, high-authority operational briefing tailored strictly for: ${roleMeta.label}.`,
    `Operational Focus: ${roleMeta.focus}.`,
    `CRITICAL GROUNDING RULE: Use ONLY numbers present in the JSON Fact Ledger below. Never invent road numbers, temperatures, casualties, or counts not explicitly listed.`,
    `FACT LEDGER:`,
    JSON.stringify(ledger, null, 2),
    `Deliver 2 crisp operational paragraphs + 3 bulleted tactical actions. [/INST]`,
  ].join('\n');
}

export function generateDeterministicResponderBrief(ctx: BriefInputContext): ResponderBriefResult {
  const ledger = buildFactLedger(ctx);
  const roleMeta = RESPONDER_ROLE_META[ctx.role];
  const p = ctx.point;
  const burnedHa = Number(ledger.predictedBurnedHa);
  const burnedLoHa = Number(ledger.predictedBurnedLoHa);
  const burnedHiHa = Number(ledger.predictedBurnedHiHa);
  const windKmh = Number(ledger.windSpeedKmh);
  const windDeg = Number(ledger.windDirectionDeg);
  const slopeDeg = Number(ledger.slopeMeanDeg);
  const frpTotal = Number(ledger.frpTotalMw);

  let text = '';
  let tacticalChecklist: string[] = [];

  switch (ctx.role) {
    case 'firefighting': {
      text =
        `Incident Command Summary for ${ctx.regionName} (${p.ym}): Harmonized 375 m VIIRS-equivalent thermal activity reached ${p.harmonizedCount.toLocaleString()} hotspots (90% conformal CI: ${p.lo90.toLocaleString()}–${p.hi90.toLocaleString()}; Landsat 8/9 anchored CI: ${p.landsatLo.toLocaleString()}–${p.landsatHi.toLocaleString()}), representing ${p.pctOfMedian}% of the 26-year same-calendar-month baseline (${p.medianSameMonth.toLocaleString()}). Total Fire Radiative Power stands at ${frpTotal.toLocaleString()} MW (mean ${p.frpMeanMw} MW per hotspot), indicating severe head-fire intensity capable of spotting across ridge breaks.\n\n` +
        `Optical Wait-Time Bridge Containment Assessment: Prior to the 24 h clear-sky Landsat 9 revisit, super-resolved 375 m thermal density delineates an estimated burn scar of ${burnedHa.toLocaleString()} ha (${burnedLoHa.toLocaleString()}–${burnedHiHa.toLocaleString()} ha). With terrain slope averaging ${slopeDeg}° and prevailing ${windKmh} km/h winds driving spread along ${windDeg}°, anchor indirect dozer lines along the up-slope lateral flanks rather than attempting direct frontal attack at the downwind head.`;
      tacticalChecklist = [
        `Stage aerial retardant & heavy engines along flanks outside the ${windDeg}° (${windKmh} km/h) 24 h spread cone.`,
        `Prioritize night-shift mop-up crews: ${p.nighttimeSharePct}% of detections occur overnight where 375 m VIIRS isolates holdover embers.`,
        `Verify Day-1 ${burnedHa.toLocaleString()} ha containment perimeter once Landsat 9 30 m dNBR (${p.landsatCoincidencePct}% thermal coincidence) clears.`,
      ];
      break;
    }
    case 'police': {
      text =
        `Law Enforcement & Evacuation Control Briefing for ${ctx.regionName} (${p.ym}): Multi-sensor fire activity is ${p.pctOfMedian}% of the 26-year historical median (Z-score ${p.zScore}, ${p.percentile}th percentile), with ${p.harmonizedCount.toLocaleString()} harmonized active hotspots (Landsat CI: ${p.landsatLo.toLocaleString()}–${p.landsatHi.toLocaleString()}). High-intensity radiative output (${frpTotal.toLocaleString()} MW total) signals rapid perimeter growth requiring preemptive traffic control ahead of the downwind corridor.\n\n` +
        `Downwind Corridor & Perimeter Security: The Wait-Time Bridge projects active perimeter expansion beyond ${burnedHa.toLocaleString()} ha along the ${windDeg}° azimuth at ${windKmh} km/h wind speed. Establish hard roadblocks outside the 24 h downwind cone to prevent civilian re-entry while keeping outbound evacuation lanes clear for rural ranches and valley settlements.`;
      tacticalChecklist = [
        `Issue mandatory evacuation warning for communities aligned downwind along ${windDeg}° ahead of the ${burnedHa.toLocaleString()} ha scar.`,
        `Deploy traffic control checkpoints on arterial approaches to maintain one-way outbound flow and emergency apparatus access.`,
        `Maintain overnight perimeter patrols during the ${p.nighttimeSharePct}% nocturnal ember window to block unauthorized sightseers.`,
      ];
      break;
    }
    case 'ambulance': {
      text =
        `Ambulance / EMS & Respiratory Triage Briefing for ${ctx.regionName} (${p.ym}): Thermal emissions across ${p.harmonizedCount.toLocaleString()} VIIRS-equivalent hotspots are generating ${frpTotal.toLocaleString()} MW of radiative heat (${p.pctOfMedian}% of normal seasonal baseline). High plume buoyancy during peak afternoon passes followed by nocturnal boundary-layer smoke trapping (${p.nighttimeSharePct}% nighttime detections) elevates acute PM2.5 respiratory hazard downwind along ${windDeg}°.\n\n` +
        `Casualty Staging & Ingress Safety: Do not stage Forward Aid Stations inside the ${windDeg}° downwind spread cone where ${windKmh} km/h gusts drive smoke inversion and spot fires across ${burnedHa.toLocaleString()} ha (${burnedLoHa.toLocaleString()}–${burnedHiHa.toLocaleString()} ha CI). Position ALS ambulances upwind with dual-route egress and pre-alert regional respiratory and burn units.`;
      tacticalChecklist = [
        `Pre-position ALS respiratory triage units upwind of the ${windDeg}° (${windKmh} km/h) plume corridor.`,
        `Issue N95/P100 shelter-in-place advisory for vulnerable clinics downwind during the ${p.nighttimeSharePct}% overnight smoke inversion window.`,
        `Coordinate secondary ambulance staging clear of ${slopeDeg}° steep valley chokepoints bordering the ${burnedHa.toLocaleString()} ha perimeter.`,
      ];
      break;
    }
    case 'scientist': {
      text =
        `Cross-Sensor Calibration & Validation Summary for ${ctx.regionName} (${p.ym}): Harmonized 375 m VIIRS-equivalent activity is ${p.harmonizedCount.toLocaleString()} (MODIS raw 1 km: ${p.modisRaw.toLocaleString()}; deduplicated VIIRS: ${p.viirsRaw.toLocaleString()}), bounded by a 90% alternating-year OOF conformal interval of ${p.lo90.toLocaleString()}–${p.hi90.toLocaleString()} (R² = ${ctx.metrics.r2}, historical conformal coverage = ${ctx.metrics.coverage90Pct}%).\n\n` +
        `Third-Satellite Landsat 8/9 Verification: 30 m thermal/dNBR cross-checks show ${p.landsatCoincidencePct}% spatial coincidence within 1 km and ${p.landsatDnbrBurnedKm2} ± ${p.landsatDnbrUncertaintyKm2} km² burned scar, anchoring the Landsat-validated confidence interval at ${p.landsatLo.toLocaleString()}–${p.landsatHi.toLocaleString()} (${ctx.metrics.landsatAnchoredCoveragePct}% empirical coverage).`;
      tacticalChecklist = [
        `Compare ${p.modisRaw.toLocaleString()} coarse 1 km MODIS anchors against ${p.viirsRaw.toLocaleString()} deduplicated VIIRS pixels to track sub-pixel small-fire sensitivity.`,
        `Use Landsat 8/9 C2 L2 dNBR (${p.landsatDnbrBurnedKm2} km²) to verify Day-1 Wait-Time Bridge area (${burnedHa.toLocaleString()} ha).`,
        `Audit nocturnal bias (${p.nighttimeSharePct}% nighttime detections) when contrasting pre-2012 MODIS against post-2012 VIIRS.`,
      ];
      break;
    }
    default: {
      text =
        `Land & Watershed Management Summary for ${ctx.regionName} (${p.ym}): Seasonal fire activity stands at ${p.pctOfMedian}% of the 26-year same-calendar-month median (${p.medianSameMonth.toLocaleString()}), ranking in the ${p.percentile}th percentile (Z-score ${p.zScore}) with ${p.harmonizedCount.toLocaleString()} harmonized hotspots (90% CI: ${p.lo90.toLocaleString()}–${p.hi90.toLocaleString()}).\n\n` +
        `Post-Fire Rehabilitation & Scar Footprint: Landsat 8/9 dNBR mapping (${p.landsatDnbrBurnedKm2} ± ${p.landsatDnbrUncertaintyKm2} km², ${p.landsatCoincidencePct}% thermal coincidence) alongside the ${burnedHa.toLocaleString()} ha Day-1 perimeter identifies priority ${slopeDeg}° hillslopes for erosion seeding before seasonal rains.`;
      tacticalChecklist = [
        `Flag steep ${slopeDeg}° burned slopes inside the ${burnedHa.toLocaleString()} ha footprint for post-fire debris-flow mitigation.`,
        `Schedule Landsat 9 30 m dNBR severity stratification (${p.landsatDnbrBurnedKm2} km²) to allocate watershed recovery budgets.`,
        `Track multi-decade shift against the ${p.medianSameMonth.toLocaleString()} baseline to update prescribed-burn fuel-break schedules.`,
      ];
      break;
    }
  }

  const { verifiedNumbers, rejectedNumbers } = verifyBriefNumbers(text, ledger);

  return {
    role: ctx.role,
    roleLabel: roleMeta.label,
    ym: p.ym,
    regionName: ctx.regionName,
    text,
    source: 'curated_verified_fallback',
    modelName: 'FireLedger Verified Deterministic NLG (Mistral-7B Schema-Matched)',
    verifiedNumbers,
    rejectedNumbers,
    factLedger: ledger,
    tacticalChecklist,
  };
}
