# IoT-Based Environmental Monitoring System using ESP32, DHT22 and Wi-Fi

The AeroNex web dashboard is a small college practical demonstration for an ESP32 and DHT22 environmental monitoring system.

## Hardware

- ESP32
- DHT22 temperature and humidity sensor

| DHT22 | ESP32 |
| --- | --- |
| VCC | 3V3 |
| DATA | GPIO 15 |
| GND | GND |

## Dashboard

The interface is built with HTML, CSS, and JavaScript. It contains Dashboard, Live Monitoring, Alerts, History, and System Information sections. Simulated readings update every three seconds, move gradually between 22–27 °C and 35–50% humidity, and are shared by the cards, charts, alerts, and history.

Recent history (maximum 500 readings) is stored in browser `localStorage` and synchronized with Supabase when configured. If Supabase is unavailable, local monitoring and history remain available. Use Pause/Resume to stop or continue sampling, Clear History to remove local saved samples, and Export CSV to download the current history.

## Run

The app uses Vite to load the browser-safe Supabase settings and installed client library. From the project directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Put the Supabase project URL and publishable key in the root `.env` file. Run `supabase/schema.sql` in the Supabase SQL Editor before testing cloud storage. Do not put a service-role or secret key in `.env` or frontend code.

Use `npm run build` to create a production build and `npm run preview` to serve it locally. Chart.js is loaded from its CDN; simple SVG charts are used if it is unavailable.

## Simulation limitation

The dashboard runs in Simulation Mode. It does not receive live readings from the Wokwi ESP32 through the Public Gateway. The displayed `10.10.0.2` address is an example/simulated Wokwi IP, not the user's physical network IP. TCP/IP and HTTP are shown as the project's networking concepts; no dashboard-to-device API is active.

## Files

- `index.html` — page structure and project information
- `css/style.css` — responsive light/dark styling
- `js/app.js` — navigation, rendering, and controls
- `js/sensorService.js` — sensor simulation and shared status thresholds
- `js/charts.js` — temperature and humidity charts
- `js/alerts.js` — current sensor status table and short messages
- `js/history.js` — localStorage and CSV export
- `js/supabase.js` — Supabase client and weather-reading queries
- `supabase/schema.sql` — table, grants, and row-level security policies
- `LAB_MANUAL_CONTENT.txt` — practical write-up content

The sensor service is designed to be replaced by a real API later without restructuring the dashboard logic.
