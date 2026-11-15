# FireFusion Kaggle worker — single notebook cell
# Kaggle Secrets required: GITHUB_TOKEN, NGROK_AUTHTOKEN
# Optional: HF_TOKEN (for hosted Mistral inference)
import os, json, time, uuid, base64, sqlite3, threading
from pathlib import Path
from datetime import datetime, timezone
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from pyngrok import ngrok

OWNER, REPO, BRANCH = "AriyaMon", "NasaSpaceAppsDATABASE_KAGGLE", "main"
DB_FILE = Path("/kaggle/working/fireledger.db")
DB_REPO_PATH = "Database/fireledger.db"
POLL_SECONDS = 10
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
NGROK_TOKEN = os.environ["NGROK_AUTHTOKEN"]
HF_TOKEN = os.environ.get("HF_TOKEN", "")
HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.3"
API = FastAPI(title="FireFusion API")
API.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def stamp():
    return datetime.now(timezone.utc).isoformat()

def gh_headers():
    return {"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"}

def restore_database():
    url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{DB_REPO_PATH}"
    r = requests.get(url, headers=gh_headers(), params={"ref": BRANCH}, timeout=30)
    if r.status_code == 404:
        return False
    r.raise_for_status()
    DB_FILE.write_bytes(base64.b64decode(r.json()["content"]))
    print("Restored Database/fireledger.db from GitHub.")
    return True

def sync_database():
    url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{DB_REPO_PATH}"
    r = requests.get(url, headers=gh_headers(), params={"ref": BRANCH}, timeout=30)
    sha = r.json().get("sha") if r.status_code == 200 else None
    if r.status_code not in (200, 404):
        r.raise_for_status()
    payload = {"message": "Update FireLedger SQL database", "branch": BRANCH,
               "content": base64.b64encode(DB_FILE.read_bytes()).decode()}
    if sha:
        payload["sha"] = sha
    out = requests.put(url, headers=gh_headers(), json=payload, timeout=90)
    out.raise_for_status()
    print("SQL snapshot synced to GitHub.")

def connect():
    c = sqlite3.connect(DB_FILE, timeout=30)
    c.row_factory = sqlite3.Row
    return c

def initialize_database():
    with connect() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS requests(
          request_id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, request_type TEXT NOT NULL,
          created_at TEXT NOT NULL, status TEXT NOT NULL, role TEXT NOT NULL,
          area TEXT, time_start TEXT, time_end TEXT, message TEXT NOT NULL,
          context_request_id TEXT, ai_answer TEXT, error TEXT);
        CREATE TABLE IF NOT EXISTS conversations(
          conversation_id TEXT PRIMARY KEY, created_at TEXT, role TEXT, area TEXT,
          time_start TEXT, time_end TEXT);
        CREATE TABLE IF NOT EXISTS messages(
          message_id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, request_id TEXT NOT NULL,
          sender TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS summaries(
          summary_id TEXT PRIMARY KEY, request_id TEXT NOT NULL, content TEXT NOT NULL,
          fact_ledger TEXT, dataset_version TEXT, model_version TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS fire_observations(
          observation_id TEXT PRIMARY KEY, observed_at TEXT NOT NULL, country TEXT NOT NULL,
          latitude REAL NOT NULL, longitude REAL NOT NULL, fire_type TEXT,
          frp_mw REAL, confidence REAL, population_nearby INTEGER,
          nearest_place TEXT, distance_to_population_km REAL, source TEXT);
        """)
        # Upgrade the original FireLedger schema without replacing its tables/data.
        columns = {r["name"] for r in c.execute("PRAGMA table_info(requests)")}
        for name, kind in [("south","REAL"),("west","REAL"),("north","REAL"),("east","REAL")]:
            if name not in columns:
                c.execute(f"ALTER TABLE requests ADD COLUMN {name} {kind}")
        c.execute("CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status,created_at)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_fire_date_country ON fire_observations(country,observed_at)")
        c.execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('project','FireLedger')")
        c.execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('analysis_scope','Canada only; calendar year 2023')")
        c.execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('dataset_status','Awaiting 2023 Canada observations')")
    print("Existing GitHub SQL database initialized/upgraded:", DB_FILE)

# Restore first, then initialize/upgrade the same database.
restore_database()
initialize_database()

def canada_2023_observations(bounds=None):
    sql = """SELECT * FROM fire_observations
             WHERE country IN ('CA','Canada')
             AND observed_at >= '2023-01-01'
             AND observed_at < '2024-01-01'"""
    args = []
    if bounds:
        sql += " AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?"
        args += [bounds["south"], bounds["north"], bounds["west"], bounds["east"]]
    with connect() as c:
        return [dict(x) for x in c.execute(sql, args).fetchall()]

def summarize_facts(rows):
    if not rows:
        return {"observation_count": 0, "message":
          "No Canada 2023 observations have been loaded into fire_observations yet."}
    frp = [float(x["frp_mw"] or 0) for x in rows]
    places = {}
    for x in rows:
        place = x.get("nearest_place")
        dist = x.get("distance_to_population_km")
        if place and dist is not None:
            places[place] = min(float(dist), places.get(place, float("inf")))
    nearby = sum(1 for x in rows if x.get("population_nearby") == 1)
    types = {}
    for x in rows:
        t = x.get("fire_type") or "Unclassified"
        types[t] = types.get(t, 0) + 1
    return {"observation_count": len(rows), "mean_frp_mw": round(sum(frp)/len(frp), 2),
      "max_frp_mw": round(max(frp), 2), "population_nearby_observations": nearby,
      "fire_type_counts": types, "nearest_places": sorted(
        [{"place": k, "distance_km": round(v, 1)} for k,v in places.items()],
        key=lambda z:z["distance_km"])[:8],
      "observations": rows[:100]}

ROLE = {
 "Ambulance / medical": "Prioritize smoke exposure screening, medical readiness, population proximity, and safe coordination. Never invent patients or hospitals.",
 "Firefighter": "Prioritize fire type, FRP intensity, clusters, uncertainty, and situational awareness. Do not infer fire perimeter, spread direction, or wind.",
 "Emergency responder": "Prioritize population proximity, nearest named places, monitoring priorities, and coordination.",
 "Scientist / analyst": "Prioritize sensor evidence, classification confidence, FRP, spatial patterns, and data limitations.",
 "Land manager": "Prioritize fuel/land context, ecological monitoring, and areas requiring field verification."
}

def grounded_answer(job, facts):
    if facts["observation_count"] == 0:
        return ("No briefing can be calculated yet: the SQL database currently contains no fire observations "
                "for Canada in 2023. The map and request system are ready; load the dataset into "
                "fire_observations when it becomes available. No global or other-year records were used.")
    prompt = {
      "system": "You are FireFusion, a cautious wildfire intelligence summarizer. Use only supplied facts. "
        "Never invent fire perimeters, wind, weather, roads, casualties, hospitals, or evacuation orders. "
        "FRP is satellite radiant power, not fireline intensity. Population proximity is a screening flag, "
        "not proof of exposure. State uncertainty and do not issue dispatch commands.",
      "role": job["role"], "role_guidance": ROLE[job["role"]],
      "question": job["message"], "facts": facts,
      "scope": "Canada only, 2023 only"
    }
    if HF_TOKEN:
        try:
            r = requests.post("https://router.huggingface.co/v1/chat/completions",
              headers={"Authorization": f"Bearer {HF_TOKEN}"},
              json={"model": HF_MODEL, "messages":[
                {"role":"system","content":prompt["system"]},
                {"role":"user","content":json.dumps(prompt)}],
                "temperature":0.15,"max_tokens":700}, timeout=90)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print("Mistral endpoint unavailable; using factual fallback:", e)
    nearest = facts["nearest_places"] or []
    return (f"{job['role']} briefing — Canada, 2023\n"
      f"Observations: {facts['observation_count']}. Mean FRP: {facts['mean_frp_mw']} MW; "
      f"maximum FRP: {facts['max_frp_mw']} MW.\n"
      f"Fire-type labels: {json.dumps(facts['fire_type_counts'])}. "
      f"Observations flagged near population: {facts['population_nearby_observations']}.\n"
      f"Nearest mapped places: {json.dumps(nearest)}.\n"
      f"Role focus: {ROLE[job['role']]}\n"
      "FRP is not fireline intensity. Population proximity is a screening indicator. "
      "Confirm all conditions with current authoritative sources before operational decisions.")

def process_pending():
    with connect() as c:
        row = c.execute("SELECT * FROM requests WHERE status='pending' ORDER BY created_at LIMIT 1").fetchone()
        if not row:
            return False
        job = dict(row)
        c.execute("UPDATE requests SET status='processing' WHERE request_id=?", (job["request_id"],))
    try:
        bounds = {k: job[k] for k in ("south","west","north","east")}
        facts = summarize_facts(canada_2023_observations(bounds))
        answer = grounded_answer(job, facts)
        with connect() as c:
            c.execute("UPDATE requests SET status='completed',ai_answer=?,error=NULL WHERE request_id=?",
                      (answer, job["request_id"]))
            c.execute("INSERT INTO summaries VALUES(?,?,?,?)",
                      (str(uuid.uuid4()), job["request_id"], answer, stamp()))
            c.execute("INSERT INTO messages VALUES(?,?,?,?,?,?)",
                      (str(uuid.uuid4()), job["conversation_id"], job["request_id"], "assistant", answer, stamp()))
        sync_database()
        print("Completed request", job["request_id"])
    except Exception as e:
        with connect() as c:
            c.execute("UPDATE requests SET status='error',error=? WHERE request_id=?",
                      (str(e)[:1000], job["request_id"]))
        sync_database()
        print("Request failed:", repr(e))
    return True

def poll_loop():
    print(f"Polling the GitHub-backed SQL snapshot every {POLL_SECONDS}s.")
    while True:
        try:
            if not process_pending():
                time.sleep(POLL_SECONDS)
        except Exception as e:
            print("Worker error:", repr(e))
            time.sleep(POLL_SECONDS)

class RequestBody(BaseModel):
    request_type: str = Field(pattern="^(briefing|chat)$")
    role: str
    area: dict
    message: str = Field(default="", max_length=3000)
    conversation_id: str | None = None
    context_request_id: str | None = None

@API.get("/api/health")
def health():
    with connect() as c:
        pending = c.execute("SELECT COUNT(*) FROM requests WHERE status='pending'").fetchone()[0]
        total = c.execute("SELECT COUNT(*) FROM fire_observations WHERE country IN ('CA','Canada') AND observed_at >= '2023-01-01' AND observed_at < '2024-01-01'").fetchone()[0]
    return {"ok": True, "scope": "Canada 2023", "observations": total, "pending": pending}

@API.get("/api/map-data")
def map_data():
    rows = canada_2023_observations()
    return {"scope":"Canada 2023","count":len(rows),"observations":rows}

@API.post("/api/requests")
def create_request(body: RequestBody):
    roles = list(ROLE)
    if body.role not in roles:
        raise HTTPException(400, "Unknown responder role")
    try:
        b = {k: float(body.area[k]) for k in ("south","west","north","east")}
        if not (-85 <= b["south"] < b["north"] <= 85 and -180 <= b["west"] < b["east"] <= 180):
            raise ValueError()
    except Exception:
        raise HTTPException(400, "Invalid map bounds")
    cid = body.conversation_id or str(uuid.uuid4())
    rid, ts = str(uuid.uuid4()), stamp()
    with connect() as c:
        c.execute("INSERT OR IGNORE INTO conversations VALUES(?,?,?)", (cid, body.role, ts))
        c.execute("""INSERT INTO requests(request_id,conversation_id,request_type,created_at,status,role,
          south,west,north,east,message,context_request_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
          (rid,cid,body.request_type,ts,"pending",body.role,b["south"],b["west"],b["north"],b["east"],
           body.message,body.context_request_id))
        c.execute("INSERT INTO messages VALUES(?,?,?,?,?,?)",
          (str(uuid.uuid4()),cid,rid,"user",body.message,ts))
    sync_database()
    return {"request_id":rid,"conversation_id":cid,"status":"pending"}

@API.get("/api/requests/{request_id}")
def get_request(request_id: str):
    with connect() as c:
        row = c.execute("SELECT request_id,conversation_id,status,ai_answer,error FROM requests WHERE request_id=?",
                        (request_id,)).fetchone()
    if not row:
        raise HTTPException(404,"Request not found")
    return dict(row)

def run():
    ngrok.set_auth_token(NGROK_TOKEN)
    threading.Thread(target=poll_loop, daemon=True).start()
    public = ngrok.connect(8000, "http").public_url
    print("\nAPI URL (paste into app.js API_BASE):", public)
    print("GitHub remains the SQL snapshot store; this URL only bridges the static Pages frontend to Kaggle.")
    uvicorn.run(API, host="0.0.0.0", port=8000)

run()
