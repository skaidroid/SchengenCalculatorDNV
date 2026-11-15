# Schengen 90/180 Calculator — Spain DNV edition

A small Vue 3 + Vite web app that calculates Schengen 90/180-day usage and **when you can re-enter**,
built for people who applied for Spain's **Digital Nomad Visa** from inside Spain and are allowed to stay
while the application is pending. Stays above 90 days are **tolerated**: they're counted and reported
(and split into days before / after your application date) instead of being rejected.

## Features
- Enter any number of stays (entry/exit; leave exit empty for an ongoing stay)
- Days used in the current 180-day window and days remaining (negative = overstay)
- Last legal day if you're inside and still within the limit
- Earliest re-entry date and how long you could stay then
- Earliest date for 7 / 14 / 30 / 60 / 90-day trips, plus a "check a specific entry date" tool
- Overstay summary relative to the DNV application date (flags applications filed after the limit was exceeded)
- Rolling day-count chart
- UGE response deadline: 20 business days from the application date (day 0), skipping weekends and national, Comunidad de Madrid and Madrid city holidays (applications submitted in 2026–2027; holidays in `src/uge.js`)
- Data stays in the browser (localStorage). Light & dark mode, mobile friendly.

## Develop
```bash
npm install
npm run dev     # http://localhost:5173
npm test        # unit tests for the calculation engine (src/schengen.js)
npm run build   # production build in dist/
```

## Deploy free on GitHub Pages
1. Create a GitHub repo and push this project to the `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs tests, builds and publishes on every push to `main`.
   Your site will be at `https://<your-username>.github.io/<repo-name>/`.

`vite.config.js` uses `base: './'`, so it works under any repo name without changes.

## Disclaimer
Not legal advice. Check with the Spanish authorities or an immigration lawyer before travelling.
