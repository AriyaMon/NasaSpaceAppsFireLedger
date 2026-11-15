# FireFusion

The GitHub Pages frontend is in `firefusion-next/`. The existing application at the repository root is untouched.

## Website
- Opens centered on Canada.
- Reads `Database/fireledger.db` directly from the public GitHub database repository using SQLite compiled to WebAssembly.
- Displays only rows from `fire_observations` where country is Canada and the observation date is in calendar year 2023.
- No website API endpoint, tunnel, notebook URL, or secret token is used.
- The database repository must be public for this read-only browser access. Never put a GitHub write token in frontend code.

## SQL database
Source of truth: `AriyaMon/NasaSpaceAppsDATABASE_KAGGLE`, branch `main`, file `Database/fireledger.db`.

Tables used by the worker:
- `requests`: incoming prompts; the worker scans `status='unanswered'` (and accepts legacy `pending`).
- `messages`: user and assistant conversation messages.
- `summaries`: generated response and evidence ledger.
- `metadata`: database scope and status.
- `fire_observations`: source observations used for analysis.

## Notebook worker
The single notebook worker pulls the latest SQLite file from GitHub, initializes missing tables/columns without dropping existing records, processes unanswered requests, writes answers and evidence into the same database, and commits the updated database back to GitHub. Run only one worker at a time; GitHub-hosted SQLite snapshots are not a concurrent transactional database.

Kaggle Secrets:
- `GITHUB_TOKEN`: GitHub token with Contents read/write access to `AriyaMon/NasaSpaceAppsDATABASE_KAGGLE`.
- `HF_TOKEN`: optional Hugging Face inference token.

No `.env` files are used. No ngrok or web API server is used.

## Request submission limitation
GitHub Pages is static and the website is intentionally read-only. It can display the public SQL snapshot, but it cannot securely insert a new request into a GitHub SQL file. Do not place a GitHub write token in browser JavaScript. Requests must be inserted into the SQL `requests` table through a trusted write-capable process; the notebook then polls and answers them.

## Analysis rules
- Canada only, January 1–December 31, 2023.
- No other countries or years are included.
- FRP is fire radiative power, not fireline intensity.
- Population proximity is a screening indicator, not proof of exposure.
- Fire type is reported only when present in the source data; otherwise it remains unclassified.
