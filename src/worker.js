/**
 * Culinary Geography Explorer — Cloudflare Worker
 * ------------------------------------------------
 * Responsibilities:
 *   1. Serve the static frontend from /public (via the ASSETS binding
 *      configured in wrangler.toml).
 *   2. Proxy the two third-party APIs the frontend needs, so the
 *      Spoonacular API key never ships to the browser.
 *
 * Routes handled here:
 *   GET /api/country?code=IT   -> REST Countries v5 (needs a key — see
 *                                  RESTCOUNTRIES_API_KEY below — proxied
 *                                  so it never ships to the browser, for a
 *                                  single consistent origin, CORS-free
 *                                  requests, and edge caching)
 *   GET /api/recipe?cuisine=Italian
 *                               -> Spoonacular complexSearch, enriched
 *                                  with recipe information (needs a key)
 *
 * Everything else falls through to env.ASSETS (the static site).
 */

const JSON_HEADERS = { "content-type": "application/json; charset=UTF-8" };

// How long the edge cache keeps a response before re-checking upstream.
// Spoonacular's free tier has a small daily point budget, so caching
// aggressively here matters a lot in practice.
const RECIPE_CACHE_SECONDS = 60 * 60 * 12; // 12 hours (how long a cuisine's recipe pool is kept)
const RECIPE_POOL_SIZE = 10;
const RECIPE_MAX_OFFSET = 40; // random start position within the popularity-ranked results
const COUNTRY_CACHE_SECONDS = 60 * 60 * 24 * 7; // 7 days (country facts barely change)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/country") {
      return withEdgeCache(request, ctx, COUNTRY_CACHE_SECONDS, () => handleCountry(url, env));
    }

    if (url.pathname === "/api/recipe") {
      // Not edge-cached as a whole response: the pool of recipes is cached
      // inside handleRecipe and a fresh one is picked on every request.
      return handleRecipe(url, env, ctx);
    }

    if (url.pathname.startsWith("/api/")) {
      return jsonError("Unknown API route.", 404);
    }

    // Static assets (HTML/CSS/JS/manifest/icons) live in ./public and are
    // served by the Workers Assets binding declared in wrangler.toml.
    return env.ASSETS.fetch(request);
  },
};

/* -------------------------------------------------------------------- */
/* Edge caching helper                                                   */
/* -------------------------------------------------------------------- */

async function withEdgeCache(request, ctx, maxAgeSeconds, handler) {
  // Only GET requests are cacheable; anything else just runs directly.
  if (request.method !== "GET") return handler();

  const cache = caches.default;
  const cacheKey = new Request(request.url, request);

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const response = await handler();
  if (response.status === 200) {
    const cacheable = new Response(response.body, response);
    cacheable.headers.set("Cache-Control", `public, max-age=${maxAgeSeconds}`);
    ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
    return cacheable;
  }
  return response;
}

/* -------------------------------------------------------------------- */
/* Built-in country facts (used when no real REST Countries key is set)  */
/* -------------------------------------------------------------------- */

// The REST Countries demo key (rc_live_demo) ignores which country you ask
// for and always returns a Canada sample, so it can't power this app. These
// are approximate figures for the 25 waypoints on the map; they are served
// whenever a real key isn't configured or the live lookup doesn't match.
const FALLBACK_COUNTRIES = {
  IT: { name: "Italy", capital: "Rome", region: "Europe", subregion: "Southern Europe", population: 59000000, languages: "Italian" },
  FR: { name: "France", capital: "Paris", region: "Europe", subregion: "Western Europe", population: 68400000, languages: "French" },
  ES: { name: "Spain", capital: "Madrid", region: "Europe", subregion: "Southern Europe", population: 48600000, languages: "Spanish" },
  GR: { name: "Greece", capital: "Athens", region: "Europe", subregion: "Southern Europe", population: 10400000, languages: "Greek" },
  DE: { name: "Germany", capital: "Berlin", region: "Europe", subregion: "Western Europe", population: 84500000, languages: "German" },
  GB: { name: "United Kingdom", capital: "London", region: "Europe", subregion: "Northern Europe", population: 69300000, languages: "English" },
  IE: { name: "Ireland", capital: "Dublin", region: "Europe", subregion: "Northern Europe", population: 5300000, languages: "Irish, English" },
  SE: { name: "Sweden", capital: "Stockholm", region: "Europe", subregion: "Northern Europe", population: 10500000, languages: "Swedish" },
  PL: { name: "Poland", capital: "Warsaw", region: "Europe", subregion: "Central Europe", population: 36600000, languages: "Polish" },
  CY: { name: "Cyprus", capital: "Nicosia", region: "Europe", subregion: "Southern Europe", population: 1300000, languages: "Greek, Turkish" },
  IL: { name: "Israel", capital: "Jerusalem", region: "Asia", subregion: "Western Asia", population: 9800000, languages: "Hebrew, Arabic" },
  LB: { name: "Lebanon", capital: "Beirut", region: "Asia", subregion: "Western Asia", population: 5800000, languages: "Arabic" },
  MA: { name: "Morocco", capital: "Rabat", region: "Africa", subregion: "Northern Africa", population: 37800000, languages: "Arabic, Berber" },
  NG: { name: "Nigeria", capital: "Abuja", region: "Africa", subregion: "Western Africa", population: 223800000, languages: "English" },
  MX: { name: "Mexico", capital: "Mexico City", region: "Americas", subregion: "North America", population: 128500000, languages: "Spanish" },
  US: { name: "United States", capital: "Washington, D.C.", region: "Americas", subregion: "North America", population: 340000000, languages: "English" },
  JM: { name: "Jamaica", capital: "Kingston", region: "Americas", subregion: "Caribbean", population: 2800000, languages: "English" },
  PE: { name: "Peru", capital: "Lima", region: "Americas", subregion: "South America", population: 34400000, languages: "Spanish, Quechua, Aymara" },
  BR: { name: "Brazil", capital: "Brasília", region: "Americas", subregion: "South America", population: 211000000, languages: "Portuguese" },
  CN: { name: "China", capital: "Beijing", region: "Asia", subregion: "Eastern Asia", population: 1410000000, languages: "Mandarin" },
  JP: { name: "Japan", capital: "Tokyo", region: "Asia", subregion: "Eastern Asia", population: 123600000, languages: "Japanese" },
  KR: { name: "South Korea", capital: "Seoul", region: "Asia", subregion: "Eastern Asia", population: 51700000, languages: "Korean" },
  TH: { name: "Thailand", capital: "Bangkok", region: "Asia", subregion: "South-Eastern Asia", population: 71800000, languages: "Thai" },
  VN: { name: "Vietnam", capital: "Hanoi", region: "Asia", subregion: "South-Eastern Asia", population: 100300000, languages: "Vietnamese" },
  IN: { name: "India", capital: "New Delhi", region: "Asia", subregion: "Southern Asia", population: 1430000000, languages: "Hindi, English" },
};

function fallbackCountry(code) {
  const c = code.toUpperCase();
  const f = FALLBACK_COUNTRIES[c];
  if (!f) return null;
  return { ...f, flag: `https://flagcdn.com/w160/${c.toLowerCase()}.png` };
}

/* -------------------------------------------------------------------- */
/* REST Countries                                                        */
/* -------------------------------------------------------------------- */

// REST Countries retired v1–v4 (including the v3.1 endpoint this used to
// call) in favor of v5 at a new host, api.restcountries.com. v5 needs an
// Authorization: Bearer key on every request and returns a differently
// shaped payload (data.objects[], with nested names.common / capitals[] /
// flag.url_png instead of the old flat name.common / capital[] / flags.png).
//
// 🔑 For reliable production use, get a free key at https://restcountries.com/sign-up
// and run:  wrangler secret put RESTCOUNTRIES_API_KEY
// Without one, built-in country facts are served. The demo key (rc_live_demo)
// is deliberately NOT used: it returns a Canada sample for every request.
async function handleCountry(url, env) {
  const code = (url.searchParams.get("code") || "").trim();
  if (!/^[A-Za-z]{2,3}$/.test(code)) {
    return jsonError("Provide a valid ISO country code, e.g. ?code=IT", 400);
  }

  const ok = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: JSON_HEADERS });

  // No real key configured -> the demo key would return Canada for every
  // country, so serve the built-in facts instead.
  const apiKey = env?.RESTCOUNTRIES_API_KEY;
  if (!apiKey) {
    const local = fallbackCountry(code);
    return local ? ok(local) : jsonError("No data for that country code.", 404);
  }

  const property = code.length === 2 ? "codes.alpha_2" : "codes.alpha_3";
  const fields = "codes.alpha_2,codes.alpha_3,names.common,capitals,region,subregion,population,languages,flag.url_png,flag.url_svg";
  const upstream = `https://api.restcountries.com/countries/v5/${property}/${encodeURIComponent(code.toUpperCase())}?response_fields=${fields}`;

  try {
    const res = await fetch(upstream, {
      headers: { accept: "application/json", authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const raw = await res.json();
      const data = raw?.data?.objects?.[0];
      const returned = (property === "codes.alpha_2" ? data?.codes?.alpha_2 : data?.codes?.alpha_3) || "";
      // Reject demo samples and any record that isn't the country we asked for.
      if (data && !raw?.data?._demo && returned.toUpperCase() === code.toUpperCase()) {
        return ok({
          name: data.names?.common || code,
          capital: data.capitals?.[0]?.name,
          region: data.region,
          subregion: data.subregion,
          population: data.population,
          languages: Array.isArray(data.languages)
            ? data.languages.map((l) => l.name || l.english_name || l.common || l.native_name).filter(Boolean).join(", ")
            : null,
          flag: data.flag?.url_png || data.flag?.url_svg,
        });
      }
    }
  } catch (e) {
    /* fall through to built-in data */
  }

  const local = fallbackCountry(code);
  return local ? ok(local) : jsonError("Could not load data for that country.", 502);
}

/* -------------------------------------------------------------------- */
/* Spoonacular                                                           */
/* -------------------------------------------------------------------- */

async function handleRecipe(url, env, ctx) {
  const cuisine = (url.searchParams.get("cuisine") || "").trim();
  if (!cuisine) {
    return jsonError("Provide a cuisine, e.g. ?cuisine=Italian", 400);
  }

  // -----------------------------------------------------------------
  // 🔑 INJECT YOUR API KEY HERE (as a Cloudflare secret, never in code):
  //     wrangler secret put SPOONACULAR_API_KEY
  // Then it becomes available as env.SPOONACULAR_API_KEY at runtime.
  // Get a free key at https://spoonacular.com/food-api
  // -----------------------------------------------------------------
  const apiKey = env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return jsonError(
      "Spoonacular API key is not configured on the server. Run: wrangler secret put SPOONACULAR_API_KEY",
      500
    );
  }

  // The pool (several well-liked recipes for this cuisine) is fetched once
  // and cached; each request then picks a different random recipe from it.
  // That keeps Spoonacular usage low while the person still sees variety.
  const cache = caches.default;
  const poolKey = new Request(`${url.origin}/__recipe-pool?cuisine=${encodeURIComponent(cuisine.toLowerCase())}`);

  let pool = null;
  const cached = await cache.match(poolKey);
  if (cached) {
    try { pool = await cached.json(); } catch (e) { pool = null; }
  }

  if (!Array.isArray(pool) || !pool.length) {
    const fetched = await fetchRecipePool(cuisine, apiKey);
    if (fetched.error) return fetched.error;
    pool = fetched.pool;

    const toCache = new Response(JSON.stringify(pool), {
      headers: { ...JSON_HEADERS, "Cache-Control": `public, max-age=${RECIPE_CACHE_SECONDS}` },
    });
    ctx.waitUntil(cache.put(poolKey, toCache));
  }

  const recipe = pool[Math.floor(Math.random() * pool.length)];

  // no-store so the browser asks again (and gets a different recipe) next time.
  return new Response(JSON.stringify(recipe), {
    status: 200,
    headers: { ...JSON_HEADERS, "Cache-Control": "no-store" },
  });
}

async function searchSpoonacular(cuisine, apiKey, offset) {
  const searchUrl = new URL("https://api.spoonacular.com/recipes/complexSearch");
  searchUrl.searchParams.set("cuisine", cuisine);
  // Popularity ranks well-liked recipes first, so a random *offset* gives
  // variety without drifting into obscure or poorly-rated ones.
  searchUrl.searchParams.set("sort", "popularity");
  searchUrl.searchParams.set("sortDirection", "desc");
  searchUrl.searchParams.set("offset", String(offset));
  searchUrl.searchParams.set("number", String(RECIPE_POOL_SIZE));
  searchUrl.searchParams.set("addRecipeInformation", "true");
  searchUrl.searchParams.set("instructionsRequired", "true");
  searchUrl.searchParams.set("apiKey", apiKey);
  return fetch(searchUrl.toString());
}

async function fetchRecipePool(cuisine, apiKey) {
  const randomOffset = Math.floor(Math.random() * (RECIPE_MAX_OFFSET + 1));
  let results = [];

  // Try a random offset first; if the cuisine has fewer results than that
  // (offset past the end), fall back to the top of the list.
  for (const offset of [randomOffset, 0]) {
    let res;
    try {
      res = await searchSpoonacular(cuisine, apiKey, offset);
    } catch (e) {
      return { error: jsonError("Could not reach the recipe service.", 502) };
    }

    if (!res.ok) {
      // Spoonacular returns 402 when the daily quota is exhausted — surface
      // that plainly instead of a generic failure.
      const message = res.status === 402
        ? "The recipe service's daily quota has been used up. Try again after it resets."
        : `Recipe lookup failed (${res.status}).`;
      return { error: jsonError(message, res.status === 402 ? 429 : 502) };
    }

    const data = await res.json();
    results = (data.results || []).filter((r) => r && r.title && r.image && r.sourceUrl);
    if (results.length) break;
    if (offset === 0) break;
  }

  if (!results.length) {
    return { error: jsonError(`No ${cuisine} recipe found right now.`, 404) };
  }

  const pool = results.map((r) => ({
    title: r.title,
    image: r.image,
    readyInMinutes: r.readyInMinutes,
    servings: r.servings,
    sourceUrl: r.sourceUrl,
    summary: r.summary,
  }));
  return { pool };
}

/* -------------------------------------------------------------------- */

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS });
}
