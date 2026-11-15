import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Popup,type Map as MapLibreMap,type GeoJSONSource} from 'maplibre-gl';
import type {Bbox} from '../lib/types.ts';
import {SATELLITES,loadTles,parseTracks,location,predict,type Track,type Pass} from '../lib/satelliteTracking.ts';

type Props={map:MapLibreMap|null; bbox:Bbox; regionName:string; onRefresh?:()=>Promise<unknown>};
type State='loading'|'ready'|'stale'|'unavailable'|'overpass'|'checking'|'awaiting-publication'|'updated'|'backend-required';
const empty={type:'FeatureCollection',features:[]} as const;
const signalColor=(t:Track)=>t.operational?(t.sensor==='VIIRS'?'#63e6fb':'#f0bf69'):'#8b929e';
function swathRing(lon:number,lat:number,km:number){
  const points:number[][]=[];
  for(let i=0;i<=36;i++){
    const angle=i*Math.PI/18,latDelta=(km/111.2)*Math.cos(angle);
    const cos=Math.max(.16,Math.cos(lat*Math.PI/180));
    const lonDelta=(km/(111.2*cos))*Math.sin(angle);
    points.push([Math.max(-179.99,Math.min(179.99,lon+lonDelta)),Math.max(-89.9,Math.min(89.9,lat+latDelta))]);
  }
  return points;
}
export const SatelliteTracking:React.FC<Props>=({map,bbox,regionName,onRefresh})=>{
  const [tracks,setTracks]=useState<Track[]>([]);
  const [state,setState]=useState<State>('loading');
  const [detail,setDetail]=useState('');
  const [now,setNow]=useState(Date.now());
  const [visible,setVisible]=useState<Record<string,boolean>>({});
  const [pathsOn,setPathsOn]=useState(true);
  const [swathsOn,setSwathsOn]=useState(false);
  const [passes,setPasses]=useState<Pass[]>([]);
  const [lastUpdate,setLastUpdate]=useState<string|null>(null);
  const lastPass=useRef(new Set<string>());
  const pollTimer=useRef<ReturnType<typeof setInterval>|null>(null);
  const polls=useRef(0);
  const bboxRef=useRef(bbox); bboxRef.current=bbox;
  const tracksRef=useRef(tracks);tracksRef.current=tracks;
  const visibleRef=useRef(visible);visibleRef.current=visible;
  const pathsRef=useRef(pathsOn);pathsRef.current=pathsOn;
  const swathsRef=useRef(swathsOn);swathsRef.current=swathsOn;

  useEffect(()=>{
    let cancelled=false;
    const fetchTracks=async()=>{
      try{
        const raw=await loadTles();
        if(cancelled)return;
        const parsed=parseTracks(raw);
        setTracks(parsed);
        setState(parsed.some(t=>t.fresh)?'ready':parsed.length?'stale':'unavailable');
        setDetail(parsed.length?'TLE/SGP4 predicted ground tracks.':'TLE source unavailable; check server or CelesTrak CORS.');
      }catch(e){if(!cancelled){setState('unavailable');setDetail(String(e));}}
    };
    void fetchTracks();
    const timer=setInterval(()=>void fetchTracks(),2*3600000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[]);

  useEffect(()=>{
    if(!map)return;
    const sources=['fireledger-satellites','fireledger-orbits','fireledger-swaths'];
    if(sources.some(s=>!!map.getSource(s)))return;
    map.addSource(sources[0],{type:'geojson',data:empty});
    map.addSource(sources[1],{type:'geojson',data:empty});
    map.addSource(sources[2],{type:'geojson',data:empty});
    map.addLayer({id:'fireledger-orbit-lines',type:'line',source:sources[1],paint:{'line-color':['get','color'],'line-opacity':0.65,'line-width':1.5,'line-dasharray':[2,2]}});
    map.addLayer({id:'fireledger-swath-fill',type:'fill',source:sources[2],paint:{'fill-color':['get','color'],'fill-opacity':0.10}});
    map.addLayer({id:'fireledger-swath-outline',type:'line',source:sources[2],paint:{'line-color':['get','color'],'line-opacity':0.35,'line-width':1}});
    map.addLayer({id:'fireledger-satellite-markers',type:'circle',source:sources[0],paint:{
      'circle-radius':7,'circle-color':['get','color'],'circle-stroke-color':'#04111a','circle-stroke-width':2
    }});
    // Name/details are in the panel and click popup. The existing raster style has no glyphs URL.
    const handler=(e:any)=>{
      const props=e.features?.[0]?.properties;
      if(!props)return;
      new Popup({closeButton:true,maxWidth:'270px'}).setLngLat(e.lngLat)
        .setText(props.name+' · '+props.sensor+' · '+props.altitudeKm+' km altitude · '+(props.operational?'Active':'No new data')+' · TLE position estimate')
        .addTo(map);
    };
    map.on('click','fireledger-satellite-markers',handler);
    return()=>{
      map.off('click','fireledger-satellite-markers',handler);
      for(const id of ['fireledger-satellite-markers','fireledger-swath-outline','fireledger-swath-fill','fireledger-orbit-lines'])
        if(map.getLayer(id))map.removeLayer(id);
      for(const id of sources)if(map.getSource(id))map.removeSource(id);
    };
  },[map]);

  useEffect(()=>{
    if(!map)return;
    const render=()=>{
      const current=Date.now(),items=tracksRef.current.filter(t=>visibleRef.current[t.id]!==false);
      const markers:any[]=[],orbits:any[]=[],swaths:any[]=[];
      for(const sat of items){
        const p=location(sat,new Date(current));if(!p)continue;
        const color=signalColor(sat);
        markers.push({type:'Feature',properties:{id:sat.id,name:sat.name,sensor:sat.sensor,color,altitudeKm:Math.round(p.altitudeKm),operational:sat.operational},geometry:{type:'Point',coordinates:[p.lon,p.lat]}});
        if(pathsRef.current){
          let segment:number[][]=[],segments:number[][][]=[];
          for(let delta=-50;delta<=100;delta+=2){
            const point=location(sat,new Date(current+delta*60000));if(!point)continue;
            if(segment.length&&Math.abs(point.lon-segment[segment.length-1][0])>180){if(segment.length>1)segments.push(segment);segment=[];}
            segment.push([point.lon,point.lat]);
          }
          if(segment.length>1)segments.push(segment);
          for(const coords of segments)orbits.push({type:'Feature',properties:{color},geometry:{type:'LineString',coordinates:coords}});
        }
        if(swathsRef.current)swaths.push({type:'Feature',properties:{color},geometry:{type:'Polygon',coordinates:[swathRing(p.lon,p.lat,sat.swathKm/2)]}});
      }
      for(const [name,features] of [['fireledger-satellites',markers],['fireledger-orbits',orbits],['fireledger-swaths',swaths]] as const)
        (map.getSource(name) as GeoJSONSource|undefined)?.setData({type:'FeatureCollection',features} as any);
    };
    render();
    const timer=setInterval(render,15000);
    return()=>clearInterval(timer);
  },[map,tracks,visible,pathsOn,swathsOn]);

  useEffect(()=>{
    lastPass.current.clear();
    if(pollTimer.current){clearInterval(pollTimer.current);pollTimer.current=null;}
    polls.current=0;
    setPasses(predict(tracks,bbox));
  },[tracks,bbox.west,bbox.south,bbox.east,bbox.north]);

  useEffect(()=>{
    const timer=setInterval(()=>{
      const t=Date.now();setNow(t);
      const candidates=predict(tracks,bbox,t).filter(p=>p.end>t);
      // Recompute every 10 minutes, rather than each second.
      if(t%600000<1000)setPasses(candidates);
    },1000);
    return()=>clearInterval(timer);
  },[tracks,bbox]);

  useEffect(()=>{
    if(!onRefresh||!passes.length)return;
    const current=passes.find(p=>p.start<=now&&now<p.end);
    if(current)setState('overpass');
    const finished=passes.find(p=>p.end<=now&&now-p.end<10*60000&&!lastPass.current.has(p.id+':'+p.start));
    if(finished){
      lastPass.current.add(finished.id+':'+finished.start);
      polls.current=0;
      const check=async()=>{
        polls.current++;
        setState('checking');
        try{
          const result=await onRefresh();
          if((result as any)?.liveFetched){
            setState('awaiting-publication');
            setDetail('FIRMS API checked; data publication is not confirmed, and historical analytics have not been recomputed.');
          }else{setState('backend-required');setDetail('Static hosting or FIRMS API not configured.');}
        }catch{setState('awaiting-publication');}
        if(polls.current>=18&&pollTimer.current){clearInterval(pollTimer.current);pollTimer.current=null;}
      };
      void check();
      if(pollTimer.current)clearInterval(pollTimer.current);
      pollTimer.current=setInterval(()=>void check(),10*60000);
    }
  },[now,passes,onRefresh]);
  useEffect(()=>()=>{if(pollTimer.current)clearInterval(pollTimer.current);},[]);
  const upcoming=useMemo(()=>passes.filter(p=>p.end>now).slice(0,5),[passes,now]);
  const next=upcoming[0];
  const remaining=next?Math.max(0,Math.floor((next.start-now)/1000)):0;
  const clock=[Math.floor(remaining/3600),Math.floor(remaining/60)%60,remaining%60].map(n=>String(n).padStart(2,'0')).join(':');
  return <div className="absolute bottom-11 right-3.5 z-20 max-h-[300px] w-[min(310px,74%)] overflow-y-auto rounded border border-sky-400/25 bg-[#07111d]/95 p-3 text-[11px] text-stone-200 shadow-lg backdrop-blur-md">
    <div className="mb-1 flex items-center justify-between"><strong className="tracking-wide text-sky-200">TLE SATELLITE MONITOR</strong><span className="text-sky-400">{tracks.length}/5 tracked</span></div>
    <div className="truncate text-stone-400">AOI: {regionName}</div>
    <div className="mt-1 font-mono text-[10px]">Status: {state.replaceAll('-',' ')}</div>
    <div className="font-mono text-amber-200">Next: {next?`${next.name} (${next.sensor}) · ${clock}`:'No predicted pass'}</div>
    {next&&<div className="text-stone-400">Estimated {new Date(next.start).toLocaleString()} · UTC {new Date(next.start).toISOString().slice(11,16)}</div>}
    <div className="mt-2 flex flex-wrap gap-2">
      <label><input type="checkbox" checked={pathsOn} onChange={e=>setPathsOn(e.target.checked)}/> Tracks</label>
      <label><input type="checkbox" checked={swathsOn} onChange={e=>setSwathsOn(e.target.checked)}/> Swaths</label>
    </div>
    <div className="mt-1 grid grid-cols-2 gap-1">{SATELLITES.map(s=><label key={s.id} className="truncate"><input type="checkbox" checked={visible[s.id]!==false} onChange={e=>setVisible(v=>({...v,[s.id]:e.target.checked}))}/> {s.name}{!s.operational?' (inactive)':''}</label>)}</div>
    <details className="mt-2"><summary className="cursor-pointer">Upcoming overpasses ({upcoming.length})</summary>{upcoming.map(p=><div key={p.id+p.start}>{p.name}: {new Date(p.start).toLocaleString()}</div>)}</details>
    <div className="mt-1 text-stone-400">Last confirmed data update: {lastUpdate?new Date(lastUpdate).toLocaleString():'not confirmed'}</div>
    {detail&&<div className="mt-1 text-stone-500">{detail}</div>}
    <div className="mt-1 text-[10px] text-stone-500">Approximate ground tracks/swaths; not altitude-rendered satellites or confirmed observations. FIRMS can lag hours.</div>
  </div>;
};
