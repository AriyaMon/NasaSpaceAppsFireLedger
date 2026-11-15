import { SATELLITES, aoiSamplePoints, distanceKm, positionAt } from "./satellites.js";
const MINUTE=60000;
// A geographic swath test, not a claim that an observation was collected or published.
export function intersectsSwath(record, points, date) {
  const pos=positionAt(record,date);
  return !!pos && points.some(p=>distanceKm(pos,p)<=record.swathKm/2);
}
function crossing(record,points,left,right,entering) {
  for(let n=0;n<9;n++) {
    const middle=new Date((+left+ +right)/2);
    if(intersectsSwath(record,points,middle)===entering) right=middle;
    else left=middle;
  }
  return right;
}
export function predictOverpasses(records,aoi,{start=new Date(),hours=24,stepSeconds=45}={}) {
  if(hours<=0 || hours>72 || stepSeconds<10) throw new Error("Prediction window or step invalid");
  const points=aoiSamplePoints(aoi), results=[];
  for(const record of records) {
    if(!record.operational || !record.tleFresh) continue;
    const end=+start + hours*60*MINUTE, step=stepSeconds*1000;
    let prev=new Date(start), was=intersectsSwath(record,points,prev), passStart=was?prev:null;
    for(let t=+start+step;t<=end+step;t+=step) {
      const current=new Date(Math.min(t,end));
      const hit=intersectsSwath(record,points,current);
      if(hit&&!was) passStart=crossing(record,points,prev,current,true);
      if(!hit&&was&&passStart) {
        const exit=crossing(record,points,prev,current,false);
        results.push({id:record.id, name:record.name, sensor:record.sensor, source:record.source, start:new Date(passStart).toISOString(), end:exit.toISOString(), approximate:true});
        passStart=null;
      }
      was=hit; prev=current;
      if(t>=end) break;
    }
    if(was&&passStart) results.push({id:record.id,name:record.name,sensor:record.sensor,source:record.source,start:new Date(passStart).toISOString(),end:new Date(end).toISOString(),approximate:true});
  }
  return results.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
}
