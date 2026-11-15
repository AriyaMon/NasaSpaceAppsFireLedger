# FireLedger — NASA Space Apps 2026

Harmonized **MODIS (1 km)**, **VIIRS (375 m)**, and **Landsat 8/9 (30 m)** 26-year wildfire observatory (2000–2026), featuring a 3D Earth Globe, 26-Year & Daily Fire Spread Simulator, Burning Activity Calendar, Optical Wait-Time Bridge, and fact-verified Emergency Responder Briefings.

---

## 1. Run Anywhere in One Command (Docker — Alpine Linux)

To eliminate "works on my machine / cloud only" issues, FireLedger includes a multi-stage **Alpine Linux** `Dockerfile` (`node:22-alpine` builder + `python:3.12-alpine` runtime) that compiles the React frontend, discards `node_modules`, and serves both the web UI and Flask APIs via Gunicorn inside a minimal container.

### Option A — Docker Compose (One Command)
```bash
docker compose up --build
```
Then open **`http://localhost:3000`** in your browser.

### Option B — Plain Docker CLI (One Command)
```bash
docker build -t fireledger:alpine . && docker run --rm -p 3000:3000 fireledger:alpine
```
Then open **`http://localhost:3000`** in your browser.

*(Optional)* To pass live NASA FIRMS or GitHub API keys into the container:
```bash
docker run --rm -p 3000:3000 -e FIRMS_MAP_KEY="your_key" -e GITHUB_TOKEN="your_pat" fireledger:alpine
```

---

## 2. Run Locally with Python Virtual Environment (`.venv` + `requirements.txt`)

`requirements.txt` contains only lightweight pure-Python packages (`flask`, `gunicorn`, `waitress`, `python-dotenv`, `requests`) that install in seconds on Windows, macOS, and Linux without C/C++ compilers.

### Option A — One-Command Automatic Setup & Launch (Windows / macOS / Linux)
```bash
python3 scripts/setup_pyenv.py
```
*(Creates `.venv`, installs `requirements.txt`, builds `./dist` if `npm` is installed or falls back to the prebuilt `./assets` + `./pages-loader.js` bundle if Node.js is not installed, and starts the server at **`http://localhost:3000`**.)*

### Option B — Manual Virtualenv Setup
```bash
# 1. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\Activate.ps1

# 2. Install lightweight Python dependencies
pip install -r requirements.txt

# 3. Start the server (works even without running npm run build first)
python app.py
```
Then open **`http://localhost:3000`**.

---

## 3. Run Locally with Node.js / Express + Vite

```bash
npm install --legacy-peer-deps
npm run dev
```
Then open **`http://localhost:3000`**.

---

## 4. Public Team Viewer (GitHub Native Hosting / GitHub Pages)

- **Live Public URL**: `https://hackathonteam12341.github.io/NasaSpaceAppsFireLedger/`

FireLedger remains 100% compatible with native GitHub Pages hosting in all deployment modes:
1. **Direct Branch Hosting (`Deploy from a branch: dev / ryan_dev / gh-pages`)**:
   - `npm run build` runs `scripts/syncPagesBundle.mjs`, keeping `./assets/*`, `./pages-loader.js`, `./404.html`, and `./.nojekyll` synced at the repository root.
   - When served on `.github.io`, `index.html` automatically loads `./pages-loader.js` and switches `src/lib/apiClient.ts` into browser-side computation mode.
2. **GitHub Actions**:
   - Pushing to `dev`, `ryan_dev`, or `main` triggers `.github/workflows/deploy-pages.yml` to rebuild and publish the static bundle automatically.
