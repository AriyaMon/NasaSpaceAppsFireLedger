
# FireLedger (PyroBridge)

🌐 **Live Public Application:** [https://hackathonteam12341.github.io/NasaSpaceAppsFireLedger/](https://hackathonteam12341.github.io/NasaSpaceAppsFireLedger/)  
📄 **Accessible Project Overview (One-Pager):** [Read our Non-Specialist & Executive One-Pager (`./ONE_PAGER.md`)](ONE_PAGER.md)

---

## 🛰️ 2026 NASA International Space Apps Challenge

<p align="center">
  <a href="https://www.spaceappschallenge.org/" target="_blank" rel="noopener noreferrer">
    <img src="https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg" alt="NASA Official Insignia" width="140" />
  </a>
  <br />
  <strong>2026 NASA International Space Apps Challenge</strong>
  <br />
  <a href="https://www.spaceappschallenge.org/">Official Space Apps Website</a> •
  <a href="https://github.com/nasa">NASA Official GitHub</a> •
  <a href="https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/?tab=details">Official Challenge Brief</a>
</p>

### Project Lifecycle Context (November 14–15, 2026)
This repository was designed, engineered, and deployed during the **2026 NASA International Space Apps Challenge** over the official 48-hour hackathon window of **November 14–15, 2026**. We share this context to document the tight two-day engineering constraints under which the data harmonization pipeline, orbital tracker, and emergency response interface were built, as well as to remain completely transparent about which components are fully operational versus which remain on our post-hackathon research roadmap.

> **⚖️ Copyright, Trademark & Official Attribution Notice**  
> All NASA, CONAE (Comisión Nacional de Actividades Espaciales), CSA (Canadian Space Agency), ESA (European Space Agency), and NOAA imagery, insignia, mission identifiers, datasets, and direct challenge quotations referenced in this repository remain the sole property and copyright of the **National Aeronautics and Space Administration (NASA)** and its respective partner space agencies. All official marks and challenge descriptions are reproduced strictly for educational and hackathon participation purposes under the NASA Space Apps Challenge guidelines. In strict compliance with official rules, no NASA or partner agency logos or insignia have been generated or modified using artificial intelligence.

---

## 📍 Event, Selected Challenge & Team Roster

- **Local Event:** [Montréal, Canada](https://www.spaceappschallenge.org/) *(In-Person Participation)*
- **Selected Challenge:** [**Harmonization of MODIS and VIIRS Hot Spots**](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/?tab=details)
- **Team Name:** **The A-Team**

### Official Challenge Description (Quoted from NASA Space Apps)
> **Harmonization of MODIS and VIIRS Hot Spots — Challenge:**  
> *"Understanding how burning activity is distributed across our planet over time, including wildfires and agricultural burns intense enough to be detected by satellite sensors, enables us to anticipate critical periods, guide monitoring efforts, and improve fire response. Satellites have tracked active fire hotspots for more than two decades, but the record is split across sensors whose data cannot be compared directly, leaving fire managers without a consistent picture of when and where burning has occurred. Your challenge is to build a web application that harmonizes these records into a burning activity calendar based on active fire hotspots, enabling early warning and emergency responders, scientists, and land managers to examine historical fire patterns, unusual conditions, and critical periods within a selected area of interest."*  
> — [NASA Space Apps 2026 Challenge Details](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/?tab=details)

### 👥 Team Members — *The A-Team*
| Team Member | GitHub Profile |
| :--- | :--- |
| **Ryan Njoumene** | [`@ryan-njoumene`](https://github.com/ryan-njoumene) |
| **David Dajbog** | [`@spacedivee`](https://github.com/spacedivee) |
| **Zhuoxuan Ma** | [`@Niubi-Ma7`](https://github.com/Niubi-Ma7) |
| **Sami Alex Benhadid** | [`@Sam1Alex`](https://github.com/Sam1Alex) |
| **Ariya Monfaredneirizi** | [`@AriyaMon`](https://github.com/AriyaMon) |
| **Ethan Pei** | [`@EthanPei-1`](https://github.com/EthanPei-1) |

*(For an accessible, plain-language explanation of our scientific methodology and system architecture designed for non-specialists and reviewers, please consult our [**Project One-Pager (`./ONE_PAGER.md`)**](./ONE_PAGER.md).)*

---

## 🤖 Super Intelligence (SI) / AI Disclosure & Space Agency Data Attributions

In accordance with the **2026 NASA Space Apps Project Submission & Judging Guidelines**, we provide the following transparent disclosure regarding our use of AI tools and space agency datasets:

### 1. How AI Was Used During the 48-Hour Sprint
To work effectively within the two-day timeframe of November 14–15, 2026, our team used AI assistants (including Google Gemini / AI Studio and coding copilots) as an engineering multiplier and critical sounding board:
- **Adversarial Questioning & Architectural Red-Teaming:** We used AI to challenge our own assumptions and expose hidden physical traps in our initial prototype—such as questioning why standard latitude/longitude grids distort fire density between Argentina ($29^\circ\text{S}$) and Quebec ($53^\circ\text{N}$) compared to **Uber’s H3 equal-area hexagonal grid**, identifying the **2021–2026 Terra/Aqua orbital drift**, and addressing the **367 K VIIRS vs. 500 K MODIS saturation ceiling**.
- **Literature Synthesis & Competitive Benchmarking:** Rapidly reviewing remote-sensing documentation (MODIS Collection 6.1, VIIRS 375 m active fire algorithms, and Landsat 8/9 dNBR indices) and studying usability patterns from prior Space Apps cohorts to redesign our UI for field readability and accessibility.
- **Code Acceleration & Schema-Constrained Operational Briefings:** Accelerating React/TypeScript frontend scaffolding, Python geospatial scripts, and a schema-constrained local/worker LLM pipeline (`Pydantic` grammar enforcement) that translates verified sensor metrics into structured checklists for emergency responders and citizens.
- **Official Compliance:** Zero NASA or partner agency logos/identifiers were generated or altered by AI. All scientific harmonization metrics are computed from physical satellite records using `h3`, `scikit-learn`, `PyTorch`, `rioxarray`, and `SGP4` orbital propagation.

### 2. Space Agency Datasets & Official Global Offers Utilized
- **NASA FIRMS (Fire Information for Resource Management System):** Historical and Near Real-Time active fire hotspots from **MODIS Terra/Aqua (`MCD14DL` / `MODIS_SP`, 1 km, 2000–2026)** and **VIIRS (`VNP14IMGTDL` / `VJ114IMGTDL` / `VJ214IMGTDL`, 375 m, 2012–2026)** across Suomi NPP, NOAA-20, and NOAA-21.
- **CONAE (Comisión Nacional de Actividades Espaciales — Argentina):** Challenge briefing case study for **Activation `ACT#356` (Chilecito, La Rioja & Córdoba, Argentina — July 28–29, 2026)**.
- **CSA (Canadian Space Agency) Context:** Multi-decade boreal wildfire time-series analysis focused on **Quebec, Canada (2000–2026)**.
- **NASA / USGS Landsat 8 & 9 Collection 2 Level-2 (`landsat-c2-l2`):** 30 m optical surface reflectance (`NIR` / `SWIR2` dNBR burn-scar validation) accessed via the **Microsoft Planetary Computer Global Offer**.
- **ESA Copernicus Digital Elevation Model (`cop-dem-glo-30`) & WorldCover (`esa-worldcover`):** 30 m terrain slope/aspect and 10 m land-cover fuel barriers accessed via the **Microsoft Planetary Computer STAC API**.
- **Meteomatics Weather API (Space Apps Global Offer):** 10 m wind speed, wind direction, relative humidity, and drought parameters for 24-hour fire-spread cone projection.
- **NORAD / CelesTrak GP Ephemerides:** Real-time Two-Line Element (`TLE`) orbital sets propagated via `SGP4` for live 3D satellite tracking (`Terra`, `Aqua`, `Suomi NPP`, `NOAA-20`, `NOAA-21`, `Landsat 9`).

---

## 💻 Running the Project Locally (Docker, Node.js, or Python)

### ⚠️ Hardware Limitations & UI Placeholder Transparency Notice
Some backend tasks in this repository—such as training the Stage 2 `PyTorch U-Net` spatial super-resolution model, running local 4-bit quantized LLM inference, or polling live external APIs—require a CUDA-capable GPU (e.g., Kaggle Dual T4 or NVIDIA RTX 4050) and active API keys (`FIRMS_MAP_KEY`).  
- **Transparent Fallback Behavior:** If your host machine lacks a dedicated GPU, or if a specific backend pipeline/feature has not yet been wired up, **our Web UI will never silently fail or hide missing data**. By default, unimplemented or unavailable modules explicitly display a **`"🚧 Not Yet Implemented"`** diagnostic state specifying which backend engine (`Innovation A–D`) is required.
- **Previewing Approximations in Settings:** Users and judges can open the **`♿ / ⚙️ Settings & Developer`** menu in the top navigation bar and toggle **"Populate Placeholder / Fallback Data"** to **`ON`**. This populates missing views with pre-computed fallback approximations clearly tagged with a **`[⚠️ Placeholder Data]`** badge for complete transparency.

---

### Option 1: Run with Docker (Recommended — Quickest Host Setup)
Spin up the complete application in an isolated container in two commands:

```bash
# 1. Build the container image from the repository root
docker build -t fireledger-spaceapps:2026 .

# 2. Run the container on port 3000 (optionally passing your NASA FIRMS API key)
docker run --rm -p 3000:3000 -e FIRMS_MAP_KEY=your_optional_firms_key fireledger-spaceapps:2026
```
*(Or, if using Docker Compose: run `docker compose up --build` and open `http://localhost:3000`.)*

---

### Option 2: Run Locally with Node.js / Express
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
4. Build the static bundle and sync root GitHub Pages assets locally:
   ```bash
   npm run build
   ```

---

### Option 3: Run Locally with Python / Flask
```bash
npm install
npm run build
pip install -r requirements.txt
python app.py
```

---

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

## 📋 Master Feature Status & AI Agent Execution Checklist

> **🤖 Instructions for Teammates & AI Coding Agents:**  
> This checklist serves two purposes:  
> 1. **Transparent Disclosure for Judges & Users:** Clearly indicates which features are completed and live (`[x]`) versus which are currently in progress or scoped as stretch goals (`[ ]`).  
> 2. **Live Task Queue for AI Agents:** Before merging any feature branch back into `dev`, AI agents and developers **must update the checkboxes below (`[ ]` $\rightarrow$ `[x]`)** for every sub-step they have verified and completed.
>
> **🧭 Hackathon Triage & Transparency Rule:**  
> - **`[CORE MUST-HAVE]`**: Required for the official challenge objectives and main live demo flow. Complete these first.  
> - **`[COMPOUNDING FREEBIE — 5-MIN HIGH ROI]`**: 1-to-3 line Python/UI additions that yield high scientific validity and creativity for minimal time cost. Complete right after Core.  
> - **`[Theoretical Ideals]`**: Stretch goals for remaining hackathon hours or post-hackathon CV/portfolio expansion. If time runs out before code freeze, **do not rush or break the app**—leave them unchecked (`false` in `status_manifest.json`) so our Developer Placeholder System transparently displays their roadmap schema (or `[Placeholder Data]` badge) to the judges.

---

### ✅ Section 1: Datasets & Setup (`Document Tab 1 — Part 4`)
- [ ] **`[CORE MUST-HAVE]` Step 1.1 — NASA FIRMS Historical CSVs (`2000–2026`):** Download/stage `MODIS` (`MCD14DL`/`MODIS_SP`) and `VIIRS 375 m` (`VNP14IMGTDL`/`VJ114IMGTDL`/`VJ214IMGTDL`) for Showcase 1 (**Chilecito / Córdoba, Argentina**), Showcase 2 (**Quebec Boreal, Canada**), and Showcase 3 (**Los Angeles, California — Jan 2025 Fires**).
- [ ] **`[CORE MUST-HAVE]` Step 1.2 — NASA FIRMS Live `MAP_KEY`:** Claim free API key and store in environment/config for live bounding-box queries (with offline cache fallback).
- [ ] **`[CORE MUST-HAVE]` Step 1.3 — Microsoft Planetary Computer STAC Connection (`cop-dem-glo-30` & `landsat-c2-l2`):** Verify Python `pystac-client` access to 30 m Copernicus DEM and July 29, 2026 Chilecito Landsat 9 Level-2 bands (`nir08`, `swir22`).
- [ ] **`[CORE MUST-HAVE]` Step 1.4 — Meteomatics Wind API & CelesTrak TLE Cache:** Pull/cache 10 m wind speed & direction (`wind_speed_10m`, `wind_dir_10m`) and active NORAD TLEs (`25994, 27424, 37849, 43013, 54234, 49260`).
- [ ] **`[Theoretical Ideals — Intermediate]` Step 1.5 — ESA WorldCover 10 m (`esa-worldcover`) & Extended Meteomatics Drought/Moisture:** Pull 10 m land cover classes (rock/water/tundra barriers) and soil moisture / drought indices. *(If dropped: fallback to DEM slope + wind cone only).*

---

### ✅ Section 2: Backend Innovation A — "SuperRes-Fire" (`Document Tab 2`)

#### Action A1: Kaggle GPU Workspace & Package Setup
- [ ] **`[CORE MUST-HAVE]` Step A1.1:** Initialize Kaggle Notebook with `GPU T4 x2` (or local RTX 4050) and attach FIRMS datasets.
- [ ] **`[CORE MUST-HAVE]` Step A1.2:** Run `pip install` including `h3`, `scikit-learn`, `lightgbm`, `segmentation-models-pytorch`, `rioxarray`, `pystac-client`, `planetary-computer`.

#### Action A2: Physical Schema Normalization & H3 Resolution 9 De-Duplication
- [ ] **`[CORE MUST-HAVE]` Step A2.1 (Vegetation Filter):** Filter `type == 0` where present to drop industrial/volcanic false positives.
- [ ] **`[CORE MUST-HAVE]` Step A2.2 (Thermal Unification):** Unify `brightness`/`bright_ti4` $\rightarrow$ `temp_mir_k` and `bright_t31`/`bright_ti5` $\rightarrow$ `temp_tir_k`.
- [ ] **`[CORE MUST-HAVE]` Step A2.3 (Confidence Normalization):** Map VIIRS `'l'`, `'n'`, `'h'` $\rightarrow$ `30`, `65`, `90` (`confidence_norm`).
- [ ] **`[CORE MUST-HAVE]` Step A2.4 (Bowtie Area Weight):** Compute `pixel_area_km2 = scan * track` and `bowtie_weight = 1.0 / np.maximum(1.0, pixel_area_km2)`.
- [ ] **`[CORE MUST-HAVE]` Step A2.5 (H3 `Res-9` VIIRS Afternoon De-Duplication):** Index VIIRS into `h3_res9` (`~0.105 km²`) and deduplicate overlapping S-NPP / NOAA-20 / NOAA-21 passes by `(h3_res9, acq_date, daynight)` retaining max `frp`.

#### Action A3: Stage 1 Tabular Calendar Harmonizer (`scikit-learn` + H3 `Res-6`)
- [ ] **`[CORE MUST-HAVE]` Step A3.1 (H3 `Res-6` Equal-Area Grid):** Index MODIS (2000–2026) and deduplicated VIIRS (2012–2026) into `h3_res6` (`~36.13 km²` equal-area hexagons) and `h3_res8` (`~0.74 km²`, matching the `1 Res-8 : 7 Res-9` $\leftrightarrow$ `1 MODIS : 7.1 VIIRS` ratio).
- [ ] **`[CORE MUST-HAVE]` Step A3.2 (¾ Training / ¼ Holdout Testing Split):** Split the 2012–2026 overlap into ¾ Training (`2012-01` to `2022-06`) and ¼ Holdout Testing (`2022-07` to `2026-10`); train `HistGradientBoostingRegressor` for `viirs_dedup_count` and `viirs_frp_sum` + 90% conformal quantile bounds.
- [ ] **`[CORE MUST-HAVE]` Step A3.3 (Holdout Accuracy Verification):** Compute $R^2$, $\text{MAE}$, and 90% coverage on the ¼ testing set and export to `validation_metrics`.
- [ ] **`[CORE MUST-HAVE]` Step A3.4 (2000–2011 Back-Casting & Anomaly Z-Score):** Predict harmonized VIIRS-equivalent counts across 2000–2011 MODIS and export `sector_{id}_calendar.json` + `sector_{id}_harmonized_export.csv`.

#### Action A4: Stage 2 Spatial Super-Resolution (`PyTorch U-Net`)
- [ ] **`[CORE MUST-HAVE]` Step A4.1 (2D Patch Builder):** Rasterize 1 km MODIS FRP, Night mask, and 30 m Copernicus DEM slope/aspect onto `64×64` (`375 m/pixel`) tensors paired with 375 m VIIRS targets.
- [ ] **`[CORE MUST-HAVE]` Step A4.2 (U-Net Training & Inference):** Train `smp.Unet("resnet18")` (or morphological super-res fallback if GPU time is tight) and export 375 m super-resolved points into `sector_{id}_tactical_bridge.geojson`.

#### Action A5: The 9 Compounding Physical Freebies (`10 Lines of Pandas`)
- [ ] **`[COMPOUNDING FREEBIE — 5-MIN HIGH ROI]` Step A5.1 (`Freebie F1` — Local Solar Time):** Compute `local_solar_hour` and `diurnal_peak_alignment` from `acq_time + longitude/15` to fix 2021–2026 Terra/Aqua orbital drift.
- [ ] **`[COMPOUNDING FREEBIE — 5-MIN HIGH ROI]` Step A5.2 (`Freebie F2` — Two-Way 500K/367K Saturation & Thermal Contrast):** Compute `thermal_contrast_k = temp_mir_k - temp_tir_k` and `is_saturated_core`.
- [ ] **`[COMPOUNDING FREEBIE — 5-MIN HIGH ROI]` Step A5.3 (`Freebie F3` — H3 `Res-8` Persistence Ratio):** Flag `is_persistent_wildfire` ($\ge 2$ passes in `h3_res8`) vs. 1-pass agricultural burns.
- [ ] **`[COMPOUNDING FREEBIE — 5-MIN HIGH ROI]` Step A5.4 (`Freebie F4` — Bowtie FRP De-Aliasing):** Compute `frp_bowtie_corrected = frp * bowtie_weight`.
- [ ] **`[COMPOUNDING FREEBIE — 5-MIN HIGH ROI]` Step A5.5 (`Freebie F5` & `Compounding C1` — $T_{11\mu\text{m}}$ Baseline & Overnight Blow-Up Flag):** Pass `mean_temp_tir_k` to regressor and flag events where Night/Day FRP ratio $> 0.50$.

#### Actions A6 & A7: `[Theoretical Ideals — Hard]`
- [ ] **`[Theoretical Ideals — Hard]` Step A6.1 (24-Hour Video Inpainting CV):** Interpolate hourly missing LST frames between satellite passes using wind optical flow / 3D Conv U-Net. *(If dropped: UI shows standard daily/pass-by-pass scrubber).*
- [ ] **`[Theoretical Ideals — Hard]` Step A7.1 (Domain-Adversarial DANN & Counterfactual Simulator):** Add Gradient Reversal Layer and climate-conditioned counterfactual decoder (`2001 Fire under 2026 Drought`). *(If dropped: UI marks counterfactual toggle with roadmap/placeholder badge).*

---

### ✅ Section 3: Backend Innovations B, C, D & BFF Layer (`Document Tab 3`)

#### Action B1–B5: Innovation B ("Optical Wait-Time Bridge")
- [ ] **`[CORE MUST-HAVE]` Step B1.1 (Copernicus 30 m DEM & Landsat 9 dNBR Validation):** Pull `cop-dem-glo-30` slope and compute July 29, 2026 Landsat 9 dNBR (`landsat-c2-l2`) ground-truth burn scar (`7,612 ha`) for Chilecito (`CONAE ACT#356`).
- [ ] **`[CORE MUST-HAVE]` Step B2.1 (Meteomatics Wind Vectors):** Fetch/cache 10 m wind speed and direction for Chilecito (`2026-07-28`), Quebec (`2023-06`), and Los Angeles (`2025-01-07`).
- [ ] **`[CORE MUST-HAVE]` Step B3.1 (Day-1 Burn Polygon & 24h Spread Cone):** Run OpenCV morphological closing + wind/slope projection to output `day1_burn_scar` (`7,456 ha`, `96.4% IoU`), `wind_spread_cone_24h`, and `landsat_validation_scar` in `sector_{id}_tactical_bridge.geojson`.
- [ ] **`[CORE MUST-HAVE]` Step B4.1 (BFF Local-First Bundle Export):** Export compact JSON/GeoJSON/CSV files (`<150 KB`) into `/public/data/bff/` + `status_manifest.json`.
- [ ] **`[COMPOUNDING FREEBIE — 5-MIN HIGH ROI]` Step B5.1 (`Compounding C2 & C3`):** Add H3 centroid empirical spread vector (`v_obs`) and PyroCb/smoke-shielding confidence buffer (`temp_mir_k > 365` next to `temp_tir_k < 255`).
- [ ] **`[Theoretical Ideals — Intermediate]` Step B6.1 (ESA WorldCover 10 m Terrain Barrier Smothering):** Multiply spread cone by `esa-worldcover` combustibility mask so fire perimeters clip cleanly at lakes, rivers, and bare rock plateaus. *(If dropped: use DEM slope + wind cone only).*

#### Action C1–C2: Innovation C ("Live 3D Satellite Tracking & Auto-Refresh")
- [ ] **`[CORE MUST-HAVE]` Step C1.1 (TLE & SGP4 Pass Predictor):** Propagate `Terra`, `Aqua`, `S-NPP`, `NOAA-20`, and `NOAA-21` TLEs to output live countdown (`countdown_sec`) and swath intersections over the selected AOI.
- [ ] **`[CORE MUST-HAVE]` Step C2.1 (FIRMS Latency-Aware Poller):** Export `firms_refresh_state` distinguishing `SCHEDULED` $\rightarrow$ `OVERPASS_NOW` $\rightarrow$ `POLLING_FIRMS` $\rightarrow$ `CONFIRMED_UPDATED`.
- [ ] **`[COMPOUNDING FREEBIE — 5-MIN HIGH ROI]` Step C2.2 (`Compounding C4` — Next-Pass Sensitivity Floor):** Compute `next_pass_min_detectable_frp_mw` from the upcoming pass's off-nadir scan angle.

#### Action D1–D4: Innovation D ("Schema-Constrained Local LLM & Citizen Chatbot")
- [ ] **`[CORE MUST-HAVE]` Step D1.1 (Pydantic 7-Audience Schema):** Enforce `MultiAudienceActionPlan` schema requiring all 7 target audiences (`Early Warning/Media`, `Firefighters/Water/Airtankers`, `Police/Mobility Evac/Traffic`, `Hotel Shelters`, `Insurance Enforcement`, `Scientists`, `Land Managers`).
- [ ] **`[CORE MUST-HAVE]` Step D2.1 (Generate Verified Action Plans for All 3 Case Studies):** Run QLoRA / 4-bit GGUF model (or deterministic schema generator fallback) grounded in Innovation A + B metrics for **Chilecito 2026**, **Los Angeles 2025**, and **Quebec 2023**, exporting `sector_{id}_action_plan.json`.
- [ ] **`[CORE MUST-HAVE]` Step D3.1 (Citizen Safety Chatbot + Mandatory Top Disclaimer):** Export `sector_{id}_citizen_faq.json` / endpoint with the hard-coded preventive safety disclaimer pinned to the top of every answer.
- [ ] **`[Theoretical Ideals — Easy & Intermediate]` Step D4.1 (Cloud AI API Switcher, `EN`/`ES`/`FR` Localization & Spoken Radio Alerts):** Add `llm_router.py` cloud failover, Spanish/French translations, and 25-second spoken WEA audio alert synthesis.

---

### ✅ Section 4: Frontend Web Interface (`Document Tab 4`)

#### Section 4.1: Global Shell, Accessibility & Developer Placeholder System
- [ ] **`[CORE MUST-HAVE]` Step UI-1.1 (Zero-Scroll `100dvh` Layout & Clean Typography):** Remove vertical page scrolling and repetitive text walls; enforce 8px spacing grid and clean navigation across views.
- [ ] **`[CORE MUST-HAVE]` Step UI-1.2 (Daylight High-Contrast Light Mode + Dark Mode):** Implement CSS theme toggle in top header / settings drawer so field tablets are readable in direct sunlight.
- [ ] **`[CORE MUST-HAVE]` Step UI-1.3 (Developer Placeholder Toggle — Default `OFF`):** Read `status_manifest.json`; when `OFF`, render `"🚧 Not Yet Implemented — Source: Innovation [A/B/C/D]"` with hover/tap Data Contract tooltip; when `ON`, populate fallback data with a visible `[⚠️ Placeholder Data]` badge.
- [ ] **`[CORE MUST-HAVE]` Step UI-1.4 (Visual & Audio Accessibility):** Implement color-blind ramps (`Inferno`, `Viridis`, `Cividis`), SVG hatching patterns, `Web Speech API` Read-Aloud button, and `Web Audio API` 26-Year Sonification sweep.
- [ ] **`[CORE MUST-HAVE]` Step UI-1.5 (Graceful Offline / API Fail-State Banner):** Catch live FIRMS/weather timeouts and switch cleanly to Local-First BFF cache with a human-readable message.

#### Section 4.2: Individual Operational Views (`Views 1–5`)
- [ ] **`[CORE MUST-HAVE]` Step UI-2.1 (`View 1: Landing & Region Selector`):** 3 Preset Cards (**Chilecito 2026 `ACT#356`**, **Quebec 2023 Boreal**, **Jan 2025 Los Angeles Fires**) + 2D Map rectangle bounding-box tool + manual `Lat/Lon` & Date inputs.
- [ ] **`[CORE MUST-HAVE]` Step UI-2.2 (`View 2: 2000–2026 Burning Activity Calendar`):** Month × Year heatmap + **"AI-Harmonized vs. Raw Unharmonized (Broken 2012 Jump)" Toggle** + 26-Year Continuity Curve + Anomaly Bar Chart + **`[ ⬡ Indexed via Uber H3 DGGS ]` subtitle badge** + 1-Click CSV Download.
- [ ] **`[COMPOUNDING FREEBIE — 5-MIN HIGH ROI]` Step UI-2.3 (`View 2 Freebie Pills`):** Add `[ All Fires | 🌲 Persistent Wildfires | 🌾 Crop Burns ]` filter pill and `[ ☀️ LST Drift Corrected ]` / `[ 💨 Overnight Blow-Up ]` badges.
- [ ] **`[CORE MUST-HAVE]` Step UI-2.4 (`View 3: Tactical Map & Optical Wait-Time Bridge`):** 2D topographic map with toggles for `1 km MODIS`, `375 m Super-Res`, `Day-1 Burn Scar Polygon (ha)`, `24h Wind Cone`, and `Day-2 Landsat 9 Validation` + 3 right-hand KPI cards + 1-Click GeoJSON Download.
- [ ] **`[CORE MUST-HAVE]` Step UI-2.5 (`View 4: Live 3D Orbital Tracker`):** 3D globe (`Terra`, `Aqua`, `S-NPP`, `NOAA-20`, `NOAA-21` with `[Retiring]` vs. `[Operational]` tags), live SGP4 countdown timer, and 4-step FIRMS latency status bar.
- [ ] **`[CORE MUST-HAVE]` Step UI-2.6 (`View 5: Multi-Audience Action Plan & Citizen Chatbot`):** Pinned top safety disclaimer banner + Left 7-role selector matrix (showing 1 role at a time + 2025 L.A. / 2026 Chilecito historical comparison) + Right Citizen Safety Chatbot with Insurance Proof download.
- [ ] **`[Theoretical Ideals]` Step UI-2.7 (Stretch UI Controls):** `🌐 EN | ES | FR` language pill, `[ 📻 Broadcast Voice Alert ]`, `[ ▶ Play 24h Inpainted Movie ]`, and `[ 🌡️ 2026 Drought Counterfactual ]` toggle.

---

### ✅ Section 5: Final Submission & Pitch Readiness (`Document Tab 5`)
- [ ] **`[CORE MUST-HAVE]` Step S1:** Deploy live web app URL (GitHub Pages / Cloud) and submit URL to **FortiGuard Web Filter Classification** so judges' firewalls don't block it.
- [ ] **`[CORE MUST-HAVE]` Step S2:** Record **$\le 30$-second video demo** (or export **$\le 7$-slide deck** following the Tab 5 Slide Blueprint), verify public Incognito access, and paste link into Project Submission Page.
- [ ] **`[CORE MUST-HAVE]` Step S3:** Include mandatory **Super Intelligence (SI) disclosure** in GitHub `README.md`, web footer, and submission form (and ensure zero AI-modified NASA logos).
- [ ] **`[CORE MUST-HAVE]` Step S4:** Verify all teammates are confirmed in the same Local Event and click **"Submit for Judging"** before the deadline.


