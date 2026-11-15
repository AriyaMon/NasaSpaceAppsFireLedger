// Build-time TLE snapshot makes satellite tracking usable on static GitHub Pages.
// Refresh on every deployment. Missing satellites remain explicitly unavailable.
import fs from 'node:fs/promises';
const ids=[25994,27424,37849,43013,54234];
const entries=await Promise.all(ids.map(async id=>{
 try{
  const r=await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${id}&FORMAT=TLE`,{signal:AbortSignal.timeout(12000)});
  const t=r.ok?await r.text():'';
  return [String(id),t.includes('\n1 ')&&t.includes('\n2 ')?t:''];
 }catch{return [String(id),''];}
}));
await fs.mkdir('public',{recursive:true});
await fs.writeFile('public/satellite-tles.json',JSON.stringify({fetchedAt:new Date().toISOString(),tles:Object.fromEntries(entries)},null,2));
console.log('TLE snapshot:',entries.filter(([,v])=>v).length,'satellites');
