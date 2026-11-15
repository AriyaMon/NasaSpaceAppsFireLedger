# FireLedger / FireFusion — GitHub SQL polling worker
# Run this entire cell in ONE Kaggle notebook.
# Kaggle Secrets: GITHUB_TOKEN (required), HF_TOKEN (optional).
# No .env files. No ngrok. No web server.

import os, time, json, uuid, sqlite3, requests, base64, traceback
from pathlib import Path
from datetime import datetime, timezone

# --------------------------- CONFIG ---------------------------
DB_OWNER = "AriyaMon"
DB_REPO = "NasaSpaceAppsDATABASE_KAGGLE"
DB_BRANCH = "main"
DB_PATH = "Database/fireledger.db"
LOCAL_DB = Path("/kaggle/working/fireledger.db")

POLL_SECONDS = 20
MAX_REQUESTS_PER_CYCLE = 5
ANALYSIS_COUNTRY = ("CA", "Canada")
START_DATE = "2023-01-01"
END_DATE = "2024-01-01"   # exclusive: includes all of 2023

# Optional hosted Mistral inference. If absent/unavailable, a factual
# extractive response is produced instead. Set HF_MODEL to your fine-tuned
# model/adapter endpoint when you have published it.
HF_MODEL = os.environ.get("HF_MODEL", "mistralai/Mistral-7B-Instruct-v0.3")

from kaggle_secrets import UserSecretsClient
secrets = UserSecretsClient()
GITHUB_TOKEN = secrets.get_secret("GITHUB_TOKEN")
try:
    HF_TOKEN = secrets.get_secret("HF_TOKEN")
except Exception:
    HF_TOKEN = None

if not GITHUB_TOKEN:
    raise RuntimeError("Add GITHUB_TOKEN in Kaggle → Add-ons → Secrets.")

API_ROOT = f"https://api.github.com/repos/{DB_OWNER}/{DB_REPO}/contents/{DB_PATH}"
HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
}

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def github_download_database():
    """Pull the current SQLite file from the configured GitHub branch."""
    r = requests.get(API_ROOT, headers=HEADERS,
                     params={"ref": DB_BRANCH}, timeout=60)
    if r.status_code == 404:
        return False
    r.raise_for_status()
    meta = r.json()
    # Use download_url: Contents API's inline content can be empty for larger files.
    download_url = meta.get("download_url")
    if not download_url:
        raise RuntimeError("GitHub did not return a database download URL.")
    data = requests.get(download_url, timeout=120)
    data.raise_for_status()
    LOCAL_DB.parent.mkdir(parents=True, exist_ok=True)
    LOCAL_DB.write_bytes(data.content)
    return True

def github_upload_database():
    """Push the updated SQLite snapshot to the same GitHub path."""
    # Re-fetch the current SHA immediately before the write.
    r = requests.get(API_ROOT, headers=HEADERS,
                     params={"ref": DB_BRANCH}, timeout=60)
    sha = None
    if r.status_code == 200:
        sha = r.json()["sha"]
    elif r.status_code != 404:
        r.raise_for_status()

    payload = {
        "message": "FireLedger: process unanswered requests",
        "branch": DB_BRANCH,
        "content": base64.b64encode(LOCAL_DB.read_bytes()).decode("ascii")
    }
    if sha:
        payload["sha"] = sha
    out = requests.put(API_ROOT, headers=HEADERS, json=payload, timeout=180)
    out.raise_for_status()
    print("GitHub SQL database updated:", out.json()["commit"]["html_url"])

def db():
    conn = sqlite3.connect(LOCAL_DB, timeout=60)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=60000")
    return conn

def ensure_column(conn, table, column, definition):
    existing = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

def initialize_schema():
    """Create missing tables and safely add columns to the existing schema."""
    with db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS requests (
          request_id TEXT PRIMARY KEY,
          conversation_id TEXT,
          request_type TEXT DEFAULT 'briefing',
          created_at TEXT,
          status TEXT DEFAULT 'unanswered',
          role TEXT DEFAULT 'Emergency responder',
          area TEXT,
          time_start TEXT DEFAULT '2023-01-01',
          time_end TEXT DEFAULT '2023-12-31',
          message TEXT,
          context_request_id TEXT,
          ai_answer TEXT,
          error TEXT
        );
        CREATE TABLE IF NOT EXISTS conversations (
          conversation_id TEXT PRIMARY KEY,
          created_at TEXT,
          role TEXT,
          area TEXT,
          time_start TEXT,
          time_end TEXT
        );
        CREATE TABLE IF NOT EXISTS messages (
          message_id TEXT PRIMARY KEY,
          conversation_id TEXT,
          request_id TEXT,
          sender TEXT,
          content TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS summaries (
          summary_id TEXT PRIMARY KEY,
          request_id TEXT,
          content TEXT,
          fact_ledger TEXT,
          dataset_version TEXT,
          model_version TEXT,
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        CREATE TABLE IF NOT EXISTS fire_observations (
          observation_id TEXT PRIMARY KEY,
          observed_at TEXT NOT NULL,
          country TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          fire_type TEXT,
          frp_mw REAL,
          confidence REAL,
          population_nearby INTEGER,
          nearest_place TEXT,
          distance_to_population_km REAL,
          source TEXT
        );
        """)
        # Upgrade older request schemas without dropping existing rows.
        for col, definition in [
            ("conversation_id", "TEXT"), ("request_type", "TEXT DEFAULT 'briefing'"),
            ("created_at", "TEXT"), ("status", "TEXT DEFAULT 'unanswered'"),
            ("role", "TEXT DEFAULT 'Emergency responder'"), ("area", "TEXT"),
            ("time_start", "TEXT DEFAULT '2023-01-01'"),
            ("time_end", "TEXT DEFAULT '2023-12-31'"), ("message", "TEXT"),
            ("context_request_id", "TEXT"), ("ai_answer", "TEXT"), ("error", "TEXT"),
            ("south", "REAL"), ("west", "REAL"), ("north", "REAL"), ("east", "REAL")
        ]:
            ensure_column(conn, "requests", col, definition)

        for table, definitions in {
            "messages": [
                ("message_id", "TEXT"), ("conversation_id", "TEXT"),
                ("request_id", "TEXT"), ("sender", "TEXT"),
                ("content", "TEXT"), ("created_at", "TEXT")],
            "summaries": [
                ("summary_id", "TEXT"), ("request_id", "TEXT"),
                ("content", "TEXT"), ("fact_ledger", "TEXT"),
                ("dataset_version", "TEXT"), ("model_version", "TEXT"),
                ("created_at", "TEXT")]
        }.items():
            for col, definition in definitions:
                ensure_column(conn, table, col, definition)

        conn.execute("CREATE INDEX IF NOT EXISTS idx_requests_status_created ON requests(status, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_observations_scope ON fire_observations(country, observed_at)")
        conn.execute("INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)",
                     ("analysis_scope", "Canada only; calendar year 2023"))
        conn.execute("INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)",
                     ("dataset_status", "Awaiting Canada 2023 observations"))
    print("Database schema checked. Existing records preserved.")

def get_request_area(job):
    """Accept either JSON area bounds or the original south/west/north/east columns."""
    if job.get("area"):
        try:
            area = json.loads(job["area"]) if isinstance(job["area"], str) else job["area"]
            return {k: float(area[k]) for k in ("south", "west", "north", "east")}
        except Exception:
            pass
    keys = ("south", "west", "north", "east")
    if all(job.get(k) is not None for k in keys):
        return {k: float(job[k]) for k in keys}
    return None

def load_fire_facts(job):
    """Read only Canadian observations dated in 2023, optionally clipped to request bounds."""
    sql = """SELECT * FROM fire_observations
             WHERE country IN (?,?)
               AND observed_at >= ? AND observed_at < ?"""
    args = [*ANALYSIS_COUNTRY, START_DATE, END_DATE]
    bounds = get_request_area(job)
    if bounds:
        sql += """ AND latitude BETWEEN ? AND ?
                   AND longitude BETWEEN ? AND ?"""
        args.extend([bounds["south"], bounds["north"], bounds["west"], bounds["east"]])

    with db() as conn:
        rows = [dict(r) for r in conn.execute(sql, args).fetchall()]

    if not rows:
        return {
            "scope": "Canada, 2023",
            "observation_count": 0,
            "notice": "No Canada 2023 observations are loaded in fire_observations yet."
        }

    frps = [float(r["frp_mw"]) for r in rows if r.get("frp_mw") is not None]
    fire_types, places = {}, {}
    for row in rows:
        kind = row.get("fire_type") or "Unclassified"
        fire_types[kind] = fire_types.get(kind, 0) + 1
        place, distance = row.get("nearest_place"), row.get("distance_to_population_km")
        if place and distance is not None:
            places[place] = min(float(distance), places.get(place, float("inf")))

    return {
        "scope": "Canada, 2023",
        "observation_count": len(rows),
        "fire_type_counts": fire_types,
        "mean_frp_mw": round(sum(frps) / len(frps), 2) if frps else None,
        "max_frp_mw": round(max(frps), 2) if frps else None,
        "population_nearby_observations": sum(
            1 for r in rows if r.get("population_nearby") in (1, True, "1")
        ),
        "nearest_places": [
            {"place": name, "distance_km": round(distance, 1)}
            for name, distance in sorted(places.items(), key=lambda item: item[1])[:10]
        ],
        "observations_sample": rows[:80]
    }

ROLE_GUIDANCE = {
    "Ambulance": "Focus on potential smoke exposure, nearby populated places, medical readiness, and uncertainty. Do not invent patients or medical facilities.",
    "Ambulance / medical": "Focus on potential smoke exposure, nearby populated places, medical readiness, and uncertainty. Do not invent patients or medical facilities.",
    "Firefighter": "Focus on reported fire type, satellite FRP, spatial clusters, and data uncertainty. Do not invent perimeters, spread direction, wind, or tactical instructions.",
    "Emergency responder": "Focus on nearby populated places, distances, observation clusters, monitoring priorities, and uncertainty.",
    "Emergency responders": "Focus on nearby populated places, distances, observation clusters, monitoring priorities, and uncertainty.",
    "Scientist": "Focus on sensor evidence, confidence, FRP, spatial patterns, and limitations.",
    "Scientist / analyst": "Focus on sensor evidence, confidence, FRP, spatial patterns, and limitations.",
    "Land manager": "Focus on recorded fuel/land-cover labels, ecological context, nearby places, and field-verification priorities."
}

SYSTEM_PROMPT = """You are FireLedger, a careful wildfire intelligence summarizer.
Use only the supplied SQL facts. Do not invent incidents, fire perimeters, wind,
weather, roads, casualties, hospitals, evacuation orders, or spread direction.
FRP means fire radiative power, not fireline intensity. Population proximity is
a screening indicator, not proof of exposure. Label fire type as unclassified
unless the data explicitly provides a classification. State limitations.
Do not give dispatch commands or claim to replace official sources."""

def generate_answer(job, facts):
    if facts["observation_count"] == 0:
        return (
            "No data-backed briefing can be generated yet. The database currently "
            "contains no fire observations for Canada during 2023"
            + ( " in the selected map area." if get_request_area(job) else "." )
            + " The request has been checked against the required Canada-only, "
              "2023-only scope. No other countries or years were included."
        )

    role = job.get("role") or "Emergency responder"
    prompt = {
        "responder_role": role,
        "role_guidance": ROLE_GUIDANCE.get(role, ROLE_GUIDANCE["Emergency responder"]),
        "user_question": job.get("message") or "Summarize the fire observations.",
        "evidence": facts,
        "required_sections": [
            "Situation overview", "Fire type", "Fire activity (FRP)",
            "Population proximity", "Relevant nearby places", "Limitations"
        ]
    }

    if HF_TOKEN:
        try:
            response = requests.post(
                "https://router.huggingface.co/v1/chat/completions",
                headers={"Authorization": f"Bearer {HF_TOKEN}"},
                json={
                    "model": HF_MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": json.dumps(prompt)}
                    ],
                    "temperature": 0.15,
                    "max_tokens": 650
                },
                timeout=120
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            print("Mistral inference unavailable; using grounded fallback:", str(exc)[:300])

    return (
        f"{role} briefing — Canada, 2023\n\n"
        f"Situation overview: {facts['observation_count']} satellite fire observations "
        f"are recorded in the selected area.\n"
        f"Fire type: {json.dumps(facts['fire_type_counts'])}. These are dataset labels; "
        f"unclassified records have not been guessed.\n"
        f"Fire activity: mean FRP {facts['mean_frp_mw']} MW; maximum FRP "
        f"{facts['max_frp_mw']} MW. FRP is not fireline intensity.\n"
        f"Population proximity: {facts['population_nearby_observations']} observations "
        f"are flagged as near population. This is a screening indicator, not proof of exposure.\n"
        f"Nearest mapped places: {json.dumps(facts['nearest_places'])}.\n"
        f"Limitations: {ROLE_GUIDANCE.get(role, ROLE_GUIDANCE['Emergency responder'])} "
        "Verify current conditions with authoritative sources."
    )

def process_one_unanswered():
    with db() as conn:
        row = conn.execute("""
            SELECT * FROM requests
            WHERE lower(coalesce(status,'unanswered')) IN ('unanswered','pending')
            ORDER BY coalesce(created_at,'') ASC
            LIMIT 1
        """).fetchone()
        if row is None:
            return False
        job = dict(row)
        conn.execute(
            "UPDATE requests SET status='processing', error=NULL WHERE request_id=?",
            (job["request_id"],)
        )

    # Persist the processing state so it is visible in the shared SQL snapshot.
    github_upload_database()

    try:
        facts = load_fire_facts(job)
        answer = generate_answer(job, facts)
        now = utc_now()

        with db() as conn:
            conn.execute("""
                UPDATE requests
                SET status='answered', ai_answer=?, error=NULL
                WHERE request_id=?
            """, (answer, job["request_id"]))

            # Add assistant message if the existing messages table supports it.
            message_cols = {r["name"] for r in conn.execute("PRAGMA table_info(messages)")}
            if {"message_id","conversation_id","request_id","sender","content","created_at"}.issubset(message_cols):
                conn.execute("""
                    INSERT INTO messages(message_id,conversation_id,request_id,sender,content,created_at)
                    VALUES(?,?,?,?,?,?)
                """, (
                    str(uuid.uuid4()), job.get("conversation_id"), job["request_id"],
                    "assistant", answer, now
                ))

            summary_cols = {r["name"] for r in conn.execute("PRAGMA table_info(summaries)")}
            required = {"summary_id","request_id","content","created_at"}
            if required.issubset(summary_cols):
                conn.execute("""
                    INSERT INTO summaries
                    (summary_id,request_id,content,fact_ledger,dataset_version,model_version,created_at)
                    VALUES(?,?,?,?,?,?,?)
                """, (
                    str(uuid.uuid4()), job["request_id"], answer,
                    json.dumps(facts), "Canada-2023",
                    HF_MODEL if HF_TOKEN else "grounded-fallback", now
                ))

        github_upload_database()
        print(f"ANSWERED: {job['request_id']}")
        return True

    except Exception as exc:
        with db() as conn:
            conn.execute(
                "UPDATE requests SET status='error', error=? WHERE request_id=?",
                (str(exc)[:1500], job["request_id"])
            )
        github_upload_database()
        print("FAILED:", job["request_id"], repr(exc))
        return True

# --------------------------- MAIN LOOP ---------------------------
print("FireLedger worker starting.")
print(f"GitHub SQL source: {DB_OWNER}/{DB_REPO}/{DB_PATH} ({DB_BRANCH})")
print("Scope: Canada, January 1–December 31, 2023.")
print("Queue statuses: unanswered (also accepts legacy pending).")
print("No API server. No tunnel. No website connection.")

if not github_download_database():
    # The database repository/path must exist or be created first.
    raise FileNotFoundError(
        f"Could not find {DB_PATH} in {DB_OWNER}/{DB_REPO}. "
        "Create the SQLite database file in that repository first."
    )

initialize_schema()
github_upload_database()

while True:
    try:
        # Always pull the newest committed database before looking for work.
        github_download_database()
        initialize_schema()

        processed = 0
        while processed < MAX_REQUESTS_PER_CYCLE and process_one_unanswered():
            processed += 1

        if processed == 0:
            print(f"[{utc_now()}] No unanswered requests. Checking again in {POLL_SECONDS}s.")
        else:
            print(f"Processed {processed} request(s).")

    except KeyboardInterrupt:
        print("Worker stopped by user.")
        break
    except Exception:
        traceback.print_exc()

    time.sleep(POLL_SECONDS)
