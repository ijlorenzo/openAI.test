# Macro Log

A simple, beautiful macro and meal tracker in the spirit of Carbon Diet Coach. It is a Progressive Web App: open it in Safari, add it to your Home Screen, and it runs full-screen on iPhone, works offline, and keeps all data on your device.

<p align="center"><img src="docs/today-dark.png" width="280" alt="Today screen, dark mode"> <img src="docs/trends.png" width="280" alt="Trends screen"></p>

## What it does

- **Onboarding** estimates your maintenance calories (Mifflin–St Jeor × activity) and sets calorie and macro targets for your goal and pace.
- **Today** shows a calorie ring, protein/carb/fat bars, and your meals (breakfast, lunch, dinner, snacks). Swipe through days with the arrows.
- **Logging** from a bundled database of ~150 common foods, your recent foods, custom foods you create, or a quick macro entry. Adjust servings with a stepper or type a decimal.
- **Weight trend** with a smoothed trend line over 30/90/all days.
- **Weekly check-in** compares this week's average weight with last week's and nudges calories (max ±150 kcal per week) so your real pace matches your target. Protein stays fixed; carbs and fat are re-split.
- **Settings** for targets, profile, units (lb/kg), light/dark/auto theme, and JSON export/import.

## Run it locally

```bash
npm start          # serves on http://localhost:8080
npm test           # nutrition math tests (node:test, no dependencies)
```

Any static file server works. There is no build step.

## Put it on your iPhone

1. Host the folder somewhere over HTTPS. The included GitHub Pages workflow does this: in the repository settings, set **Pages → Source** to **GitHub Actions**, then push to `main`.
2. On your iPhone, open the URL in **Safari**.
3. Tap **Share → Add to Home Screen**.

The app launches full-screen with its own icon, and the service worker keeps it working without a connection.

## Project layout

```
index.html              shell
styles.css              design tokens, light + dark themes, components
manifest.webmanifest    PWA manifest
sw.js                   offline cache (bump CACHE when you ship changes)
src/app.js              views, sheets, events
src/nutrition.js        pure math: BMR/TDEE, macro split, trend, weekly check-in
src/foods.js            bundled food database + search
src/store.js            localStorage persistence, import/export
tests/                  node:test suite for nutrition.js
tools/make-icons.py     regenerates icons/ (needs Pillow)
```

## Notes

- Data lives in `localStorage` under `macrolog.v1`. Export a backup from Settings before clearing Safari data.
- Food values are typical label/USDA figures for everyday logging, not a clinical database.
- Not medical advice.
