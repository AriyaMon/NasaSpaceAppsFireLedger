# FireFusion Next

This is an isolated project under `firefusion-next/`. The existing root application is untouched.

## Scope and map
- Map opens centered on Canada.
- All analytical queries are restricted to January 1 through December 31, 2023, and country Canada.
- The map displays records returned by the Kaggle API from the SQL table `fire_observations`.
- Required observation fields: `observation_id`, `observed_at`, `country`, `latitude`, `longitude`; optional fields include `fire_type`, `frp_mw`, `confidence`, `population_nearby`, `nearest_place`, `distance_to_population_km`, and `source`.
- No fire observations are fabricated. Until the dataset is loaded, the map is centered on Canada and shows an awaiting-data state.

## Architecture
1. The SQL source of truth is `AriyaMon/NasaSpaceAppsDATABASE_KAGGLE`, file `Database/fireledger.db`, branch `main`.
2. Kaggle downloads that SQLite database at startup, initializes/upgrades its tables, and creates the database file on GitHub if it is not there yet.
3. The Kaggle worker polls the local working copy of that same SQL database every 10 seconds for pending requests. Requests are synchronized to GitHub when submitted and when completed.
4. The Kaggle API returns map observations and request results to this static GitHub Pages frontend.
5. One Kaggle notebook/session must remain running for the API and worker to remain available. The ngrok URL is only the network bridge between Pages and Kaggle; the SQL database remains in the GitHub database repository.

## GitHub Pages
Enable Pages for `HackathonTeam12341/NasaSpaceAppsFireLedger` on branch `main`, folder `/ (root)`. The app will then be available at:
`https://hackathonteam12341.github.io/NasaSpaceAppsFireLedger/firefusion-next/`
(Use the repository's actual Pages URL shown in Settings → Pages.)

## Kaggle setup — no .env files
1. Create one Kaggle notebook.
2. In Notebook → Add-ons → Secrets, create:
   - `GITHUB_TOKEN`: token with Contents read/write access to `AriyaMon/NasaSpaceAppsDATABASE_KAGGLE`.
   - `NGROK_AUTHTOKEN`: your ngrok authentication token.
   - `HF_TOKEN` (optional): Hugging Face token if you want hosted Mistral inference.
3. Paste the one-cell launcher supplied in the project instructions. It installs dependencies, reads these secrets, downloads `kaggle_worker.py` from this repository, and runs it.
4. Copy the HTTPS API URL printed by Kaggle into `API_BASE` at the top of `app.js`, then commit that one-line edit.
5. Keep the Kaggle notebook running.

## Database tables
The worker preserves the existing `requests`, `conversations`, `messages`, `summaries`, and `metadata` tables. It adds `fire_observations` for the incoming fire dataset and map intelligence. The worker creates/upgrades schema without dropping existing records.

## Important
- The supplied data has not yet been loaded. The application will not display invented detections.
- Fire type must be supplied as a dataset classification or derived from a separately documented land-cover source; the worker does not guess it.
- FRP (fire radiative power) is not fireline intensity.
- Population proximity is only as reliable as the population/settlement layer used to populate the optional fields.
- GitHub stores SQLite snapshots; it is not a transactional hosted SQL service. Run one Kaggle worker only to avoid conflicting writes.
- Never place GitHub, Hugging Face, or ngrok secrets in frontend JavaScript or committed files. Do not use .env files.
