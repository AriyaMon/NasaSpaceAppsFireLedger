# FireLedger Satellite Tracking (integration module)

**Branch:** feature/tle-satellite-tracking. This repo currently contains datasets, **not** the actual CesiumJS frontend, AOI picker, harmonization executable, or Burning Activity Calendar. This is a working integration module, **not a deployed/connected UI**. Do not merge without integrating and testing against the real app.

## Components
- `satellites.js`: five satellites, CelesTrak TLE parsing, SGP4 propagation, swath metadata and retirement flags.
- `overpasses.js`: approximate AOI swath-overlap window predictions (45-second sampling, refined crossing). Forecasts only for operational spacecraft with fresh TLEs.
- `cesiumLayer.js`: attaches satellite markers, orbit polylines and optional approximate ground swaths to an existing Cesium Viewer; supports visibility and selection.
- `server.js`: Node 20+ TLE caching and NASA FIRMS Area API server-side proxy. No secrets sent to browser.
- `monitor.js`: AOI-aware forecasts, live pass status, post-pass FIRMS polling (every 10 min, up to 3h), callback for existing harmonization/map/calendar.
- `dashboard.js`: optional minimal monitoring panel; host supplies its container.

## Install and run
```bash
cd satellite-tracking
npm install
FIRMS_MAP_KEY="YOUR_SERVER_SIDE_SECRET" npm start
```
On Windows PowerShell use `$env:FIRMS_MAP_KEY="..."; npm start`. Use a private .env loader or deployment secrets instead of committing keys. Adapter listens at http://localhost:8787. In production host the adapter behind the same origin as your frontend, or configure `APP_ORIGIN`.

```js
import { createSatelliteMonitor } from "./satellite-tracking/monitor.js";
import { attachSatelliteDashboard } from "./satellite-tracking/dashboard.js";

// viewer and Cesium MUST be supplied by your existing application.
// Render callbacks must connect to your real data processing and calendar.
let panel;
const monitor = await createSatelliteMonitor({
  viewer, Cesium,
  onSchedule: passes => panel?.updateSchedule(passes),
  onStatus: status => panel?.updateStatus(status),
  onHotspots: async ({ rows, allRows, pass, checkedAt }) => {
    // TODO: hand rows to existing harmonizer, update map/calendar/analytics.
    // allRows includes all detections from this source in the AOI for the latest day.
    console.log("New published observations", rows.length, pass.name, checkedAt);
  }
});
panel=attachSatelliteDashboard(document.getElementById("satellite-panel"),monitor);
// Wire to your EXISTING AOI selection event, don't replace the selector:
// existingAOISelector.onChange(box => monitor.setAOI(box));
// Example: monitor.setAOI({west:-122.8,south:37.0,east:-121.8,north:38.1});
```

## Scientific and operational limitations
- A TLE is an orbital estimate, **not real-time spacecraft telemetry**. If stale (older than 7 days), satellites are displayed as stale but omitted from pass forecasts.
- Cross-track swath half-width is used as a simplified geometric threshold with a 5×5 grid of AOI sample points. It does not model instrument scan geometry, pointing, cloud conditions, acquisition mode, image quality or fire detection probability. **Do not describe pass times as exact.**
- Only standard non-antimeridian rectangular AOIs supported. Split bounding boxes crossing ±180° for future global expansion.
- Suomi NPP stopped delivering new FIRMS VIIRS detections 2026-11-02 (NASA). Kept in display for history, omitted from upcoming publication triggers.
- Terra and Aqua remain in forecast until their science operations terminate; update `operational` flags based on NASA mission status. No automatic retirement-status service implemented.
- FIRMS MODIS source combines Terra and Aqua. Polling filters MODIS results by `satellite` and observation time. Unmatched records are not counted as confirmed publications.
- A pass with zero reported fires is **not proof that the instrument has not published**; display an inconclusive status, never fabricate data.
- Polling uses a shared 10-minute cache and only triggers after a predicted pass; add persistent scheduling/queueing for multi-user production to avoid repeated requests after restarts.
- Integration and end-to-end tests need the actual frontend, backend, and calendar source files.

Sources: https://celestrak.org/NORAD/documentation/gp-data-formats.php ; https://firms.modaps.eosdis.nasa.gov/api/area ; https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-viirs-omps-what-firms-users-need-know
