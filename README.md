# FireLedger — NASA Space Apps 2026

Harmonized **MODIS (1 km)**, **VIIRS (375 m)**, and **Landsat 8/9 (30 m)** 26-year wildfire observatory (2000–2026), featuring a 3D Earth Globe, 26-Year & Daily Fire Spread Simulator, Burning Activity Calendar, Optical Wait-Time Bridge, and fact-verified Emergency Responder Briefings.

## Public Team Viewer (GitHub Pages)

- **Live Public URL**: `https://hackathonteam12341.github.io/NasaSpaceAppsFireLedger/`

### Dual-Mode GitHub Pages Architecture (Works from `dev`, `gh-pages`, `site-*`, or GitHub Actions)
FireLedger uses a dual-mode entrypoint so the live site never renders a blank page regardless of how **Settings → Pages → Build and deployment** is configured:

1. **Local Vite Development & Build (`npm run dev` / `npm run build`)**:
   - `index.html` retains `<script type="module" src="/src/main.tsx"></script>` so Vite's dev server and bundler work natively without swapping HTML files.
2. **Direct Branch Hosting (`Deploy from a branch: dev / (root)` or `site-*`)**:
   - Running `npm run build` executes `scripts/syncPagesBundle.mjs`, which syncs the compiled static bundle (`./assets/*`), `./pages-loader.js`, `./404.html`, and `./.nojekyll` into the repository root using relative URLs (`./`).
   - When `index.html` is served directly by GitHub Pages from `dev` (where `/src/main.tsx` is not compiled on the fly), its inline fallback detector automatically boots `./pages-loader.js`, loading the prebuilt CSS and JS bundle cleanly.
3. **GitHub Actions & `gh-pages` Branch**:
   - Every push to `dev`, `main`, or `site-*` runs `.github/workflows/deploy-pages.yml`, which compiles the bundle, updates `./assets/` and `./pages-loader.js` on the branch, pushes `dist/` to `gh-pages`, and deploys via `actions/deploy-pages`.

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
4. Build static bundle and sync root GitHub Pages assets locally:
   ```bash
   npm run build
   ```

## Run Locally (Python / Flask Alternative)

```bash
npm install
npm run build
pip install -r requirements.txt
python app.py
```
