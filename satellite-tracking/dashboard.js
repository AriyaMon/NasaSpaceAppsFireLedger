// Optional compact panel; requires a container element in the host application.
// The host provides its AOI selector separately and calls monitor.setAOI().
export function attachSatelliteDashboard(container,monitor) {
  const panel=document.createElement("section");
  panel.setAttribute("aria-label","Satellite monitoring");
  panel.style.cssText="background:#102231;color:#eaf6ff;padding:14px;border-radius:12px;font:13px system-ui;max-width:340px;line-height:1.5";
  container.append(panel);
  let state={status:"loading",aoi:null,lastUpdated:null},schedule=[];
  const htmlEscape=x=>String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const render=()=>{
    const now=Date.now(),next=schedule.find(p=>Date.parse(p.end)>now);
    const countdown=next?Math.max(0,Math.round((Date.parse(next.start)-now)/1000)):0;
    const clock=s=>[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,"0")).join(":");
    panel.innerHTML=`<strong>Satellite monitoring</strong>
      <div>AOI: ${state.aoi?htmlEscape(JSON.stringify(state.aoi)):"Not selected"}</div>
      <div>Next: ${next?htmlEscape(next.name+" ("+next.sensor+")"):"No predicted pass"}</div>
      <div>Countdown (approx): ${next?clock(countdown):"—"}</div>
      <div>Status: ${htmlEscape(state.status)}</div>
      <div>Last FIRMS update: ${state.lastUpdated?htmlEscape(new Date(state.lastUpdated).toLocaleString()):"Not yet"}</div>
      <details><summary>Upcoming predicted passes (${schedule.length})</summary>
      <ol>${schedule.slice(0,12).map(p=>`<li>${htmlEscape(p.name)} — ${htmlEscape(new Date(p.start).toLocaleString())} (approx)</li>`).join("")}</ol></details>
      <small>SGP4/TLE estimates, not confirmed observations. FIRMS publication can lag overpass.</small>`;
  };
  render();
  const timer=setInterval(render,1000);
  return {
    updateStatus(next){state={...state,...next};render();},
    updateSchedule(next){schedule=next;render();},
    destroy(){clearInterval(timer);panel.remove();}
  };
}
