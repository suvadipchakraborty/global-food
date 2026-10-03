/* ==========================================================================
   Culinary Geography Explorer — app.js
   Vanilla JS. No build step, no frameworks.
   ========================================================================== */

(() => {
  "use strict";

  /* ------------------------------------------------------------------
     1. Curated waypoints
     Each maps a real country to a Spoonacular `cuisine` value so the
     Worker can ask for an authentic, highly-rated recipe from that
     region. Coordinates are each country's capital (lat, lng).
     ------------------------------------------------------------------ */
  const COUNTRIES = [
    { code: "IT", name: "Italy",          cuisine: "Italian",          lat: 41.90, lng: 12.50 },
    { code: "FR", name: "France",         cuisine: "French",           lat: 48.85, lng: 2.35 },
    { code: "ES", name: "Spain",          cuisine: "Spanish",          lat: 40.42, lng: -3.70 },
    { code: "GR", name: "Greece",         cuisine: "Greek",            lat: 37.98, lng: 23.73 },
    { code: "DE", name: "Germany",        cuisine: "German",           lat: 52.52, lng: 13.40 },
    { code: "GB", name: "United Kingdom", cuisine: "British",          lat: 51.50, lng: -0.12 },
    { code: "IE", name: "Ireland",        cuisine: "Irish",            lat: 53.35, lng: -6.26 },
    { code: "SE", name: "Sweden",         cuisine: "Nordic",           lat: 59.33, lng: 18.06 },
    { code: "PL", name: "Poland",         cuisine: "Eastern European", lat: 52.23, lng: 21.01 },
    { code: "CY", name: "Cyprus",         cuisine: "Mediterranean",    lat: 35.13, lng: 33.43 },
    { code: "IL", name: "Israel",         cuisine: "Jewish",           lat: 31.77, lng: 35.21 },
    { code: "LB", name: "Lebanon",        cuisine: "Middle Eastern",   lat: 33.89, lng: 35.50 },
    { code: "MA", name: "Morocco",        cuisine: "African",          lat: 31.63, lng: -8.00 },
    { code: "NG", name: "Nigeria",        cuisine: "African",          lat: 9.08,  lng: 8.68 },
    { code: "MX", name: "Mexico",         cuisine: "Mexican",          lat: 19.43, lng: -99.13 },
    { code: "US", name: "United States",  cuisine: "American",         lat: 38.90, lng: -77.03 },
    { code: "JM", name: "Jamaica",        cuisine: "Caribbean",        lat: 17.97, lng: -76.79 },
    { code: "PE", name: "Peru",           cuisine: "Latin American",   lat: -12.05,lng: -77.03 },
    { code: "BR", name: "Brazil",         cuisine: "Latin American",   lat: -15.79,lng: -47.88 },
    { code: "CN", name: "China",          cuisine: "Chinese",          lat: 39.90, lng: 116.40 },
    { code: "JP", name: "Japan",          cuisine: "Japanese",         lat: 35.68, lng: 139.76 },
    { code: "KR", name: "South Korea",    cuisine: "Korean",           lat: 37.57, lng: 126.98 },
    { code: "TH", name: "Thailand",       cuisine: "Thai",             lat: 13.75, lng: 100.50 },
    { code: "VN", name: "Vietnam",        cuisine: "Vietnamese",       lat: 21.03, lng: 105.85 },
    { code: "IN", name: "India",          cuisine: "Indian",           lat: 28.60, lng: 77.20 },
  ];

  const VB_W = 360, VB_H = 220;
  const project = (lat, lng) => ({
    x: lng + 180,
    y: (90 - lat) / 180 * VB_H,
  });

  const SVG_NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  };

  /* ------------------------------------------------------------------
     1b. Landmasses — stylized, low-detail continent silhouettes so the
     atlas reads as a map instead of a blank grid of dots. Points are
     [lng, lat] and run through the same project() used for markers, so
     coastlines and waypoints always stay perfectly aligned. Simplified
     on purpose (a dozen-odd points per shape) — recognizable silhouettes,
     not survey-grade coastlines.
     ------------------------------------------------------------------ */
  const LANDMASSES = [
    { name: "North America", points: [
      [-165,68],[-155,71],[-130,70],[-95,73],[-80,73],[-65,68],[-60,60],[-55,52],
      [-65,45],[-70,41],[-75,35],[-81,31],[-80,25],[-83,10],[-92,14],[-97,16],
      [-105,21],[-110,24],[-115,30],[-124,40],[-124,48],[-130,55],[-140,60],[-150,60],[-165,68],
    ] },
    { name: "Greenland", points: [
      [-45,60],[-38,65],[-25,70],[-20,77],[-35,83],[-55,82],[-65,76],[-68,70],[-60,65],[-50,60],[-45,60],
    ] },
    { name: "South America", points: [
      [-77,8],[-71,11],[-60,10],[-51,4],[-35,-5],[-38,-13],[-40,-20],[-48,-25],
      [-58,-34],[-62,-40],[-68,-52],[-72,-53],[-75,-45],[-71,-30],[-71,-18],[-70,-5],[-77,8],
    ] },
    { name: "Europe", points: [
      [-9,38],[-5,43],[2,43],[7,44],[13,38],[18,40],[23,36],[27,40],[30,46],
      [38,47],[40,55],[30,60],[25,65],[15,68],[5,62],[-2,58],[-5,50],[-9,43],[-9,38],
    ] },
    { name: "United Kingdom & Ireland", points: [
      [-5,50],[-3,51],[1,53],[0,56],[-3,58],[-6,58],[-8,55],[-6,51],[-5,50],
    ] },
    { name: "Africa", points: [
      [-17,15],[-16,21],[-10,32],[-5,36],[10,37],[20,33],[32,31],[35,27],[43,12],
      [51,12],[45,2],[40,-15],[35,-25],[27,-33],[18,-34],[13,-27],[12,-17],[9,4],[-5,5],[-10,7],[-17,15],
    ] },
    { name: "Asia", points: [
      [30,45],[35,42],[35,30],[40,25],[48,29],[50,25],[57,25],[60,25],[68,24],
      [72,20],[77,8],[80,7],[93,16],[98,8],[104,1],[109,2],[117,5],[120,15],
      [122,25],[130,33],[130,40],[140,42],[145,43],[142,55],[135,60],[125,65],
      [110,72],[95,75],[75,73],[60,70],[45,66],[40,60],[35,55],[30,50],[30,45],
    ] },
    { name: "Japan", points: [
      [130,32],[132,34],[140,36],[142,40],[141,45],[139,42],[135,37],[130,34],[130,32],
    ] },
    { name: "Australia", points: [
      [113,-22],[122,-18],[130,-12],[137,-12],[142,-11],[145,-17],[148,-20],[153,-28],
      [150,-34],[147,-38],[140,-38],[136,-35],[132,-32],[125,-34],[115,-34],[113,-26],[113,-22],
    ] },
  ];

  /* ------------------------------------------------------------------
     2. State
     ------------------------------------------------------------------ */
  let activeCode = null;
  let lastVisitedPos = null;
  const markerNodes = new Map();

  /* ------------------------------------------------------------------
     3. Atlas rendering
     ------------------------------------------------------------------ */
  const atlasSvg = document.getElementById("atlasSvg");
  const atlasHint = document.getElementById("atlasHint");

  function buildAtlas() {
    atlasHint.textContent = `${COUNTRIES.length} waypoints`;

    // graticule
    const gratGroup = el("g", { class: "graticule" });
    for (let x = 0; x <= VB_W; x += 30) {
      gratGroup.appendChild(el("line", { class: "grat-line", x1: x, y1: 0, x2: x, y2: VB_H }));
    }
    for (let y = 0; y <= VB_H; y += (VB_H / 6)) {
      const isEquator = Math.abs(y - VB_H / 2) < 1;
      gratGroup.appendChild(el("line", {
        class: isEquator ? "grat-line grat-line--equator" : "grat-line",
        x1: 0, y1: y, x2: VB_W, y2: y,
      }));
    }
    atlasSvg.appendChild(gratGroup);

    // landmasses (drawn under the route line and markers, above the graticule)
    const landGroup = el("g", { class: "landmasses" });
    LANDMASSES.forEach((mass) => {
      const d = mass.points
        .map(([lng, lat], i) => {
          const { x, y } = project(lat, lng);
          return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ") + " Z";
      landGroup.appendChild(el("path", { class: "landmass", d, "aria-hidden": "true" }));
    });
    atlasSvg.appendChild(landGroup);

    // route line (drawn under markers, updated on each visit)
    const routePath = el("path", { class: "route-line", id: "routeLine", d: "" });
    atlasSvg.appendChild(routePath);

    // markers
    COUNTRIES.forEach((c) => {
      const { x, y } = project(c.lat, c.lng);
      const g = el("g", {
        class: "marker",
        tabindex: "0",
        role: "button",
        "aria-label": `${c.name} — view demographics and a ${c.cuisine} recipe`,
        transform: `translate(${x} ${y})`,
      });
      g.appendChild(el("circle", { class: "marker__hit", r: 9 }));
      g.appendChild(el("circle", { class: "marker__pulse", r: 3 }));
      g.appendChild(el("circle", { class: "marker__dot", r: 3.4 }));

      const activate = () => {
        haptic();
        selectCountry(c, { x, y });
      };
      g.addEventListener("click", activate);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
      });

      atlasSvg.appendChild(g);
      markerNodes.set(c.code, g);
    });
  }

  function updateRoute(toPos) {
    const routePath = document.getElementById("routeLine");
    if (!lastVisitedPos) { lastVisitedPos = toPos; return; }
    const midX = (lastVisitedPos.x + toPos.x) / 2;
    const midY = Math.min(lastVisitedPos.y, toPos.y) - 18;
    const d = `M ${lastVisitedPos.x} ${lastVisitedPos.y} Q ${midX} ${midY} ${toPos.x} ${toPos.y}`;
    routePath.setAttribute("d", d);
    routePath.classList.remove("is-visible");
    // force reflow so the transition re-triggers
    void routePath.getBoundingClientRect();
    routePath.classList.add("is-visible");
    lastVisitedPos = toPos;
  }

  function setActiveMarker(code) {
    markerNodes.forEach((node, c) => {
      node.classList.remove("is-active");
      if (c === code) {
        node.classList.add("is-active");
        node.classList.add("is-visited");
      }
    });
  }

  /* ------------------------------------------------------------------
     4. Bottom sheet
     ------------------------------------------------------------------ */
  const sheet = document.getElementById("sheet");
  const sheetScrim = document.getElementById("sheetScrim");
  const sheetContent = document.getElementById("sheetContent");
  const sheetClose = document.getElementById("sheetClose");

  function openSheet() {
    sheet.classList.add("is-open");
    sheetScrim.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeSheet() {
    sheet.classList.remove("is-open");
    sheetScrim.classList.remove("is-open");
    document.body.style.overflow = "";
    setActiveMarker(null);
  }
  sheetClose.addEventListener("click", closeSheet);
  sheetScrim.addEventListener("click", closeSheet);

  function skeletonMarkup() {
    return `
      <div class="sheet__head">
        <div class="skeleton skel-flag"></div>
        <div style="flex:1">
          <div class="skeleton skel-line" style="width:60%;height:20px;"></div>
          <div class="skeleton skel-line" style="width:40%;"></div>
        </div>
      </div>
      <div class="stat-row">
        <div class="skeleton skel-line" style="height:52px;border-radius:10px;margin-top:0;"></div>
        <div class="skeleton skel-line" style="height:52px;border-radius:10px;margin-top:0;"></div>
        <div class="skeleton skel-line" style="height:52px;border-radius:10px;margin-top:0;"></div>
      </div>
      <div class="divider"></div>
      <div class="skeleton skel-recipe"></div>
    `;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[m]));
  }

  function stripHtml(str) {
    if (!str) return "";
    // DOMParser builds an inert document: no scripts run and no images load,
    // unlike setting innerHTML on a live element.
    const doc = new DOMParser().parseFromString(String(str), "text/html");
    return doc.body.textContent || "";
  }

  function formatPopulation(n) {
    if (!n && n !== 0) return "—";
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
    return String(n);
  }

  async function selectCountry(country, pos) {
    activeCode = country.code;
    setActiveMarker(country.code);
    updateRoute(pos);

    sheetContent.innerHTML = skeletonMarkup();
    openSheet();

    const [countryResult, recipeResult] = await Promise.allSettled([
      fetch(`/api/country?code=${encodeURIComponent(country.code)}&v=2`).then(assertOk),
      fetch(`/api/recipe?cuisine=${encodeURIComponent(country.cuisine)}`, { cache: "no-store" }).then(assertOk),
    ]);

    // Bail out silently if the person tapped a different marker while this was loading.
    if (activeCode !== country.code) return;

    renderSheet(country, countryResult, recipeResult);
  }

  async function assertOk(res) {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  function renderSheet(country, countryResult, recipeResult) {
    let html = "";

    // ---- country header + stats ----
    if (countryResult.status === "fulfilled") {
      const d = countryResult.value;
      html += `
        <div class="sheet__head">
          <img class="sheet__flag" src="${escapeHtml(d.flag || "")}" alt="Flag of ${escapeHtml(d.name)}" />
          <div>
            <h3 class="sheet__country" id="sheetCountryName">${escapeHtml(d.name)}</h3>
            <p class="sheet__region">${escapeHtml(d.region)}${d.subregion ? " · " + escapeHtml(d.subregion) : ""}</p>
          </div>
        </div>
        <div class="stat-row">
          <div class="stat-card">
            <div class="stat-card__value">${formatPopulation(d.population)}</div>
            <div class="stat-card__label">Population</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__value">${escapeHtml(d.capital || "—")}</div>
            <div class="stat-card__label">Capital</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__value" style="font-size:0.82rem;">${escapeHtml(d.languages || "—")}</div>
            <div class="stat-card__label">Spoken</div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="sheet__head">
          <div>
            <h3 class="sheet__country" id="sheetCountryName">${escapeHtml(country.name)}</h3>
            <p class="sheet__region">${escapeHtml(country.cuisine)} cuisine region</p>
          </div>
        </div>
        <div class="sheet__error">Couldn't reach the country registry just now. Population and language details are unavailable this time — try again in a moment.</div>
      `;
    }

    html += `<div class="divider"></div>`;

    // ---- recipe ----
    if (recipeResult.status === "fulfilled" && recipeResult.value && recipeResult.value.title) {
      const r = recipeResult.value;
      const summary = stripHtml(r.summary).split(". ").slice(0, 2).join(". ").trim();
      html += `
        <div class="recipe-card">
          <div class="recipe-card__media">
            ${r.image ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.title)}" loading="lazy" />` : ""}
            <span class="recipe-card__cuisine-tag">${escapeHtml(country.cuisine)}</span>
          </div>
          <div class="recipe-card__body">
            <h4 class="recipe-card__title">${escapeHtml(r.title)}</h4>
            <div class="recipe-card__meta">
              ${r.readyInMinutes ? `<span>${svgClock()} ${r.readyInMinutes} min</span>` : ""}
              ${r.servings ? `<span>${svgUsers()} Serves ${r.servings}</span>` : ""}
            </div>
            ${summary ? `<p class="recipe-card__summary">${escapeHtml(summary)}${summary.endsWith(".") ? "" : "."}</p>` : ""}
            <div class="recipe-card__actions">
              <a class="btn btn--primary" href="${escapeHtml(r.sourceUrl || "#")}" target="_blank" rel="noopener">
                ${svgBook()} Full recipe
              </a>
              <button class="btn btn--ghost" id="shareRecipeBtn">
                ${svgShare()} Share
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="sheet__error">No recipe came back for ${escapeHtml(country.cuisine)} cuisine this time — the kitchen might be between orders. Try this waypoint again shortly.</div>
      `;
    }

    sheetContent.innerHTML = html;

    const shareBtn = document.getElementById("shareRecipeBtn");
    if (shareBtn && recipeResult.status === "fulfilled") {
      shareBtn.addEventListener("click", () => {
        haptic();
        shareContent({
          title: recipeResult.value.title,
          text: `A ${country.cuisine} recipe from ${country.name}, found on Culinary Geography Explorer:`,
          url: recipeResult.value.sourceUrl || location.href,
        });
      });
    }
  }

  /* tiny inline icon helpers (kept out of the template literals above for readability) */
  function svgClock() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`; }
  function svgUsers() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"/><circle cx="9" cy="7" r="3.2"/><path d="M22 20v-1a3.8 3.8 0 0 0-2.7-3.6"/><path d="M16.2 3.4A3.8 3.8 0 0 1 18 10.6"/></svg>`; }
  function svgBook() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`; }
  function svgShare() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></svg>`; }

  /* ------------------------------------------------------------------
     5. Random country
     ------------------------------------------------------------------ */
  document.getElementById("randomBtn").addEventListener("click", () => {
    haptic();
    const pick = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    const pos = project(pick.lat, pick.lng);
    // gentle scroll so the atlas is in view
    document.querySelector(".atlas-wrap").scrollIntoView({ behavior: "smooth", block: "center" });
    selectCountry(pick, pos);
  });

  /* ------------------------------------------------------------------
     6. Sharing + feedback + toast
     ------------------------------------------------------------------ */
  const toastEl = document.getElementById("toast");
  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2200);
  }

  async function shareContent({ title, text, url }) {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); }
      catch (e) { /* user cancelled — no-op */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        showToast("Link copied — paste it anywhere");
      } catch (e) {
        showToast("Couldn't share automatically — copy the link manually");
      }
    }
  }

  document.getElementById("shareAppBtn").addEventListener("click", () => {
    haptic();
    shareContent({
      title: "Culinary Geography Explorer",
      text: "Tap a country, meet its people, cook its food:",
      url: "https://global-food.suvadipchakraborty.workers.dev",
    });
  });

  const FEEDBACK_HREF = "mailto:suvadipchakraborty@gmail.com?subject=" +
    encodeURIComponent("Culinary Geography Explorer — feedback") +
    "&body=" + encodeURIComponent("Hi Suva,\n\nHere's what I think of the app:\n\n");
  document.getElementById("feedbackLink").href = FEEDBACK_HREF;
  document.getElementById("feedbackLinkAbout").href = FEEDBACK_HREF;

  function haptic() {
    if (navigator.vibrate) navigator.vibrate(10);
  }

  /* ------------------------------------------------------------------
     7. Bottom nav / view switching
     ------------------------------------------------------------------ */
  const views = { home: document.getElementById("view-home"), about: document.getElementById("view-about") };
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view;
      if (btn.classList.contains("is-active")) return;
      haptic();
      document.querySelectorAll(".nav-btn").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.removeAttribute("aria-current");
      });
      btn.setAttribute("aria-current", "page");
      Object.entries(views).forEach(([key, node]) => node.classList.toggle("is-active", key === target));
      window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    });
  });

  /* ------------------------------------------------------------------
     8. Boot
     ------------------------------------------------------------------ */
  buildAtlas();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {/* offline shell is a bonus, not critical */});
    });
  }
})();
