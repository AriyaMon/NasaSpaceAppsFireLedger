import * as sgp4 from 'satellite.js';
import type { Bbox } from './types.ts';

export type SatelliteDef = {
  id: string; name: string; sensor: 'MODIS' | 'VIIRS'; norad: number;
  swathKm: number; operational: boolean; note: string;
};
export const SATELLITES: SatelliteDef[] = [
  { id:'terra',name:'Terra',sensor:'MODIS',norad:25994,swathKm:2330,operational:true,note:'Mission operations subject to change' },
  { id:'aqua',name:'Aqua',sensor:'MODIS',norad:27424,swathKm:2330,operational:true,note:'Mission operations subject to change' },
  { id:'snpp',name:'Suomi NPP',sensor:'VIIRS',norad:37849,swathKm:3040,operational:false,note:'No new FIRMS VIIRS observations since November 2026' },
  { id:'noaa20',name:'NOAA-20',sensor:'VIIRS',norad:43013,swathKm:3040,operational:true,note:'Operational status should be verified' },
  { id:'noaa21',name:'NOAA-21',sensor:'VIIRS',norad:54234,swathKm:3040,operational:true,note:'Operational status should be verified' },
];
export type Track = SatelliteDef & { rec: sgp4.SatRec; epoch: Date; fresh: boolean };
export type Pass = { id:string; name:string; sensor:string; start:number; end:number; approximate:true };
const RAD=Math.PI/180;
function epochFromLine(line:string) {
  const year=Number(line.slice(18,20)), day=Number(line.slice(20,32));
  return new Date(Date.UTC(year>=57?1900+year:2000+year,0,1)+(day-1)*86400000);
}
export function parseTracks(raw:Record<string,string>, now=new Date()):Track[] {
  return SATELLITES.flatMap(def=>{
    const text=raw[String(def.norad)];
    if(!text)return [];
    const lines=text.split(/\r?\n/).map(s=>s.trim());
    const l1=lines.find(s=>s.startsWith('1 '));
    const l2=lines.find(s=>s.startsWith('2 '));
    if(!l1||!l2||l1.slice(2,7)!==l2.slice(2,7)||Number(l1.slice(2,7))!==def.norad)return [];
    try{
      const rec=sgp4.twoline2satrec(l1,l2),epoch=epochFromLine(l1);
      return [{...def,rec,epoch,fresh:Number.isFinite(+epoch)&&Math.abs(+now-+epoch)<7*86400000}];
    }catch{return [];}
  });
}
export function location(track:Track,date:Date) {
  const pv=sgp4.propagate(track.rec,date);
  if(!pv.position||typeof pv.position==='boolean')return null;
  const p=sgp4.eciToGeodetic(pv.position,sgp4.gstime(date));
  const lon=((p.longitude/RAD+540)%360)-180,lat=p.latitude/RAD;
  if(![lon,lat,p.height].every(Number.isFinite))return null;
  return {lon,lat,altitudeKm:p.height};
}
export function greatCircleKm(a:{lat:number;lon:number},b:{lat:number;lon:number}) {
  const dLat=(b.lat-a.lat)*RAD,dLon=(b.lon-a.lon)*RAD;
  const h=Math.sin(dLat/2)**2+Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin(dLon/2)**2;
  return 12742.0176*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function sampleBbox(b:Bbox) {
  if(b.east-b.west>300)return [{lat:0,lon:0}]; // worldwide AOI: use center only; no precise pass claims
  const samples:{lat:number;lon:number}[]=[];
  for(let j=0;j<=4;j++)for(let i=0;i<=4;i++)samples.push({
    lon:b.west+(b.east-b.west)*i/4,lat:b.south+(b.north-b.south)*j/4
  });
  return samples;
}
function crosses(track:Track,points:{lat:number;lon:number}[],time:number) {
  const pos=location(track,new Date(time));
  return !!pos&&points.some(point=>greatCircleKm(pos,point)<=track.swathKm/2);
}
export function predict(tracks:Track[],bbox:Bbox,now=Date.now()):Pass[] {
  if(bbox.east-bbox.west>300)return [];
  const pts=sampleBbox(bbox),end=now+24*3600000,step=45000,passes:Pass[]=[];
  for(const t of tracks.filter(t=>t.operational&&t.fresh)){
    let active=crosses(t,pts,now),entered=active?now:0;
    for(let time=now+step;time<=end+step;time+=step){
      const at=Math.min(time,end),hit=crosses(t,pts,at);
      if(hit&&!active)entered=at;
      if(!hit&&active&&entered)passes.push({id:t.id,name:t.name,sensor:t.sensor,start:entered,end:at,approximate:true});
      active=hit;
      if(at===end)break;
    }
    if(active&&entered)passes.push({id:t.id,name:t.name,sensor:t.sensor,start:entered,end,approximate:true});
  }
  return passes.sort((a,b)=>a.start-b.start);
}
export async function loadTles():Promise<Record<string,string>> {
  const backend=await fetch('/api/satellites/tles',{signal:AbortSignal.timeout(12000)}).then(async r=>{
    if(!r.ok||!r.headers.get('content-type')?.includes('json'))throw Error('No backend');
    return await r.json() as {tles:Record<string,string>};
  }).catch(()=>null);
  if(backend?.tles&&Object.keys(backend.tles).length)return backend.tles;
  // Static GitHub Pages: direct CelesTrak request; browsers may block it via CORS.
  const entries=await Promise.all(SATELLITES.map(async s=>{
    try{
      const r=await fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR='+s.norad+'&FORMAT=TLE',{signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw Error('TLE unavailable');
      return [String(s.norad),await r.text()] as const;
    }catch{return [String(s.norad),''] as const;}
  }));
  return Object.fromEntries(entries);
}
