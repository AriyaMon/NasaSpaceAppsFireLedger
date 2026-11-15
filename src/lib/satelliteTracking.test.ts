import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SATELLITES,greatCircleKm,parseTracks,predict,sampleBbox} from './satelliteTracking.ts';

test('five instrument carriers are catalogued',()=>{
  assert.deepEqual(SATELLITES.map(s=>s.name),['Terra','Aqua','Suomi NPP','NOAA-20','NOAA-21']);
  assert.equal(SATELLITES.find(s=>s.id==='snpp')?.operational,false);
});
test('TLE input missing records is explicit, never fabricated',()=>{
  assert.deepEqual(parseTracks({}),[]);
  assert.deepEqual(predict([],{west:-125,south:32,east:-114,north:42}),[]);
});
test('AOI sampling and distance use geographic coordinates',()=>{
  assert.equal(sampleBbox({west:-125,south:32,east:-114,north:42}).length,25);
  assert.ok(Math.abs(greatCircleKm({lat:0,lon:0},{lat:0,lon:1})-111.195)<0.2);
});
