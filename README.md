# Culinary Geography Explorer

Tap a country on the atlas. Meet its people — population, capital, languages —
then sit down to a real, highly-rated recipe from its kitchen. Mobile-first,
installable as a home-screen app, and built to deploy straight to Cloudflare.

## Stack

- **Frontend:** vanilla HTML/CSS/JS, no build step, no framework — `public/`
- **Backend:** a single Cloudflare Worker (`src/worker.js`) that serves the
  static site and proxies two APIs so no key ever reaches the browser:
  - [REST Countries](https://restcountries.com/) for demographics (optional key; built-in data is used without one)
  - [Spoonacular](https://spoonacular.com/food-api) for recipes (needs a free key)
- **PWA:** `manifest.webmanifest` + `sw.js` so it can be added to a phone's
  home screen and opens offline-tolerant.

## Project structure

```
├── public/                  # everything served to the browser
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── css/styles.css
│   ├── js/app.js
│   └── assets/               # icons + og-image.svg
├── src/
│   └── worker.js             # Cloudflare Worker: static assets + /api/* proxy
├── wrangler.toml
└── README.md
```

## 1. Get a Spoonacular API key

Sign up for a free key at https://spoonacular.com/food-api. The free tier's
daily quota is small, which is why the Worker edge-caches recipe responses
for 12 hours per cuisine (see `RECIPE_CACHE_SECONDS` in `src/worker.js`).

## 2. Local setup

```bash
npm install -g wrangler   # if you don't already have it
wrangler login
```

Set the secret locally for `wrangler dev` (this writes to `.dev.vars`, which
is git-ignored — never commit real keys):

```bash
echo "SPOONACULAR_API_KEY=your_key_here" > .dev.vars
wrangler dev
```

## 3. Deploy

### Option A — GitHub sync (recommended, matches this brief)

1. Push this project to a GitHub repo.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Connect to Git**,
   pick the repo. Cloudflare reads `wrangler.toml` automatically.
3. Add the secret in **Settings → Variables and Secrets** on the Worker (as
   an encrypted secret, not a plaintext var): `SPOONACULAR_API_KEY`.
4. Every push to your main branch redeploys automatically.

### Option B — CLI

```bash
wrangler secret put SPOONACULAR_API_KEY
wrangler deploy
```

## Where things live in the code

- **Where to put the API key:** `src/worker.js`, in `handleRecipe()` — look
  for the comment block starting `🔑 INJECT YOUR API KEY HERE`. It's read
  from `env.SPOONACULAR_API_KEY`, which only exists because of the
  `wrangler secret put` step above — it is never written into any file.
- **The curated country list** (which countries appear on the map, and which
  Spoonacular `cuisine` each maps to): top of `public/js/app.js`, the
  `COUNTRIES` array. Add a row to add a waypoint.
- **The map projection:** also in `app.js` — a plain equirectangular
  lat/lng → SVG x/y conversion, no map library required.
- **Design tokens** (colors, type, spacing): top of `public/css/styles.css`.

## Notes on the two APIs

- REST Countries needs no key and has generous CORS, but is still proxied
  through the Worker for one consistent origin and a shared edge cache.
- Spoonacular calls cost quota points per request; the Worker caches each
  `(cuisine)` result for 12 hours using the Cache API, so repeated taps on
  the same cuisine within that window don't spend quota again.

## Customizing the branding

- Replace `og:url` / `og:image` in `index.html` and the share URL in
  `app.js` if you deploy to a different subdomain than
  `https://global-food.suvadipchakraborty.workers.dev`.
- Icons and the Open Graph placeholder live in `public/assets/` — swap them
  for your own art whenever you like; sizes are documented in
  `manifest.webmanifest`.
