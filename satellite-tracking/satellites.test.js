import test from "node:test";
import assert from "node:assert/strict";
import { SATELLITES, normalizeAOI, distanceKm, parseTLE, isFresh } from "./satellites.js";
import { predictOverpasses } from "./overpasses.js";

test("catalog includes exactly five platforms and marks S-NPP non-operational",()=>{
  assert.equal(SATELLITES.length,5);
  assert.equal(SATELLITES.find(s=>s.id==="snpp").operational,false);
});
test("AOI rejects invalid bounds and accepts California bounds",()=>{
  assert.throws(()=>normalizeAOI({west:170,east:-170,south:0,north:10}));
  assert.deepEqual(normalizeAOI({west:-125,east:-114,south:32,north:42}),{west:-125,east:-114,south:32,north:42});
});
test("great circle distance returns zero for identical coordinates",()=>{
  assert.equal(distanceKm({lat:0,lon:0},{lat:0,lon:0}),0);
  assert.ok(Math.abs(distanceKm({lat:0,lon:0},{lat:0,lon:1})-111.195)<0.1);
});
test("no TLE gives empty predictions",()=>{
  assert.deepEqual(predictOverpasses([],{west:-125,east:-114,south:32,north:42}),[]);
});
test("stale epoch checks",()=>{
  const now=new Date("2026-11-14T12:00:00Z");
  assert.equal(isFresh(new Date("2026-11-12T12:00:00Z"),now),true);
  assert.equal(isFresh(new Date("2026-10-01T12:00:00Z"),now),false);
});
test("invalid TLE gives empty catalog",()=>assert.deepEqual(parseTLE("not a valid TLE"),[]));
