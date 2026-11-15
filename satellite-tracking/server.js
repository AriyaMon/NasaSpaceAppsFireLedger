// Node 20+ small read-only adapter. Never exposes FIRMS_MAP_KEY to browser.
import http from "node:http";
import { SATELLITES, normalizeAOI } from "./satellites.js";
const PORT=Number(process.env.PORT||8787);
const cache=new Map();
const FIRMS_SOURCES=new Set(["MODIS_NRT","VIIRS_NOAA20_NRT","VIIRS_NOAA21_NRT"]);
const json=(res,status,payload)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":process.env.APP_ORIGIN||"null"});res.end(JSON.stringify(payload));};
async function cached(key,ttl,load) {
  const old=cache.get(key), now=Date.now();
  if(old&&now<old.expires) return old.value;
  const value=await load(); cache.set(key,{value,expires:now+ttl}); return value;
}
async function getTles(){
  return await Promise.all(SATELLITES.map(async s=>{
    try{
      const text=await cached("tle:"+s.norad,2*3600000,async()=>{
        const url="https://celestrak.org/NORAD/elements/gp.php?CATNR="+s.norad+"&FORMAT=TLE";
        const res=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{"User-Agent":"FireLedger satellite monitor (research prototype)"}});
        if(!res.ok) throw Error("CelesTrak HTTP "+res.status);
        const data=await res.text();
        if(!data.includes("\n1 ")||!data.includes("\n2 ")) throw Error("No TLE returned");
        return data;
      });
      return {id:s.id,norad:s.norad,text};
    }catch(e){return {id:s.id,norad:s.norad,error:String(e.message)};}
  }));
}
const csvToRecords=text=>{
  const rows=text.trim().split(/\r?\n/);
  if(!rows.length||!rows[0].includes("latitude")) throw Error("Unexpected FIRMS response");
  // CSV quoting (escaped quotes, commas in fields).
  const split=row=>{const fields=[];let out="",quoted=false;for(let i=0;i<row.length;i++){const c=row[i];if(c==='"'&&row[i+1]==='"'&&quoted){out+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===","&&!quoted){fields.push(out);out="";}else out+=c;}fields.push(out);return fields;};
  const headers=split(rows.shift()).map(s=>s.trim());
  return rows.filter(Boolean).map(row=>Object.fromEntries(split(row).map((value,i)=>[headers[i],value]))).filter(r=>r.latitude&&r.longitude);
};
async function getFirms(source,aoi) {
  if(!process.env.FIRMS_MAP_KEY) throw Error("FIRMS_MAP_KEY missing on server");
  const bbox=[aoi.west,aoi.south,aoi.east,aoi.north].join(",");
  const url="https://firms.modaps.eosdis.nasa.gov/api/area/csv/"+encodeURIComponent(process.env.FIRMS_MAP_KEY)+"/"+source+"/"+bbox+"/1";
  const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
  if(!response.ok) throw Error("FIRMS HTTP "+response.status);
  const text=await response.text();
  if(text.length>10000000) throw Error("FIRMS response unexpectedly large: narrow AOI");
  return csvToRecords(text);
}
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,"http://localhost");
    if(req.method!=="GET") return json(res,405,{error:"GET only"});
    if(url.pathname==="/api/satellites/tle") return json(res,200,{fetchedAt:new Date().toISOString(),satellites:await getTles()});
    if(url.pathname==="/api/firms/hotspots") {
      const source=url.searchParams.get("source");
      if(!FIRMS_SOURCES.has(source)) return json(res,400,{error:"Unsupported active FIRMS source"});
      const aoi=normalizeAOI(Object.fromEntries(["west","south","east","north"].map(k=>[k,url.searchParams.get(k)])));
      if((aoi.east-aoi.west)*(aoi.north-aoi.south)>2500) return json(res,400,{error:"Choose a smaller AOI"});
      const key=JSON.stringify({source,aoi});
      const rows=await cached("firms:"+key,10*60000,()=>getFirms(source,aoi));
      return json(res,200,{source,checkedAt:new Date().toISOString(),rows});
    }
    json(res,404,{error:"Not found"});
  } catch(e){console.error("Satellite API error:",e.message);json(res,502,{error:e.message.replace(/\b[A-Fa-f0-9]{32}\b/g,"[REDACTED]")});}
}).listen(PORT,()=>console.log("FireLedger satellite adapter listening on",PORT));
