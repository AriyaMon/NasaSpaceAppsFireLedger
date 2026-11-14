# FireLedger — Execution & Deployment Guide (VS Code Flask + GitHub SQL Queue + Kaggle Mistral 7B)

This folder contains the self-contained **Kaggle GPU / CPU scripts** for scaling FireLedger to the full 2000–2026 global NASA FIRMS archive, fine-tuning **Mistral 7B QLoRA** on Kaggle, and running the **continuous GitHub SQLite (`unanswered` → `answered`) inference worker**.

---

## 1. Running the Web App Locally on VS Code (Flask) — No Local LLM Needed

1. Build the React frontend once (`npm install && npm run build`) so `./dist/` exists.
2. Create `.env` in the **project root folder** (next to `app.py` and `package.json`):
   ```env
   FIRMS_MAP_KEY="your_nasa_firms_map_key"
   GITHUB_REPO="AriyaMon/NasaSpaceAppsFireLedger"
   GITHUB_TOKEN="your_github_pat"
   ```
   *(No `LOCAL_LLM_URL` is required because Mistral 7B runs on Kaggle, not in VS Code.)*
3. Install Python packages & start Flask:
   ```bash
   pip install -r requirements.txt
   python app.py
   ```
   Open `http://localhost:3000`.

---

## 2. Worldwide Ingestion + Stage 1/2 ML + GitHub Sync (`kaggle/1_worldwide_ingest_and_harmonize.py`)

1. Open a **Kaggle Notebook** with **Internet ON**.
2. Open **Add-ons → Secrets** and enable:
   - `FIRMS_MAP_KEY`
   - `GITHUB_TOKEN` (Fine-grained PAT with **Contents: Read and Write**)
   - `GITHUB_REPO` = `AriyaMon/NasaSpaceAppsFireLedger`
3. Paste and run `/kaggle/1_worldwide_ingest_and_harmonize.py`.

---

## 3. Mistral 7B QLoRA Fine-Tuning & Continuous SQL Queue Worker (`kaggle/2_finetune_mistral7b_responders.py`)

1. Open a Kaggle Notebook with **GPU T4 x2** (or P100 16 GB) and **Internet ON**.
2. Enable Kaggle Secrets:
   - `GITHUB_TOKEN`
   - `GITHUB_REPO` = `AriyaMon/NasaSpaceAppsFireLedger`
   *(No `HF_TOKEN` needed — defaults automatically to ungated `NousResearch/Mistral-7B-Instruct-v0.3`.)*
3. Cell 1:
   ```python
   !pip install -q -U transformers peft trl bitsandbytes accelerate datasets requests
   ```
4. Cell 2: Paste `/kaggle/2_finetune_mistral7b_responders.py` and run it.
   - Fine-tunes Mistral 7B QLoRA across all 5 responder roles.
   - Polls **`database/inference_queue.sqlite`** on GitHub continuously every 8 seconds for rows where `status = 'unanswered'`.
   - Generates grounded briefings, verifies every number against `fact_ledger_json`, and commits **`status = 'answered'`** back into **`database/inference_queue.sqlite`** (plus `responses/<request_id>.json`).
5. Click **Ask Kaggle Mistral 7B** in the FireLedger UI — VS Code pushes a row tagged `unanswered` to GitHub and automatically swaps in Kaggle's answer once `status = 'answered'`.
