"""
FireLedger — Kaggle Pipeline 2: QLoRA Fine-Tuning of Mistral 7B + GitHub Request Worker
======================================================================================
Run this inside a Kaggle Notebook with GPU T4 x2 or P100 (16 GB VRAM).

What this script does:
1. Generates grounded instruction/briefing training pairs across all 5 responder roles:
   - firefighting, police, ambulance, scientist, land_manager
2. Fine-tunes `mistralai/Mistral-7B-Instruct-v0.3` in 4-bit QLoRA using PEFT + Transformers Trainer.
3. Runs a continuous GitHub Request-Response Polling Worker:
   - Constantly polls `requests/` in your GitHub repo (`[REDACTED]`)
   - Detects any `<request_id>.json` that does NOT yet have a matching `responses/<request_id>.json`
   - Generates a role-specific briefing using your fine-tuned Mistral 7B QLoRA model
   - Verifies all numbers against the request's Fact Ledger to prevent hallucinations
   - Commits the verified answer to `responses/<request_id>.json` on GitHub automatically.
4. Optionally exposes a live FastAPI + pyngrok `/brief` server if NGROK_TOKEN is provided.

Dependencies in Kaggle cell (auto-installed if missing):
  peft, bitsandbytes, accelerate, transformers, datasets, requests
"""

import base64
import importlib.util
import json
import os
import random
import re
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

for _pkg in ("peft", "bitsandbytes", "accelerate"):
    if importlib.util.find_spec(_pkg) is None:
        print(f"[SETUP] Installing missing package {_pkg}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "-U", _pkg])

import requests
import torch
from datasets import Dataset
from peft import LoraConfig, PeftModel, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)

def _clean_secret(val: Optional[str]) -> Optional[str]:
    cleaned = (val or "").strip()
    if not cleaned or re.match(r"^(n/a|na|none|null|my_.*|your_.*)$", cleaned, re.IGNORECASE):
        return None
    return cleaned


def _get_secret(name: str) -> Optional[str]:
    val = _clean_secret(os.environ.get(name))
    if val:
        return val
    try:
        from kaggle_secrets import UserSecretsClient  # type: ignore

        return _clean_secret(str(UserSecretsClient().get_secret(name) or ""))
    except Exception:
        return None


def normalize_github_repo(raw: Optional[str]) -> str:
    s = (raw or "").strip().split("?")[0].split("#")[0]
    s = re.sub(r"^https?://github\.com/", "", s, flags=re.IGNORECASE)
    s = re.sub(r"/(tree|blob)/.*$", "", s)
    s = re.sub(r"\.git$", "", s, flags=re.IGNORECASE)
    return s.strip("/") or "[REDACTED]"


HF_TOKEN = _get_secret("HF_TOKEN")
BASE_MODEL = os.environ.get(
    "BASE_MODEL",
    "mistralai/Mistral-7B-Instruct-v0.3" if HF_TOKEN else "NousResearch/Mistral-7B-Instruct-v0.3",
).strip()
OUTPUT_DIR = Path("./fireledger-mistral-7b-qlora")
GITHUB_TOKEN = _get_secret("GITHUB_TOKEN") or ""
GITHUB_REPO = normalize_github_repo(_get_secret("GITHUB_REPO") or "[REDACTED]")
POLL_INTERVAL_SECONDS = float(os.environ.get("POLL_INTERVAL_SECONDS", "8"))

ROLES = {
    "firefighting": "Firefighting & Incident Command",
    "police": "Police & Civil Evacuation Control",
    "ambulance": "Ambulance / EMS & Respiratory Triage",
    "scientist": "Earth-Observation & Fire Scientist",
    "land_manager": "Forestry & Land Resource Manager",
}

REGIONS = [
    ("Chilecito, La Rioja & Córdoba (CONAE ACT#356)", 7456, 44, 118, 16.4),
    ("Québec Boreal Shield (Canada)", 28400, 36, 78, 5.1),
    ("Southern Amazon Arc", 14200, 24, 290, 3.2),
    ("California & Sierra Nevada", 11850, 48, 65, 22.0),
    ("Mediterranean Basin", 4920, 39, 132, 14.5),
]


def synthesize_grounded_training_examples(n_samples: int = 600) -> List[Dict[str, str]]:
    rng = random.Random(42)
    examples: List[Dict[str, str]] = []

    for i in range(n_samples):
        region_name, base_ha, wind_kmh, wind_deg, slope_deg = REGIONS[i % len(REGIONS)]
        year = rng.randint(2001, 2026)
        month = rng.randint(1, 12)
        ym = f"{year}-{month:02d}"
        harm = rng.randint(45, 4200)
        lo90 = max(5, int(harm * 0.84))
        hi90 = int(harm * 1.18)
        landsat_lo = max(5, int(harm * 0.89))
        landsat_hi = int(harm * 1.12)
        coinc_pct = round(rng.uniform(76.0, 95.0), 1)
        med = max(10, int(harm / rng.uniform(0.6, 5.5)))
        pct_med = round((harm / med) * 100.0, 1)
        frp_total = round(harm * rng.uniform(24.0, 68.0))
        night_pct = round(rng.uniform(14.0, 38.0), 1)
        burned_ha = int(base_ha * rng.uniform(0.7, 1.3))
        burned_lo = int(burned_ha * 0.91)
        burned_hi = int(burned_ha * 1.09)
        role_key = list(ROLES.keys())[i % len(ROLES)]
        role_label = ROLES[role_key]

        ledger = {
            "ym": ym,
            "region": region_name,
            "harmonizedCount": harm,
            "lo90": lo90,
            "hi90": hi90,
            "landsatLo": landsat_lo,
            "landsatHi": landsat_hi,
            "landsatCoincidencePct": coinc_pct,
            "medianSameMonth": med,
            "pctOfMedian": pct_med,
            "frpTotalMw": frp_total,
            "nighttimeSharePct": night_pct,
            "predictedBurnedHa": burned_ha,
            "predictedBurnedLoHa": burned_lo,
            "predictedBurnedHiHa": burned_hi,
            "windSpeedKmh": wind_kmh,
            "windDirectionDeg": wind_deg,
            "slopeMeanDeg": slope_deg,
        }

        if role_key == "firefighting":
            target = (
                f"Incident Command Summary for {region_name} ({ym}): Harmonized 375 m VIIRS-equivalent thermal activity "
                f"stands at {harm:,} hotspots (90% conformal CI: {lo90:,}–{hi90:,}; Landsat 8/9 CI: {landsat_lo:,}–{landsat_hi:,}), "
                f"at {pct_med}% of the 26-year baseline ({med:,}). Total FRP is {frp_total:,} MW.\n\n"
                f"Wait-Time Bridge Containment: Pre-optical super-resolution maps {burned_ha:,} ha ({burned_lo:,}–{burned_hi:,} ha) "
                f"on {slope_deg}° slopes with {wind_kmh} km/h winds driving spread toward {wind_deg}°. Anchor indirect flanks outside the spread cone.\n"
                f"- Deploy engines & retardant on flanks perpendicular to {wind_deg}° ({wind_kmh} km/h).\n"
                f"- Assign night mop-up crews for the {night_pct}% nocturnal ember window.\n"
                f"- Validate perimeter against Landsat 9 ({coinc_pct}% coincidence)."
            )
        elif role_key == "police":
            target = (
                f"Law Enforcement & Evacuation Control Briefing for {region_name} ({ym}): Fire detections reached {harm:,} "
                f"(Landsat CI: {landsat_lo:,}–{landsat_hi:,}; {pct_med}% of {med:,} baseline) with {frp_total:,} MW radiative output.\n\n"
                f"Corridor Security: Wait-Time Bridge projects active perimeter growth beyond {burned_ha:,} ha along {wind_deg}° at {wind_kmh} km/h. "
                f"Establish roadblocks outside the 24 h spread cone and keep outbound evacuation corridors clear.\n"
                f"- Trigger evacuation warning downwind along {wind_deg}° ahead of the {burned_ha:,} ha scar.\n"
                f"- Enforce one-way outbound traffic control on arterial approaches.\n"
                f"- Maintain nocturnal patrols during the {night_pct}% overnight hotspot window."
            )
        elif role_key == "ambulance":
            target = (
                f"Ambulance / EMS & Respiratory Triage Briefing for {region_name} ({ym}): {harm:,} harmonized hotspots are releasing "
                f"{frp_total:,} MW ({pct_med}% of seasonal median), with {night_pct}% nighttime detections elevating nocturnal PM2.5 smoke trapping.\n\n"
                f"Staging Safety: Avoid Forward Aid Stations inside the {wind_deg}° downwind corridor ({wind_kmh} km/h) spanning {burned_ha:,} ha "
                f"({burned_lo:,}–{burned_hi:,} ha CI) across {slope_deg}° terrain. Stage ALS units upwind with dual egress.\n"
                f"- Pre-position respiratory triage upwind of the {wind_deg}° plume.\n"
                f"- Issue smoke shelter advisories during the {night_pct}% nocturnal inversion.\n"
                f"- Keep {slope_deg}° valley chokepoints clear for ambulance ingress."
            )
        elif role_key == "scientist":
            target = (
                f"Cross-Sensor Calibration Briefing for {region_name} ({ym}): Harmonized VIIRS-equivalent count is {harm:,} "
                f"(90% OOF conformal CI: {lo90:,}–{hi90:,}).\n\n"
                f"Third-Satellite Verification: Landsat 8/9 30 m cross-checks record {coinc_pct}% thermal coincidence, narrowing the "
                f"validated CI to {landsat_lo:,}–{landsat_hi:,} and confirming {burned_ha:,} ha Day-1 scar consistency.\n"
                f"- Audit {night_pct}% nocturnal detection sensitivity vs pre-2012 MODIS.\n"
                f"- Pair {frp_total:,} MW FRP with Landsat 30 m dNBR scar boundaries.\n"
                f"- Track Z-score departure against {med:,} calendar-month median."
            )
        else:
            target = (
                f"Land & Watershed Briefing for {region_name} ({ym}): Activity is {pct_med}% of the {med:,} median with {harm:,} "
                f"harmonized hotspots (Landsat CI: {landsat_lo:,}–{landsat_hi:,}).\n\n"
                f"Rehabilitation Footprint: The {burned_ha:,} ha scar on {slope_deg}° terrain ({coinc_pct}% Landsat agreement) "
                f"marks priority sub-watersheds for erosion mitigation.\n"
                f"- Prioritize {slope_deg}° slopes inside {burned_ha:,} ha for post-fire seeding.\n"
                f"- Cross-check severity bounds ({burned_lo:,}–{burned_hi:,} ha) with Landsat dNBR.\n"
                f"- Adjust fuel-break maintenance near {wind_deg}° wind corridors."
            )

        prompt = (
            f"<s>[INST] You are FireLedger's fine-tuned Mistral 7B Emergency & Earth-Observation Analyst.\n"
            f"Write a concise operational briefing tailored strictly for: {role_label}.\n"
            f"CRITICAL GROUNDING RULE: Use ONLY numbers present in the JSON Fact Ledger below.\n"
            f"FACT LEDGER:\n{json.dumps(ledger, indent=2)}\n"
            f"Deliver 2 crisp paragraphs + 3 bulleted actions. [/INST] {target}</s>"
        )
        examples.append({"text": prompt})

    return examples


def train_qlora() -> None:
    if (OUTPUT_DIR / "adapter_config.json").exists():
        print(f"[TRAIN] Existing LoRA adapters found at {OUTPUT_DIR}; skipping re-train.")
        return

    if hasattr(torch.autograd, "graph") and hasattr(
        torch.autograd.graph, "set_warn_on_accumulate_grad_stream_mismatch"
    ):
        torch.autograd.graph.set_warn_on_accumulate_grad_stream_mismatch(False)

    print(f"[TRAIN] Loading {BASE_MODEL} in 4-bit QLoRA...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, token=HF_TOKEN)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto",
        token=HF_TOKEN,
    )
    model.config.use_cache = False
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=False)
    try:
        model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    except TypeError:
        model.gradient_checkpointing_enable()

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    raw_dataset = Dataset.from_list(synthesize_grounded_training_examples(600))
    tokenized_dataset = raw_dataset.map(
        lambda batch: tokenizer(batch["text"], truncation=True, max_length=768),
        batched=True,
        remove_columns=["text"],
    )
    collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

    ta_kwargs: Dict[str, Any] = {
        "output_dir": str(OUTPUT_DIR),
        "per_device_train_batch_size": 2,
        "gradient_accumulation_steps": 4,
        "learning_rate": 2e-4,
        "num_train_epochs": 1,
        "logging_steps": 20,
        "save_strategy": "epoch",
        "fp16": torch.cuda.is_available(),
        "gradient_checkpointing": True,
        "gradient_checkpointing_kwargs": {"use_reentrant": False},
        "max_grad_norm": 0.3,
        "optim": "paged_adamw_8bit",
        "report_to": "none",
        "remove_unused_columns": False,
    }
    try:
        args = TrainingArguments(**ta_kwargs)
    except TypeError:
        ta_kwargs.pop("gradient_checkpointing_kwargs", None)
        ta_kwargs["optim"] = "adamw_torch"
        args = TrainingArguments(**ta_kwargs)

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=tokenized_dataset,
        data_collator=collator,
    )
    trainer.train()
    model.save_pretrained(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    print(f"[SAVED] Fine-tuned Mistral 7B LoRA adapters at {OUTPUT_DIR}")


def load_finetuned_model() -> Tuple[AutoTokenizer, PeftModel]:
    bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16)
    tokenizer = AutoTokenizer.from_pretrained(str(OUTPUT_DIR))
    base = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto",
        token=HF_TOKEN,
    )
    model = PeftModel.from_pretrained(base, str(OUTPUT_DIR))
    model.eval()
    return tokenizer, model


def verify_brief_numbers(text: str, fact_ledger: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    allowed: Set[str] = {"1", "2", "3", "24", "26", "30", "90", "375", "8", "9", "2000", "2012", "2026"}
    for val in fact_ledger.values():
        raw_str = str(val)
        for token in re.findall(r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?", raw_str):
            norm = token.replace(",", "")
            allowed.add(norm)
            if "." in norm:
                allowed.add(norm.split(".")[0])

    verified, rejected = [], []
    for token in re.findall(r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?", text):
        norm = token.replace(",", "")
        if norm in allowed:
            verified.append(token)
        else:
            rejected.append(token)
    return verified, rejected


def generate_grounded_reply(
    tokenizer: AutoTokenizer,
    model: PeftModel,
    prompt: str,
    max_new_tokens: int = 380,
) -> str:
    formatted = prompt if "[INST]" in prompt else f"<s>[INST] {prompt} [/INST]"
    inputs = tokenizer(formatted, return_tensors="pt").to(model.device)
    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.15,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    decoded = tokenizer.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
    return decoded.strip()


SQLITE_QUEUE_PATH = "database/inference_queue.sqlite"
LOCAL_QUEUE_DB = Path("./fireledger_queue.sqlite")

QUEUE_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS inference_requests (
    request_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    role TEXT NOT NULL,
    ym TEXT NOT NULL,
    region_name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    fact_ledger_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unanswered',
    response_text TEXT,
    verified_numbers_json TEXT,
    rejected_numbers_json TEXT,
    hallucination_free INTEGER,
    answered_at TEXT,
    model_name TEXT
)
"""


def _gh_headers() -> Dict[str, str]:
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "User-Agent": "FireLedger-Kaggle-Worker",
        "Content-Type": "application/json",
    }


def _resolve_default_branch() -> str:
    resp = requests.get(f"https://api.github.com/repos/{GITHUB_REPO}", headers=_gh_headers(), timeout=15)
    if resp.ok:
        return resp.json().get("default_branch", "main")
    return "main"


def _pull_sqlite_queue(branch: str) -> Tuple[Optional[str], bool]:
    """Downloads `database/inference_queue.sqlite` from GitHub. Returns (sha, existed)."""
    import sqlite3

    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{SQLITE_QUEUE_PATH}?ref={branch}"
    resp = requests.get(url, headers=_gh_headers(), timeout=20)
    if resp.status_code == 404 or not resp.ok:
        return None, False

    meta = resp.json()
    sha = meta.get("sha")
    content_b64 = meta.get("content")
    if content_b64:
        raw_bytes = base64.b64decode(content_b64)
    elif meta.get("download_url"):
        dl = requests.get(meta["download_url"], headers=_gh_headers(), timeout=20)
        if not dl.ok:
            return None, False
        raw_bytes = dl.content
    else:
        return None, False

    LOCAL_QUEUE_DB.write_bytes(raw_bytes)
    with sqlite3.connect(LOCAL_QUEUE_DB) as conn:
        conn.execute(QUEUE_SCHEMA_SQL)
        conn.commit()
    return sha, True


def _push_sqlite_queue(branch: str, sha: Optional[str], message: str) -> bool:
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{SQLITE_QUEUE_PATH}"
    encoded = base64.b64encode(LOCAL_QUEUE_DB.read_bytes()).decode("utf-8")
    body: Dict[str, Any] = {"message": message, "content": encoded, "branch": branch}
    if sha:
        body["sha"] = sha
    put_res = requests.put(url, headers=_gh_headers(), json=body, timeout=25)
    return put_res.ok


def _list_repo_dir(repo_dir: str, branch: str) -> Dict[str, Dict[str, Any]]:
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{repo_dir}?ref={branch}"
    resp = requests.get(url, headers=_gh_headers(), timeout=15)
    if resp.status_code == 404 or not resp.ok:
        return {}
    items = resp.json()
    if not isinstance(items, list):
        return {}
    return {item["name"]: item for item in items if item.get("type") == "file"}


def _fetch_json_file(download_url: str) -> Optional[Dict[str, Any]]:
    resp = requests.get(download_url, headers=_gh_headers(), timeout=15)
    if not resp.ok:
        return None
    return resp.json()


def _put_json_file(repo_path: str, payload: Dict[str, Any], branch: str, message: str) -> bool:
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{repo_path}"
    existing_sha = None
    get_res = requests.get(f"{url}?ref={branch}", headers=_gh_headers(), timeout=15)
    if get_res.ok:
        existing_sha = get_res.json().get("sha")

    encoded = base64.b64encode(json.dumps(payload, indent=2).encode("utf-8")).decode("utf-8")
    body: Dict[str, Any] = {"message": message, "content": encoded, "branch": branch}
    if existing_sha:
        body["sha"] = existing_sha

    put_res = requests.put(url, headers=_gh_headers(), json=body, timeout=20)
    return put_res.ok


def poll_github_requests_loop(tokenizer: AutoTokenizer, model: PeftModel) -> None:
    """
    Continuously polls `database/inference_queue.sqlite` (and legacy `requests/*.json`)
    on GitHub for rows tagged status = 'unanswered', runs Mistral 7B QLoRA inference,
    verifies numeric grounding, and updates status = 'answered' back to GitHub.
    """
    import sqlite3

    if not GITHUB_TOKEN:
        print("[WORKER] GITHUB_TOKEN not set; GitHub request polling loop disabled.")
        return

    branch = _resolve_default_branch()
    print(
        f"[WORKER] Polling https://github.com/{GITHUB_REPO} ({branch}) "
        f"every {POLL_INTERVAL_SECONDS}s for SQLite status='unanswered'..."
    )

    while True:
        try:
            # 1) Primary SQL database queue: database/inference_queue.sqlite
            db_sha, db_exists = _pull_sqlite_queue(branch)
            if db_exists:
                with sqlite3.connect(LOCAL_QUEUE_DB) as conn:
                    conn.row_factory = sqlite3.Row
                    pending_rows = conn.execute(
                        "SELECT request_id, role, ym, region_name, prompt, fact_ledger_json "
                        "FROM inference_requests WHERE status = 'unanswered' ORDER BY created_at ASC"
                    ).fetchall()

                    if pending_rows:
                        answered_ids: List[str] = []
                        for row in pending_rows:
                            req_id = row["request_id"]
                            prompt = str(row["prompt"] or "").strip()
                            fact_ledger = json.loads(row["fact_ledger_json"] or "{}")
                            if not prompt:
                                continue

                            print(f"[WORKER] SQLite unanswered -> {req_id} ({row['role']})...")
                            reply_text = generate_grounded_reply(tokenizer, model, prompt)
                            verified, rejected = verify_brief_numbers(reply_text, fact_ledger)
                            answered_at = datetime.now(timezone.utc).isoformat()

                            conn.execute(
                                """
                                UPDATE inference_requests
                                SET status = 'answered',
                                    response_text = ?,
                                    verified_numbers_json = ?,
                                    rejected_numbers_json = ?,
                                    hallucination_free = ?,
                                    answered_at = ?,
                                    model_name = ?
                                WHERE request_id = ?
                                """,
                                (
                                    reply_text,
                                    json.dumps(verified),
                                    json.dumps(rejected),
                                    1 if len(rejected) == 0 else 0,
                                    answered_at,
                                    "fireledger-mistral-7b-qlora",
                                    req_id,
                                ),
                            )
                            answered_ids.append(req_id)

                            # Also publish inspectable JSON mirror in responses/<req_id>.json
                            _put_json_file(
                                f"responses/{req_id}.json",
                                {
                                    "requestId": req_id,
                                    "status": "answered",
                                    "answeredAtIso": answered_at,
                                    "model": "fireledger-mistral-7b-qlora",
                                    "role": row["role"],
                                    "ym": row["ym"],
                                    "regionName": row["region_name"],
                                    "text": reply_text,
                                    "verifiedNumbers": verified,
                                    "rejectedNumbers": rejected,
                                    "hallucinationFree": len(rejected) == 0,
                                },
                                branch,
                                f"bot(mistral-7b): answered {req_id}",
                            )

                        conn.commit()
                        if answered_ids:
                            pushed = _push_sqlite_queue(
                                branch,
                                db_sha,
                                f"bot(mistral-7b): mark {len(answered_ids)} request(s) answered in SQL queue",
                            )
                            print(f"[WORKER] Updated SQLite queue status='answered' for {answered_ids} -> ok={pushed}")

            # 2) Fallback: standalone JSON requests/*.json marked unanswered
            req_files = _list_repo_dir("requests", branch)
            resp_files = _list_repo_dir("responses", branch)
            pending_json = sorted(name for name in req_files if name.endswith(".json") and name not in resp_files)

            for fname in pending_json:
                req_id = fname[:-5]
                req_payload = _fetch_json_file(req_files[fname]["download_url"])
                if not req_payload or req_payload.get("status", "unanswered") == "answered":
                    continue

                prompt = str(req_payload.get("prompt", "")).strip()
                fact_ledger = req_payload.get("factLedger", {})
                if not prompt:
                    continue

                print(f"[WORKER] JSON unanswered -> {req_id} ({req_payload.get('role', 'responder')})...")
                reply_text = generate_grounded_reply(tokenizer, model, prompt)
                verified, rejected = verify_brief_numbers(reply_text, fact_ledger)

                response_payload = {
                    "requestId": req_id,
                    "status": "answered",
                    "answeredAtIso": datetime.now(timezone.utc).isoformat(),
                    "model": "fireledger-mistral-7b-qlora",
                    "role": req_payload.get("role", "firefighting"),
                    "ym": req_payload.get("ym", ""),
                    "regionName": req_payload.get("regionName", ""),
                    "text": reply_text,
                    "verifiedNumbers": verified,
                    "rejectedNumbers": rejected,
                    "hallucinationFree": len(rejected) == 0,
                }
                ok = _put_json_file(
                    f"responses/{fname}",
                    response_payload,
                    branch,
                    f"bot(mistral-7b): answer FireLedger responder request {req_id}",
                )
                print(f"[WORKER] Returned responses/{fname} -> ok={ok} (rejected={len(rejected)})")
        except Exception as exc:
            print(f"[WORKER WARN] Poll error: {exc}")

        time.sleep(POLL_INTERVAL_SECONDS)


def serve_fastapi_ngrok(tokenizer: AutoTokenizer, model: PeftModel, ngrok_token: str) -> None:
    import uvicorn
    from fastapi import FastAPI
    from pydantic import BaseModel
    from pyngrok import ngrok

    app = FastAPI(title="FireLedger Mistral 7B Responder API")

    class BriefReq(BaseModel):
        prompt: str
        max_new_tokens: int = 380

    @app.post("/brief")
    def generate_brief(req: BriefReq):
        decoded = generate_grounded_reply(tokenizer, model, req.prompt, req.max_new_tokens)
        return {"brief": decoded, "model": "fireledger-mistral-7b-qlora"}

    ngrok.set_auth_token(ngrok_token)
    public_url = ngrok.connect(8000).public_url
    print("=======================================================")
    print(f"Set LOCAL_LLM_URL={public_url}/brief in FireLedger!")
    print("=======================================================")
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    train_qlora()
    tok, fine_tuned = load_finetuned_model()

    ngrok_token = os.environ.get("NGROK_TOKEN", "").strip()
    if ngrok_token and GITHUB_TOKEN:
        # Run GitHub queue polling in background alongside FastAPI ngrok server
        t = threading.Thread(target=poll_github_requests_loop, args=(tok, fine_tuned), daemon=True)
        t.start()
        serve_fastapi_ngrok(tok, fine_tuned, ngrok_token)
    elif ngrok_token:
        serve_fastapi_ngrok(tok, fine_tuned, ngrok_token)
    else:
        # Default: continuous GitHub unanswered-request polling worker
        poll_github_requests_loop(tok, fine_tuned)
