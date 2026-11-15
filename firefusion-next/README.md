# FireFusion Next

An isolated copy/extension of the FireFusion Leaflet map, built in this folder so the existing repository files remain untouched.

## What is included
- Leaflet world map with the same OpenStreetMap base-map approach.
- Harmonized global-cell layer from the repository's `harmonized_global_cells.json`.
- Rectangle area selection and selected-cell summary.
- Responder profiles: ambulance/medical, firefighter, emergency responder, scientist/analyst, and land manager.
- Date fields, AI briefing requests, and follow-up chat.
- Kaggle FastAPI service, SQLite request queue, 10-second worker polling, and optional GitHub database snapshots.

## Run the webpage
Enable GitHub Pages for this repository (Settings → Pages → Deploy from a branch → main → /(root) is the existing root site). To publish this folder as a separate project page, use a small root-level workflow or copy the folder into a dedicated branch/site. The files here are independent of the current root app.

## Start the Kaggle backend
1. Open a Kaggle notebook and add `kaggle_worker.py` as a code cell/file.
2. Add Kaggle Secrets named `NGROK_AUTHTOKEN`, `GITHUB_TOKEN` and optionally `HF_TOKEN`. The GitHub token needs Contents read/write access to this repository. The Hugging Face token enables model-generated answers; without it, a deterministic dataset-grounded briefing is returned.
3. Install dependencies in a notebook cell:
   `!pip -q install fastapi uvicorn pyngrok requests pydantic`
4. Run `%run /kaggle/working/kaggle_worker.py` after uploading the file to the notebook working directory, or paste its contents into a cell.
5. Copy the HTTPS URL printed by ngrok into `API_BASE` at the top of `app.js`. Commit the updated `app.js`.

The Kaggle cell must remain running. Kaggle sessions are temporary; this is a demo architecture, not a 24/7 production service.

## Database design
The worker creates `firefusion_requests.sqlite` automatically with `requests`, `conversations`, `messages`, and `metadata` tables. It syncs the SQLite file to `firefusion-next/firefusion_requests.sqlite` in GitHub when a request is added or processed, if `GITHUB_TOKEN` is configured. GitHub stores a database file; it is not itself a live SQL server. Run only one worker to avoid concurrent SQLite snapshot overwrites.

## Important dataset limitations
The current `harmonized_global_cells.json` contains 3,000 spatially aggregated cells. The map visualizes those cells and the worker calculates statistics inside the selected rectangle. The global-cell snapshot does not include per-cell dates, so the date fields are recorded with requests but do not filter the aggregate cell counts. Detection counts are not counts of confirmed separate fires. The briefing explicitly warns users that this dataset is not a live incident feed and must not be used as dispatch or evacuation authority.

## Security
Never put GitHub, Hugging Face, or ngrok tokens in `app.js` or any committed frontend file. Store them only in Kaggle Secrets. Revoke any token previously pasted into code or chat.
