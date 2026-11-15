// FireFusion — Canada 2023 interface
// Paste the public HTTPS API address printed by the Kaggle cell here.
const API_BASE = "https://REPLACE-WITH-YOUR-KAGGLE-API-URL";
const $ = id => document.getElementById(id);
const map = L.map("map",{zoomControl:false}).setView([56.5,-106.0],4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:18, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
L.control.zoom({position:"bottomright"}).addTo(map);

let fireLayer=L.layerGroup().addTo(map), selection=null, selectionMode=false, firstCorner=null;
let activeConversation=null,lastRequest=null,selectedBounds=null;

function setConnection(ok){
  $("connection").textContent=ok?"BACKEND ONLINE":"BACKEND OFFLINE";
  $("connection").className="connection "+(ok?"online":"offline");
}
function setStatus(text){$("map-status").textContent=text}
function esc(v){return String(v??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fireColor(frp){
  const v=Number(frp||0);
  return v>=100?"#c92f25":v>=30?"#ff754c":"#f4cf69";
}
function renderObservations(rows){
  fireLayer.clearLayers();
  for(const x of rows){
    if(!Number.isFinite(Number(x.latitude))||!Number.isFinite(Number(x.longitude)))continue;
    const frp=Number(x.frp_mw||0), nearby=Number(x.population_nearby)===1;
    const marker=L.circleMarker([x.latitude,x.longitude],{
      radius:Math.min(12,4+Math.sqrt(Math.max(frp,0))/3),
      color:nearby?"#7d1822":"#773b22",weight:nearby?2:1,
      fillColor:fireColor(frp),fillOpacity:.78
    });
    marker.bindPopup(
      "<b>"+esc(x.fire_type||"Fire type unclassified")+"</b><br>"+
      "FRP: "+esc(frp.toFixed(2))+" MW<br>"+
      "Population nearby: "+(nearby?"Flagged":"Not flagged")+
      (x.nearest_place?"<br>Nearest place: "+esc(x.nearest_place):"")+
      (x.distance_to_population_km!=null?"<br>Distance: "+esc(x.distance_to_population_km)+" km":"")+
      "<br>Observed: "+esc(x.observed_at)
    );
    marker.addTo(fireLayer);
  }
  $("cell-count").textContent=rows.length.toLocaleString()+" observations";
  $("dataset-status").textContent="DATASET: CANADA · 2023";
  setStatus(rows.length? "2023 CANADA OBSERVATIONS":"AWAITING 2023 CANADA DATA");
}
async function loadMapData(){
  try{
    const r=await fetch(API_BASE+"/api/map-data");
    if(!r.ok)throw Error("Map data HTTP "+r.status);
    const data=await r.json();
    renderObservations(data.observations||[]);
  }catch(e){
    $("dataset-status").textContent="DATASET: WAITING FOR KAGGLE";
    $("cell-count").textContent="Awaiting data";
    console.warn("Map data unavailable:",e.message);
  }
}
map.on("moveend zoomend",()=>{
  const c=map.getCenter();
  $("coords").textContent=c.lat.toFixed(2)+", "+c.lng.toFixed(2);
  $("zoom").textContent="ZOOM "+map.getZoom();
});
$("cells-toggle").addEventListener("change",()=>{
  if($("cells-toggle").checked)fireLayer.addTo(map);else map.removeLayer(fireLayer);
});
$("select-area").addEventListener("click",()=>{
  selectionMode=!selectionMode;firstCorner=null;
  $("select-area").classList.toggle("active",selectionMode);
  $("select-area").textContent=selectionMode?"Click two opposite corners…":"▱ Select map area";
  $("selection-status").textContent=selectionMode?"Click the first corner of your area.":"Selection cancelled.";
  map.getContainer().style.cursor=selectionMode?"crosshair":"";
});
map.on("click",e=>{
  if(!selectionMode)return;
  if(!firstCorner){firstCorner=e.latlng;$("selection-status").textContent="First corner set. Click the opposite corner.";return}
  const b=L.latLngBounds(firstCorner,e.latlng);
  if(selection)map.removeLayer(selection);
  selection=L.rectangle(b,{color:"#ff754c",weight:2,fillColor:"#ff754c",fillOpacity:.09}).addTo(map);
  selectedBounds={south:b.getSouth(),west:b.getWest(),north:b.getNorth(),east:b.getEast()};
  $("selection-status").textContent="Area selected. Generate a briefing for this region.";
  $("generate").disabled=false;selectionMode=false;firstCorner=null;
  $("select-area").classList.remove("active");$("select-area").textContent="▱ Select map area";
  map.getContainer().style.cursor="";
});
function addBubble(who,text){
  const d=document.createElement("div");d.className="bubble "+who;d.textContent=text;
  $("chat-log").appendChild(d);$("chat-log").scrollTop=$("chat-log").scrollHeight;
}
async function api(path,options={}){
  const r=await fetch(API_BASE+path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  if(!r.ok)throw Error((await r.text()).slice(0,300));
  return r.json();
}
async function checkBackend(){
  try{await api("/api/health");setConnection(true)}catch{setConnection(false)}
}
async function submitRequest(type,message,contextId=null){
  if(!selectedBounds)throw Error("Select an area on the map first.");
  const payload={request_type:type,role:$("role").value,area:selectedBounds,
    message,conversation_id:activeConversation,context_request_id:contextId};
  const result=await api("/api/requests",{method:"POST",body:JSON.stringify(payload)});
  activeConversation=result.conversation_id;return result;
}
async function waitForAnswer(id){
  $("request-state").textContent="PROCESSING";
  $("briefing").classList.remove("empty");
  $("briefing").textContent="Request saved to the GitHub-backed SQL queue. Waiting for the Kaggle worker…";
  for(let i=0;i<120;i++){
    await new Promise(r=>setTimeout(r,3000));
    const result=await api("/api/requests/"+id);
    if(result.status==="completed")return result;
    if(result.status==="error")throw Error(result.error||"Worker failed");
  }
  throw Error("Timed out. Check that the Kaggle notebook is running.");
}
$("generate").addEventListener("click",async()=>{
  try{
    $("generate").disabled=true;$("request-state").textContent="QUEUED";
    const message=$("question").value.trim()||"Prepare a role-specific wildfire intelligence briefing for this selected area.";
    const req=await submitRequest("briefing",message);lastRequest=req.request_id;
    const result=await waitForAnswer(lastRequest);
    $("briefing").textContent=result.ai_answer;$("request-state").textContent="COMPLETE";
    $("send-chat").disabled=false;
  }catch(e){$("briefing").textContent="Unable to generate briefing: "+e.message;$("request-state").textContent="ERROR"}
  finally{$("generate").disabled=!selectedBounds}
});
$("send-chat").addEventListener("click",async()=>{
  const message=$("chat-input").value.trim();if(!message||!lastRequest)return;
  addBubble("user",message);$("chat-input").value="";$("send-chat").disabled=true;
  try{
    const req=await submitRequest("chat",message,lastRequest);
    const result=await waitForAnswer(req.request_id);
    addBubble("assistant",result.ai_answer);lastRequest=req.request_id;$("request-state").textContent="COMPLETE";
  }catch(e){addBubble("assistant","Could not retrieve answer: "+e.message)}
  finally{$("send-chat").disabled=false}
});
$("chat-input").addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("send-chat").click()}
});
// Fixed analysis window: January 1 through December 31, 2023.
$("start-date").value="2023-01-01";$("end-date").value="2023-12-31";
$("start-date").disabled=true;$("end-date").disabled=true;
loadMapData();checkBackend();
setInterval(checkBackend,15000);
setInterval(loadMapData,60000);
