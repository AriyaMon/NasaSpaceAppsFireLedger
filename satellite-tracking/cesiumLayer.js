import { positionAt, SATELLITES } from "./satellites.js";
// Pass the Cesium namespace and an already existing Cesium Viewer.
// No new globe is created, no Cesium token is required here.
export function createSatelliteLayer(viewer,Cesium,records) {
  const entities=new Map();
  const disposables=[];
  for(const record of records) {
    const color=record.operational?Cesium.Color.CYAN:Cesium.Color.GRAY;
    const position=new Cesium.CallbackPositionProperty(time=>{
      const date=Cesium.JulianDate.toDate(time),p=positionAt(record,date);
      return p?Cesium.Cartesian3.fromDegrees(p.lon,p.lat,p.altitudeKm*1000):undefined;
    },false);
    // Orbit sampled around current time; refresh periodically rather than recomputing per frame.
    const path=viewer.entities.add({
      name:record.name+" projected orbit",show:true,
      polyline:{positions:[],width:1,material:color.withAlpha(0.35),clampToGround:false}
    });
    const ground=viewer.entities.add({
      name:record.name+" approximate swath (at subsatellite point)",show:false,
      position:new Cesium.CallbackPositionProperty(time=>{
        const p=positionAt(record,Cesium.JulianDate.toDate(time));
        return p?Cesium.Cartesian3.fromDegrees(p.lon,p.lat,1000):undefined;
      },false),
      ellipse:{semiMajorAxis:record.swathKm*500,semiMinorAxis:record.swathKm*500,
        material:color.withAlpha(0.08),outline:true,outlineColor:color.withAlpha(0.28)}
    });
    const marker=viewer.entities.add({
      name:record.name,show:true,position,
      point:{pixelSize:9,color,outlineColor:Cesium.Color.BLACK,outlineWidth:1},
      label:{text:record.name,font:"12px sans-serif",pixelOffset:new Cesium.Cartesian2(0,-18),fillColor:color},
      description:`<strong>${record.sensor}</strong><p>${record.note}</p><p>Swath is approximate. Position from TLE/SGP4, not live spacecraft telemetry.</p>`
    });
    entities.set(record.id,{record,marker,path,ground});
  }
  function refreshOrbitPaths(){
    const now=new Date();
    for(const {record,path} of entities.values()){
      const positions=[];
      for(let m=-50;m<=100;m+=2){
        const p=positionAt(record,new Date(+now+m*60000));
        if(p) positions.push(Cesium.Cartesian3.fromDegrees(p.lon,p.lat,p.altitudeKm*1000));
      }
      path.polyline.positions=positions;
    }
  }
  refreshOrbitPaths();
  const interval=setInterval(refreshOrbitPaths,5*60000);
  disposables.push(()=>clearInterval(interval));
  return {
    setVisibility(id,visible){const x=entities.get(id);if(x){x.marker.show=visible;x.path.show=visible;x.ground.show=visible&&x.ground.show;}},
    setSwathVisibility(id,visible){const x=entities.get(id);if(x)x.ground.show=visible;},
    getSatellites(){return [...entities.values()].map(({record})=>({id:record.id,name:record.name,sensor:record.sensor,operational:record.operational,tleFresh:record.tleFresh,epoch:record.epoch.toISOString()}));},
    destroy(){disposables.forEach(fn=>fn());for(const x of entities.values())for(const e of [x.marker,x.path,x.ground])viewer.entities.remove(e);}
  };
}
