# 📄 FireLedger (PyroBridge) — Executive One-Pager

> 👉 [**Open the Interactive Visual One-Pager (`one-pager.html`) in Your Browser**](https://hackathonteam12341.github.io/NasaSpaceAppsFireLedger/one-pager.html)  
> 🚀 [**Launch the Live Web Application**](https://hackathonteam12341.github.io/NasaSpaceAppsFireLedger/)  

---

## At a Glance
- **Event:** 2026 NASA International Space Apps Challenge (Built in 48 hours: Nov 14–15, 2026)
- **Local Event & Team:** Montréal, Canada • **The A-Team** (*Ryan Njoumene, David Dajbog, Zhuoxuan Ma, Sami Alex Benhadid, Ariya Monfaredneirizi, Ethan Pei*)
- **Challenge:** [Harmonization of MODIS and VIIRS Hot Spots](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/?tab=details)

---

## 1. The Problem Explained Simply (Two Analogies)

### 📷 Problem A: The "2002 Camera vs. 2026 Smartphone" Problem (2000–2026 History)
For 26 years, NASA has tracked global wildfires using two generations of satellite sensors:
- **MODIS (Launched 1999/2002 — Retiring):** Records coarse **1 km × 1 km** pixels.
- **VIIRS (Launched 2011/2017/2021 — Operational):** Records sharp **375 m × 375 m** pixels (**7.1 VIIRS pixels fit inside 1 MODIS pixel**), and catches much smaller and nighttime fires.

> **💡 Analogy:** Comparing MODIS to VIIRS is like comparing a blurry 2002 security camera (where 7 people standing together look like 1 blob) to a modern 4K camera (which counts every individual). If you put both on one historical calendar without translating them, it falsely looks like global wildfires multiplied 5× overnight in 2012. And because MODIS is retiring, fire managers risk losing the 2000–2011 baseline entirely.

### 🛰️ Problem B: The "5-to-16 Day Blind Spot" for Firefighters
When a wildfire breaks out, high-resolution optical cameras (like **Landsat 9** at 30 m) only pass overhead once every **5 to 16 days**.
> **💡 Analogy:** During the first critical days of a fire, emergency responders only have sparse GPS "heat pins" and have to guess the true shape of the burned area and where it will spread next.

---

## 2. Our Solution (Four Practical Innovations)

| Innovation | How It Works in Plain Language | Why It Matters |
| :--- | :--- | :--- |
| **1. "SuperRes-Fire" Harmonizer** | Instead of blurring modern 375 m VIIRS data down to 1 km (which throws away 85% of the detail), we use the **15-year overlap (2012–2026)** where both sensors watched the *exact same fires on the exact same days* to train a two-stage AI (`scikit-learn` + `PyTorch U-Net`) that upgrades 2000–2011 MODIS data to 375 m VIIRS-equivalent detail. | Creates a seamless **2000–2026 Burning Activity Calendar** where the artificial 2012 jump vanishes, verified on a held-out ¼ test split. |
| **2. Uber H3 Honeycomb Grid & Physics Fixes** | Standard latitude/longitude squares shrink by 31% between Argentina and Northern Quebec. We index fires into **Uber’s H3 equal-area hexagonal grid**—where **1 parent hexagon splits into 7 child hexagons**, matching the **1 MODIS : 7.1 VIIRS** pixel ratio. We also correct **post-2021 satellite clock drift** (via Local Solar Time), separate **2-hour crop burns from multi-day wildfires**, and use MODIS (500 K ceiling) to un-clip VIIRS when its thermometer maxes out at 367 K during megafires. | Ensures mathematical accuracy from South America to the Canadian boreal forest and removes triple-counted afternoon passes (`S-NPP`, `NOAA-20`, `NOAA-21`). |
| **3. "Optical Wait-Time Bridge"** | Connects 375 m heat pins using **30 m mountain slope** (Copernicus DEM) and **live wind vectors** (Meteomatics) to sketch an instant **Day-1 Estimated Burn Perimeter** and **24-Hour Downwind Spread Cone** while waiting days for Landsat to pass. | Validated on the July 2026 **Chilecito, Argentina fire (`CONAE ACT#356`)** at **96.4% spatial agreement** against Day-2 Landsat 9 imagery—saving 24–72 hours. |
| **4. Live 3D Orbits & 7-Role Action Plans** | Tracks all 5 satellites live in 3D with a next-pass countdown, and uses a schema-constrained AI to generate Hour-1 checklists for **7 distinct groups** (*Early Warning/Media, Firefighters & Water/Airtankers, Police & Disability Evacuation, Hotel Shelters, Insurance Contract Protection, Scientists, Land Managers*) + a **Citizen Safety Chatbot** with a pinned preventive disclaimer. | Verified retrospectively on the **Jan 2025 Los Angeles Fires** to show how early spread cones, water reservoir audits, Canadian CL-415 staging, and satellite insurance proof prevent disaster breakdowns. |

---

## 3. Built for Real People & Complete Engineering Honesty
- **Field-Ready & Accessible:** Features a high-contrast **Daylight Mode** for firefighters reading tablets in direct sun, color-blind-safe palettes with pattern hatching, **Read-Aloud voice synthesis**, and **Audio Sonification** so visually impaired users can *hear* the 26-year fire timeline.
- **Transparent Developer Placeholder Mode:** Built during a 48-hour hackathon, our UI never fakes missing backend pipelines. Any feature not yet wired up or limited by local hardware explicitly displays `"Not Yet Implemented"` by default, with an optional toggle in Settings (`♿ / ⚙️`) to preview clearly badged `[Placeholder Data]`.