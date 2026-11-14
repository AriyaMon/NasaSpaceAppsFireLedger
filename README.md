# FireLedger — NASA Space Apps 2026

Harmonized **MODIS (1 km)**, **VIIRS (375 m)**, and **Landsat 8/9 (30 m)** 26-year wildfire observatory (2000–2026), featuring a 3D Earth Globe, 26-Year & Daily Fire Spread Simulator, Burning Activity Calendar, Optical Wait-Time Bridge, and fact-verified Emergency Responder Briefings.

## Public Team Viewer (GitHub Pages)

- **Live Public URL**: `https://hackathonteam12341.github.io/NasaSpaceAppsFireLedger/`

### Why Deploying Directly from a Source Branch (`dev` / `site-david`) Shows a Blank Page
Because FireLedger is a **Vite + React + TypeScript** app, the source `index.html` in `dev` points to `<script type="module" src="/src/main.tsx"></script>`. Browsers cannot execute uncompiled `.tsx` files directly, so if GitHub Pages is configured to deploy raw source files from `dev` or `site-david`, the page renders blank white.

Instead, `.github/workflows/deploy-pages.yml` automatically compiles the TypeScript/React code via `vite build` into static JavaScript/CSS bundles (`dist/`) and supports **both** GitHub Pages modes:

1. **Option A — GitHub Actions (Recommended)**:
   - Go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
2. **Option B — Deploy from a branch (`gh-pages`)**:
   - Every run of `.github/workflows/deploy-pages.yml` also pushes the compiled `dist/` bundle to the **`gh-pages`** branch.
   - If you keep **Source** set to **Deploy from a branch**, change the branch dropdown from `site-david` / `dev` to **`gh-pages` (`/ (root)`)** and click **Save**.

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
