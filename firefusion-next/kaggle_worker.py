"""
FireFusion Next backend + SQL request worker.
Run this file in one Kaggle notebook cell. Secrets (Kaggle Add-ons > Secrets):
  GITHUB_TOKEN       optional, classic/fine-grained token with Contents read/write
  HF_TOKEN           optional, Hugging Face token for model-generated answers
  NGROK_AUTHTOKEN    required to expose the Kaggle API to the static webpage

The worker uses one SQLite writer and periodically mirrors the database file to GitHub.
GitHub is file persistence, not a hosted SQL server. Keep only one Kaggle worker active.
"""
import os, json, time, base64, sqlite3, threading, uuid
from datetime import datetime, timezone
from pathlib import Path
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from pyngrok import ngrok

OWNER = "HackathonTeam12341"
REPO = "NasaSpaceAppsFireLedger"
BRANCH = "main"
DB_PATH = Path("/kaggle/working/firefusion_requests.sqlite")
DATA_URL = f"https://raw.githubusercontent.com/{OWNER}/{REPO}/{BRANCH}/harmonized_global_cells.json"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
HF_TOKEN = os.getenv("HF_TOKEN", "")
NGROK_TOKEN = os.getenv("NGROK_AUTHTOKEN", "")
HF_MODEL = os.getenv("HF_MODEL", "mistralai/Mistral-7B-Instruct-v0.3")
POLL_SECONDS = 10
DB_REPO_PATH = "firefusion-next/firefusion_requests.sqlite"
API = FastAPI(title="FireFusion Next API", version="1.0")
API.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def now():
    return datetime.now(timezone.utc).isoformat()

def db():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS conversations(
          conversation_id TEXT PRIMARY KEY, role TEXT NOT NULL, area_json TEXT NOT NULL,
          time_start TEXT, time_end TEXT, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS requests(
          request_id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL,
          request_type TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL,
          role TEXT NOT NULL, area_json TEXT NOT NULL, time_start TEXT, time_end TEXT,
          message TEXT NOT NULL, context_request_id TEXT, ai_answer TEXT, error TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_requests_status_created ON requests(status,created_at);
        CREATE TABLE IF NOT EXISTS messages(
          message_id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, request_id TEXT NOT NULL,
          sender TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        """)
init_db()

def github_headers():
    return {"Authorization":f"Bearer {GITHUB_TOKEN}","Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}

def sync_db_to_github():
    if not GITHUB_TOKEN: return
    url=f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{DB_REPO_PATH}"
    try:
        remote=requests.get(url,headers=github_headers(),params={"ref":BRANCH},timeout=25)
        sha=remote.json().get("sha") if remote.ok else None
        content=base64.b64encode(DB_PATH.read_bytes()).decode()
        payload={"message":"Update FireFusion request database","content":content,"branch":BRANCH}
        if sha: payload["sha"]=sha
        out=requests.put(url,headers=github_headers(),json=payload,timeout=60)
        out.raise_for_status()
    except Exception as e:
        print("GitHub SQL snapshot sync failed:",repr(e))

def restore_db_from_github():
    if not GITHUB_TOKEN: return
    url=f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{DB_REPO_PATH}"
    try:
        r=requests.get(url,headers=github_headers(),params={"ref":BRANCH},timeout=30)
        if r.status_code==404: return
        r.raise_for_status()
        data=base64.b64decode(r.json()["content"])
        DB_PATH.write_bytes(data)
        print("Restored SQL database snapshot from GitHub.")
    except Exception as e:
        print("No prior SQL snapshot restored:",repr(e))

def load_cells():
    r=requests.get(DATA_URL,timeout=60); r.raise_for_status()
    data=r.json()
    if not isinstance(data,list): raise ValueError("Expected harmonized_global_cells.json to contain a list")
    return data
CELLS=load_cells()
print(f"Loaded {len(CELLS):,} harmonized global cells.")

def area_facts(bounds):
    south=float(bounds["south"]); north=float(bounds["north"])
    west=float(bounds["west"]); east=float(bounds["east"])
    found=[x for x in CELLS if south<=float(x["lat"])<=north and west<=float(x["lon"])<=east]
    def total(k): return sum(float(x.get(k,0) or 0) for x in found)
    ranked=sorted(found,key=lambda x:float(x.get("harmonizedCount",0) or 0),reverse=True)[:8]
    return {"cells_in_area":len(found),"harmonized_detections":int(total("harmonizedCount")),
      "viirs_detections":int(total("viirsCount")),"modis_detections":int(total("modisCount")),
      "landsat_detections":int(total("landsatCount")),"frp_mw":round(total("frpMw"),1),
      "top_cells":[{"lat":x["lat"],"lon":x["lon"],"detections":x.get("harmonizedCount",0),
                    "frp_mw":x.get("frpMw",0),"lo90":x.get("lo90"),"hi90":x.get("hi90")} for x in ranked]}

ROLE_GUIDANCE={
 "Ambulance / medical":"Focus on population exposure, smoke-related medical readiness, triage access, evacuation coordination and safe staging. Do not invent patients, hospitals or road conditions.",
 "Firefighter":"Focus on concentration of detections, relative fire activity, uncertainty, situational awareness and safe coordination. Do not infer fire perimeter, spread direction or wind.",
 "Emergency responder":"Focus on operational overview, priority monitoring zones, coordination and information gaps. Do not issue dispatch orders.",
 "Scientist / analyst":"Focus on sensor counts, harmonization, uncertainty intervals, FRP and data limitations.",
 "Land manager":"Focus on monitoring priorities, land stewardship, ecological risk questions and follow-up assessment."
}
def fallback_answer(job,facts):
    role=job["role"]; area=job["area"]
    top=facts["top_cells"]
    lines=[
      f"DATA-GROUNDED BRIEFING — {role.upper()}",
      f"Selected bounds: {area['south']:.3f}° to {area['north']:.3f}° latitude; {area['west']:.3f}° to {area['east']:.3f}° longitude.",
      f"Grid cells represented: {facts['cells_in_area']:,}. Harmonized detections in the selected cells: {facts['harmonized_detections']:,}.",
      f"Sensor totals: VIIRS {facts['viirs_detections']:,}; MODIS {facts['modis_detections']:,}; Landsat {facts['landsat_detections']:,}. Aggregated FRP: {facts['frp_mw']:,.1f} MW.",
      "Highest-count grid cells:"
    ]
    if top:
      lines += [f"• {x['lat']}°, {x['lon']}° — {int(x['detections']):,} detections; FRP {float(x['frp_mw'] or 0):,.1f} MW; 90% interval {x.get('lo90')}–{x.get('hi90')}." for x in top[:5]]
    else: lines.append("No harmonized grid cells intersect the selected bounds.")
    lines += ["Role lens: "+ROLE_GUIDANCE.get(role,ROLE_GUIDANCE["Emergency responder"]),
      "Limitations: this is a pre-aggregated dataset snapshot, not a live incident feed. The global-cell file does not provide a time series for filtering these totals by the selected dates. Counts are detections, not confirmed separate fires or active fire fronts. FRP is satellite-derived radiant power, not a direct measure of fire size.",
      "Operational caution: use this briefing for situational awareness only. Confirm current conditions, weather, smoke, access, perimeters and instructions with authoritative live sources."]
    if job["message"]: lines += ["Request: "+job["message"]]
    return "\n".join(lines)

def generate_answer(job,facts,history):
    if not HF_TOKEN: return fallback_answer(job,facts)
    system=("You are FireFusion, a wildfire data analyst. Use ONLY the supplied dataset facts and conversation. "
      "Never invent fire perimeters, wind, weather, roads, population, casualties, hospitals, active status, or evacuation orders. "
      "Clearly distinguish detection counts from fires. Explain uncertainty and that the supplied global-cell dataset is aggregated, not live or date-filterable. "
      "Tailor the answer to the responder role. Provide concise findings, priority monitoring areas, limitations, and safe next steps. Never issue dispatch or evacuation commands.")
    user={"role":job["role"],"bounds":job["area"],"selected_dates":{"start":job["time_start"],"end":job["time_end"]},
          "question":job["message"],"facts":facts,"conversation_history":history}
    try:
      r=requests.post("https://router.huggingface.co/v1/chat/completions",
        headers={"Authorization":f"Bearer {HF_TOKEN}","Content-Type":"application/json"},
        json={"model":HF_MODEL,"messages":[{"role":"system","content":system},{"role":"user","content":json.dumps(user)}],
              "temperature":0.2,"max_tokens":900},timeout=90)
      r.raise_for_status()
      return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
      print("HF generation failed; using grounded fallback:",repr(e))
      return fallback_answer(job,facts)

def process_one():
    with db() as c:
      row=c.execute("SELECT * FROM requests WHERE status='pending' ORDER BY created_at LIMIT 1").fetchone()
      if not row: return False
      job=dict(row)
      c.execute("UPDATE requests SET status='processing' WHERE request_id=?",(job["request_id"],))
    try:
      area=json.loads(job["area_json"]); facts=area_facts(area)
      with db() as c:
        history=[dict(x) for x in c.execute("SELECT sender,content,created_at FROM messages WHERE conversation_id=? ORDER BY created_at LIMIT 12",(job["conversation_id"],)).fetchall()]
      answer=generate_answer({**job,"area":area},facts,history)
      with db() as c:
        c.execute("UPDATE requests SET status='completed',ai_answer=?,error=NULL WHERE request_id=?",(answer,job["request_id"]))
        c.execute("INSERT INTO messages VALUES(?,?,?,?,?,?)",(str(uuid.uuid4()),job["conversation_id"],job["request_id"],"assistant",answer,now()))
      sync_db_to_github()
      print("Completed",job["request_id"])
    except Exception as e:
      with db() as c: c.execute("UPDATE requests SET status='error',error=? WHERE request_id=?",(str(e)[:1000],job["request_id"]))
      sync_db_to_github(); print("Request failed:",repr(e))
    return True

def worker_loop():
    print(f"Worker polling every {POLL_SECONDS}s.")
    while True:
      try:
        worked=process_one()
        if not worked: time.sleep(POLL_SECONDS)
      except Exception as e:
        print("Worker loop error:",repr(e)); time.sleep(POLL_SECONDS)

class RequestIn(BaseModel):
    request_type: str = Field(pattern="^(briefing|chat)$")
    role: str
    area: dict
    time_start: str|None=None
    time_end: str|None=None
    message: str=Field(default="",max_length=4000)
    conversation_id: str|None=None
    context_request_id: str|None=None

@API.get("/api/health")
def health():
    with db() as c:
      pending=c.execute("SELECT COUNT(*) FROM requests WHERE status='pending'").fetchone()[0]
    return {"ok":True,"cells":len(CELLS),"pending":pending,"model":HF_MODEL if HF_TOKEN else "grounded-fallback"}

@API.post("/api/requests")
def create_request(body:RequestIn):
    if body.role not in ROLE_GUIDANCE: raise HTTPException(400,"Unknown responder role")
    b=body.area
    try:
      south,north,west,east=map(float,[b["south"],b["north"],b["west"],b["east"]])
      if not (-85.05<=south<north<=85.05 and -180<=west<east<=180): raise ValueError()
    except Exception: raise HTTPException(400,"Invalid map bounds")
    cid=body.conversation_id or str(uuid.uuid4()); rid=str(uuid.uuid4()); stamp=now()
    with db() as c:
      c.execute("INSERT OR IGNORE INTO conversations VALUES(?,?,?,?,?,?)",(cid,body.role,json.dumps(b),body.time_start,body.time_end,stamp))
      c.execute("INSERT INTO requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (rid,cid,body.request_type,stamp,"pending",body.role,json.dumps(b),body.time_start,body.time_end,body.message,body.context_request_id,None,None))
      c.execute("INSERT INTO messages VALUES(?,?,?,?,?,?)",(str(uuid.uuid4()),cid,rid,"user",body.message,stamp))
    sync_db_to_github()
    return {"request_id":rid,"conversation_id":cid,"status":"pending"}

@API.get("/api/requests/{request_id}")
def get_request(request_id:str):
    with db() as c: row=c.execute("SELECT request_id,conversation_id,status,ai_answer,error,created_at FROM requests WHERE request_id=?",(request_id,)).fetchone()
    if not row: raise HTTPException(404,"Request not found")
    return dict(row)

def start():
    if not NGROK_TOKEN: raise RuntimeError("Add NGROK_AUTHTOKEN in Kaggle Secrets before running.")
    ngrok.set_auth_token(NGROK_TOKEN)
    restore_db_from_github()
    threading.Thread(target=worker_loop,daemon=True).start()
    public=ngrok.connect(8000,"http").public_url
    print("\nFIRE FUSION API:",public)
    print("Copy this URL into API_BASE in firefusion-next/app.js, then commit that one-line change.")
    print("Keep this notebook cell running. Stop the cell to stop the API and worker.\n")
    uvicorn.run(API,host="0.0.0.0",port=8000,log_level="info")

if __name__=="__main__": start()
