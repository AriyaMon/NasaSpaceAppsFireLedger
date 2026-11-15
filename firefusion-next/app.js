// FireFusion — read-only GitHub SQL map. No server endpoint.
const DATABASE_URL = "https://raw.githubusercontent.com/AriyaMon/NasaSpaceAppsDATABASE_KAGGLE/main/Database/fireledger.db";
const $ = id => document.getElementById(id);
const map = L.map("map",{zoomControl:false}).setView([56.5,-106.0],4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
L.control.zoom({position:"bottomright"}).addTo(map);
let fireLayer=L.layerGroup().addTo(map), selection=null, selectionMode=false, firstCorner=null;
function esc(v){return String(v??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fireColor(frp){const v=Number(frp||0);return v>=100?"#c92f25":v>=30?"#ff754c":"#f4cf69"}
function setStatus(message){$("map-status").textContent=message}
function renderObservations(rows){
  fireLayer.clearLayers();
  for(const x of rows){
    const lat=Number(x.latitude),lon=Number(x.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
    const frp=Number(x.frp_mw||0),nearby=Number(x.population_nearby)===1;
    L.circleMarker([lat,lon],{radius:Math.min(12,4+Math.sqrt(Math.max(frp,0))/3),color:nearby?"#7d1822":"#773b22",weight:nearby?2:1,fillColor:fireColor(frp),fillOpacity:.78})
    .bindPopup("<b>"+esc(x.fire_type||"Fire type unclassified")+"</b><br>FRP: "+esc(frp.toFixed(2))+" MW<br>Population nearby: "+(nearby?"Flagged":"Not flagged")+(x.nearest_place?"<br>Nearest place: "+esc(x.nearest_place):"")+(x.distance_to_population_km!=null?"<br>Distance: "+esc(x.distance_to_population_km)+" km":"")+"<br>Observed: "+esc(x.observed_at)).addTo(fireLayer);
  }
  $("cell-count").textContent=rows.length.toLocaleString()+" observations";
  $("dataset-status").textContent="GITHUB SQL · CANADA · 2023";
  setStatus(rows.length?"CANADA 2023 DATABASE LOADED":"NO CANADA 2023 OBSERVATIONS");
}
async function loadDatabase(){
  try{
    setStatus("LOADING GITHUB SQL DATABASE");
    const [SQL,response]=await Promise.all([initSqlJs({locateFile:file=>"https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/"+file}),fetch(DATABASE_URL,{cache:"no-store"})]);
    if(!response.ok)throw new Error("Could not read GitHub database ("+response.status+"). Make sure the database repository is public.");
    const database=new SQL.Database(new Uint8Array(await response.arrayBuffer()));
    const exists=database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='fire_observations'");
    if(!exists.length){renderObservations([]);setStatus("FIRE OBSERVATIONS TABLE NOT CREATED YET");return}
    const result=database.exec("SELECT observation_id,observed_at,country,latitude,longitude,fire_type,frp_mw,confidence,population_nearby,nearest_place,distance_to_population_km,source FROM fire_observations WHERE country IN ('CA','Canada') AND observed_at >= '2023-01-01' AND observed_at < '2024-01-01' ORDER BY observed_at DESC");
    if(!result.length){renderObservations([]);return}
    const {columns,values}=result[0];
    renderObservations(values.map(row=>Object.fromEntries(columns.map((key,i)=>[key,row[i]]))));
  }catch(error){$("cell-count").textContent="Database unavailable";$("dataset-status").textContent="GITHUB DATABASE UNAVAILABLE";setStatus(error.message);console.error(error)}
}
$("cells-toggle").addEventListener("change",()=>{if($("cells-toggle").checked)fireLayer.addTo(map);else map.removeLayer(fireLayer)});
$("select-area").addEventListener("click",()=>{selectionMode=!selectionMode;firstCorner=null;$("select-area").classList.toggle("active",selectionMode);$("select-area").textContent=selectionMode?"Click two opposite corners…":"▱ Select map area";$("selection-status").textContent=selectionMode?"Click the first corner of your area.":"Selection cancelled.";map.getContainer().style.cursor=selectionMode?"crosshair":""});
map.on("click",e=>{
  if(!selectionMode)return;
  if(!firstCorner){firstCorner=e.latlng;$("selection-status").textContent="First corner set. Click the opposite corner.";return}
  const bounds=L.latLngBounds(firstCorner,e.latlng);
  if(selection)map.removeLayer(selection);
  selection=L.rectangle(bounds,{color:"#ff754c",weight:2,fillColor:"#ff754c",fillOpacity:.09}).addTo(map);
  $("selection-status").textContent="Area selected. Map observations are read directly from the GitHub SQL snapshot.";
  $("generate").disabled=true;
  $("briefing").textContent="The map reads the GitHub SQL database in read-only mode. Static GitHub Pages cannot securely insert a new request into that database.";
  selectionMode=false;firstCorner=null;$("select-area").classList.remove("active");$("select-area").textContent="▱ Select map area";map.getContainer().style.cursor="";
});
map.on("moveend zoomend",()=>{const c=map.getCenter();$("coords").textContent=c.lat.toFixed(2)+", "+c.lng.toFixed(2);$("zoom").textContent="ZOOM "+map.getZoom()});
$("generate").disabled=true;$("send-chat").disabled=true;$("generate").textContent="Briefing requests are read-only";
$("send-chat").title="Static Pages cannot write to the SQL database.";
$("briefing").textContent="Select an area to inspect the Canada 2023 observations stored in the GitHub SQL database.";
$("request-state").textContent="DATABASE VIEW";$("connection").textContent="GITHUB DATABASE";$("connection").className="connection online";
$("start-date").value="2023-01-01";$("end-date").value="2023-12-31";$("start-date").disabled=true;$("end-date").disabled=true;
loadDatabase();
