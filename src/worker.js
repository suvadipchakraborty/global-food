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
 *   GET /api/country?code=IT   -> REST Countries (no key required, but
 *                                  proxied for a single consistent origin,
 *                                  CORS-free requests, and edge caching)
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
const RECIPE_CACHE_SECONDS = 60 * 60 * 12; // 12 hours
const COUNTRY_CACHE_SECONDS = 60 * 60 * 24 * 7; // 7 days (country facts barely change)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/country") {
      return withEdgeCache(request, ctx, COUNTRY_CACHE_SECONDS, () => handleCountry(url));
    }

    if (url.pathname === "/api/recipe") {
      return withEdgeCache(request, ctx, RECIPE_CACHE_SECONDS, () => handleRecipe(url, env));
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
/* REST Countries                                                        */
/* -------------------------------------------------------------------- */

async function handleCountry(url) {
  const code = (url.searchParams.get("code") || "").trim();
  if (!/^[A-Za-z]{2,3}$/.test(code)) {
    return jsonError("Provide a valid ISO country code, e.g. ?code=IT", 400);
  }

  const fields = "name,capital,region,subregion,population,languages,flags";
  const upstream = `https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}?fields=${fields}`;

  let res;
  try {
    res = await fetch(upstream, { headers: { accept: "application/json" } });
  } catch (e) {
    return jsonError("Could not reach the country data service.", 502);
  }

  if (!res.ok) {
    return jsonError(`Country lookup failed (${res.status}).`, res.status === 404 ? 404 : 502);
  }

  const raw = await res.json();
  const data = Array.isArray(raw) ? raw[0] : raw;
  if (!data) return jsonError("No country data found for that code.", 404);

  const shaped = {
    name: data.name?.common || code,
    capital: Array.isArray(data.capital) ? data.capital[0] : data.capital,
    region: data.region,
    subregion: data.subregion,
    population: data.population,
    languages: data.languages ? Object.values(data.languages).join(", ") : null,
    flag: data.flags?.png || data.flags?.svg,
  };

  return new Response(JSON.stringify(shaped), { status: 200, headers: JSON_HEADERS });
}

/* -------------------------------------------------------------------- */
/* Spoonacular                                                           */
/* -------------------------------------------------------------------- */

async function handleRecipe(url, env) {
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

  const searchUrl = new URL("https://api.spoonacular.com/recipes/complexSearch");
  searchUrl.searchParams.set("cuisine", cuisine);
  searchUrl.searchParams.set("sort", "random");
  searchUrl.searchParams.set("number", "1");
  searchUrl.searchParams.set("addRecipeInformation", "true");
  searchUrl.searchParams.set("instructionsRequired", "true");
  searchUrl.searchParams.set("apiKey", apiKey);

  let res;
  try {
    res = await fetch(searchUrl.toString());
  } catch (e) {
    return jsonError("Could not reach the recipe service.", 502);
  }

  if (!res.ok) {
    // Spoonacular returns 402 when the daily quota is exhausted — surface
    // that plainly instead of a generic failure.
    const message = res.status === 402
      ? "The recipe service's daily quota has been used up. Try again after it resets."
      : `Recipe lookup failed (${res.status}).`;
    return jsonError(message, res.status === 402 ? 429 : 502);
  }

  const data = await res.json();
  const recipe = data.results && data.results[0];
  if (!recipe) {
    return jsonError(`No ${cuisine} recipe found right now.`, 404);
  }

  const shaped = {
    title: recipe.title,
    image: recipe.image,
    readyInMinutes: recipe.readyInMinutes,
    servings: recipe.servings,
    sourceUrl: recipe.sourceUrl,
    summary: recipe.summary,
  };

  return new Response(JSON.stringify(shaped), { status: 200, headers: JSON_HEADERS });
}

/* -------------------------------------------------------------------- */

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS });
}
