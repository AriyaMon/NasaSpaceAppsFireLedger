# FireLedger — NASA Space Apps 2026

Harmonized **MODIS (1 km)**, **VIIRS (375 m)**, and **Landsat 8/9 (30 m)** 26-year wildfire observatory (2000–2026), featuring a 3D Earth Globe, 26-Year & Daily Fire Spread Simulator, Burning Activity Calendar, Optical Wait-Time Bridge, and fact-verified Emergency Responder Briefings.

## Public Team Viewer (GitHub Pages)

This repository includes a public GitHub Pages workflow (`.github/workflows/deploy-pages.yml`) that builds the `dev` (and `main`) branch directly into a public static web viewer so every project member can open the live site without private AI Studio permissions:

- **Live Public URL**: `https://ariyamon.github.io/NasaSpaceAppsFireLedger/`

### Enabling Public Hosting on GitHub (One-Time Setup)
1. Push this updated `dev` branch to `https://github.com/AriyaMon/NasaSpaceAppsFireLedger.git`.
2. Open the repository on GitHub → **Settings** → **Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. The workflow automatically triggers on pushes to `dev` or `main` (or via **Actions → Deploy FireLedger to GitHub Pages → Run workflow**) and publishes the live observatory URL for all team members.

> When hosted statically on GitHub Pages, FireLedger automatically switches from `/api/*` server endpoints to its built-in client-side harmonization engine (`src/lib/*`) and public GitHub raw data sync, keeping the 3D globe, timeline simulator, charts, responder briefings, and CSV/GeoJSON exports 100% functional.

---

## Run Locally (Full-Stack Node.js / Express)

**Prerequisites:** Node.js 22+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Optional: copy `.env.example` to `.env` and configure `FIRMS_MAP_KEY`, `GITHUB_REPO`, or `GITHUB_TOKEN`.
3. Start the Express + Vite server on port `3000`:
   ```bash
   npm run dev
   ```
4. Build static bundle for GitHub Pages locally:
   ```bash
   npm run build:pages
   ```

## Run Locally (Python / Flask Alternative)

```bash
npm install
npm run build
pip install -r requirements.txt
python app.py
```
