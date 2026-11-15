import { parseTLE, normalizeAOI } from "./satellites.js";
import { predictOverpasses } from "./overpasses.js";
import { createSatelliteLayer } from "./cesiumLayer.js";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const observationTime=row=>{
  if(!/^\d{4}-\d\d-\d\d$/.test(row.acq_date||"")) return NaN;
  const hhmm=String(row.acq_time||"").padStart(4,"0");
  return Date.parse(row.acq_date+"T"+hhmm.slice(0,2)+":"+hhmm.slice(2,4)+":00Z");
};
const matchesSatellite=(row,pass)=>{
  // MODIS_NRT combines Terra and Aqua; use source satellite field when present.
  const satellite=String(row.satellite||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  if(pass.sensor==="MODIS") return satellite===pass.id;
  return pass.id==="noaa20" ? /n20|noaa20|j1/.test(satellite) :
    pass.id==="noaa21" ? /n21|noaa21|j2/.test(satellite) : false;
};
function uniqueObservations(rows,pass) {
  return rows.filter(row=>matchesSatellite(row,pass)&&Number.isFinite(observationTime(row))&&
    observationTime(row)>=Date.parse(pass.start)-5*60000 &&
    observationTime(row)<=Date.parse(pass.end)+5*60000);
}
// Callback-based integration with existing AOI selector, harmonization and calendar.
// A pass predicts opportunity only. A successful HTTP response is NOT proof of new observations.
export async function createSatelliteMonitor({viewer,Cesium,onHotspots=()=>{},onStatus=()=>{},onSchedule=()=>{},baseUrl=""}) {
  const response=await fetch(baseUrl+"/api/satellites/tle");
  if(!response.ok) throw Error("TLE endpoint failed: "+response.status);
  const payload=await response.json();
  const records=payload.satellites.flatMap(s=>s.text?parseTLE(s.text):[]);
  if(!records.length) throw Error("No usable TLE available; cannot predict satellite passes");
  const layer=createSatelliteLayer(viewer,Cesium,records);
  let aoi=null, passes=[],generation=0,active=false,lastUpdated=null;
  const completed=new Set();
  let timer=null;
  const emit=(status,extra={})=>onStatus({status,aoi,lastUpdated,...extra});
  const loadSchedule=()=>{
    if(!aoi)return;
    passes=predictOverpasses(records,aoi,{start:new Date(),hours:24});
    onSchedule(passes);
  };
  async function refreshAfterPass(pass,version){
    const begun=Date.now();
    const deadline=Date.parse(pass.end)+3*3600000;
    // Wait until predicted exit; data availability may lag the satellite by hours.
    while(active&&version===generation&&Date.now()<deadline) {
      const delay=Math.max(0,Date.parse(pass.end)-Date.now());
      if(delay)await sleep(Math.min(delay,60000));
      if(!active||version!==generation)break;
      emit("checking-firms",{pass});
      try {
        const qs=new URLSearchParams({source:pass.source,...Object.fromEntries(Object.entries(aoi).map(([k,v])=>[k,String(v)]))});
        const r=await fetch(baseUrl+"/api/firms/hotspots?"+qs);
        if(!r.ok)throw Error("FIRMS HTTP "+r.status);
        const data=await r.json();
        const observations=uniqueObservations(data.rows,pass);
        if(observations.length){
          lastUpdated=new Date().toISOString();
          await onHotspots({pass,rows:observations,allRows:data.rows,aoi,checkedAt:data.checkedAt});
          emit("observations-published",{pass,count:observations.length});
          return;
        }
        emit("awaiting-publication",{pass});
      }catch(e){emit("firms-error",{pass,error:String(e.message)});}
      await sleep(10*60000); // 10 minute poll; server also caches requests for 10 minutes
    }
    if(active&&version===generation)emit("no-observations-confirmed",{pass});
  }
  function tick(){
    if(!active||!aoi)return;
    const now=Date.now();
    for(const pass of passes){
      const key=pass.id+":"+pass.start;
      if(now>=Date.parse(pass.start)&&now<Date.parse(pass.end)) emit("overpass-in-progress",{pass});
      if(now>=Date.parse(pass.end)&&!completed.has(key)){
        completed.add(key);
        void refreshAfterPass(pass,generation);
      }
    }
    // Schedule rolling forecast recomputed on every AOI change and at least hourly.
  }
  let hourly=null;
  active=true;
  timer=setInterval(tick,1000);
  hourly=setInterval(()=>{if(active){loadSchedule();tick();}},3600000);
  return {
    layer,
    getState(){return {aoi,passes,lastUpdated,records:layer.getSatellites()};},
    setAOI(next){aoi=normalizeAOI(next);generation++;completed.clear();loadSchedule();emit("awaiting-overpass");tick();},
    clearAOI(){generation++;aoi=null;passes=[];completed.clear();onSchedule([]);emit("no-aoi");},
    destroy(){active=false;generation++;clearInterval(timer);clearInterval(hourly);layer.destroy();}
  };
}
