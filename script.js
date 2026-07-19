// script.js — public site behavior
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

import { db } from "./firebase.js";
import {
  collection, doc, onSnapshot, query, orderBy,
  updateDoc, increment, getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------------------------------------------------- */
/* Simple markdown → HTML (headings, bold, italic, links, lists, breaks)  */
/* ---------------------------------------------------------------------- */
function renderMarkdown(md = "") {
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.*$)/gim, "<li>$1</li>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br/>");
  html = html.replace(/(<li>.*?<\/li>)/gims, "<ul>$1</ul>");
  return `<p>${html}</p>`;
}

const fmtDate = (ts) => {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

/* ---------------------------------------------------------------------- */
/* Theme, nav, search overlay, music                                      */
/* ---------------------------------------------------------------------- */
const body = document.body;
const savedTheme = localStorage.getItem("theme");
if (savedTheme) body.dataset.theme = savedTheme;

document.getElementById("theme-toggle").addEventListener("click", () => {
  body.dataset.theme = body.dataset.theme === "light" ? "dark" : "light";
  localStorage.setItem("theme", body.dataset.theme);
});

document.getElementById("nav-burger").addEventListener("click", () => {
  document.querySelector(".main-nav").classList.toggle("open");
});
document.querySelectorAll(".main-nav a").forEach((a) =>
  a.addEventListener("click", () => document.querySelector(".main-nav").classList.remove("open"))
);

const searchOverlay = document.getElementById("search-overlay");
document.getElementById("search-toggle").addEventListener("click", () => {
  searchOverlay.classList.add("open");
  document.getElementById("search-input").focus();
});
document.getElementById("search-close").addEventListener("click", () => searchOverlay.classList.remove("open"));

const audio = document.getElementById("bg-audio");
let musicPlaying = false;
document.getElementById("music-toggle").addEventListener("click", () => {
  if (!audio.src) return; // no track configured in admin settings yet
  musicPlaying = !musicPlaying;
  musicPlaying ? audio.play().catch(() => {}) : audio.pause();
});

// Reveal-on-scroll for anything with .reveal, plus timeline items
const revealObserver = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in-view")),
  { threshold: 0.15 }
);
function observeReveal(el) { revealObserver.observe(el); }

/* ---------------------------------------------------------------------- */
/* Ambient background canvas — soft drifting particles                    */
/* ---------------------------------------------------------------------- */
(function bgCanvas() {
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d");
  let w, h, particles;
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  function init() {
    resize();
    particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.4 + 0.3, vy: Math.random() * 0.15 + 0.03,
    }));
  }
  function tick() {
    ctx.clearRect(0, 0, w, h);
    const light = body.dataset.theme === "light";
    ctx.fillStyle = light ? "rgba(169,127,46,0.35)" : "rgba(217,192,143,0.5)";
    particles.forEach((p) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      p.y -= p.vy; if (p.y < -5) p.y = h + 5;
    });
    requestAnimationFrame(tick);
  }
  window.addEventListener("resize", resize);
  init(); tick();
})();

/* ---------------------------------------------------------------------- */
/* SETTINGS (visitor counter, featured, music src)                        */
/* ---------------------------------------------------------------------- */
(async function trackVisitor() {
  try {
    const ref = doc(db, "settings", "site");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { visitorCount: increment(1) });
    }
  } catch (e) { /* rules may block writes — fail silently for visitors */ }
})();

onSnapshot(doc(db, "settings", "site"), (snap) => {
  if (!snap.exists()) return;
  const data = snap.data();
  document.getElementById("visitor-count-footer").textContent = data.visitorCount
    ? `${data.visitorCount.toLocaleString()} visits`
    : "";
  if (data.musicURL) audio.src = data.musicURL;
  if (data.heroSubtitle) document.getElementById("hero-sub").textContent = data.heroSubtitle;
  if (data.siteTitle) document.title = data.siteTitle;
});

/* ---------------------------------------------------------------------- */
/* ABOUT                                                                  */
/* ---------------------------------------------------------------------- */
onSnapshot(doc(db, "about", "main"), (snap) => {
  if (!snap.exists()) return;
  const d = snap.data();
  document.getElementById("about-bio").textContent = d.bio || "";
  if (d.photoURL) {
    const img = document.getElementById("about-photo");
    img.src = d.photoURL; img.alt = "Portrait";
  }
  const goals = document.getElementById("about-goals");
  goals.innerHTML = (d.goals || []).map((g) => `<li>${g}</li>`).join("") || "<li>—</li>";
  const ach = document.getElementById("about-achievements");
  ach.innerHTML = (d.achievements || []).map((a) => `<li>${a}</li>`).join("") || "<li>—</li>";
});

/* ---------------------------------------------------------------------- */
/* TIMELINE / LIFE JOURNEY                                                */
/* ---------------------------------------------------------------------- */
onSnapshot(query(collection(db, "timeline"), orderBy("date", "asc")), (snap) => {
  const list = document.getElementById("timeline-list");
  if (snap.empty) {
    list.innerHTML = `<div class="timeline-empty">No milestones yet — they'll appear here in order once added from the admin dashboard.</div>`;
    return;
  }
  list.innerHTML = "";
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    const item = document.createElement("div");
    item.className = "timeline-item";
    item.innerHTML = `
      <div class="timeline-date">${fmtDate(d.date)}</div>
      <div class="timeline-title">${d.title || ""}</div>
      <div class="timeline-desc">${d.description || ""}</div>`;
    list.appendChild(item);
    observeReveal(item);
  });
});

/* ---------------------------------------------------------------------- */
/* GALLERY — albums + media                                               */
/* ---------------------------------------------------------------------- */
let albumsCache = [];
let categoriesCache = new Set();
let showFavoritesOnly = false;

onSnapshot(query(collection(db, "albums"), orderBy("createdAt", "desc")), (snap) => {
  albumsCache = [];
  snap.forEach((d) => albumsCache.push({ id: d.id, ...d.data() }));
  document.getElementById("stat-albums").textContent = albumsCache.length;
  renderAlbumGrid();
});

function renderAlbumGrid() {
  const grid = document.getElementById("album-grid");
  if (!albumsCache.length) {
    grid.innerHTML = `<div class="empty-note">No albums yet.</div>`;
    return;
  }
  grid.innerHTML = "";
  albumsCache.forEach((a) => {
    const card = document.createElement("div");
    card.className = "album-card reveal";
    card.innerHTML = `
      <img class="album-cover" loading="lazy" src="${a.coverURL || ""}" alt="${a.name || ""}" />
      <div class="album-meta"><h3>${a.name || "Untitled"}</h3><p>${(a.mediaCount || 0)} items</p></div>`;
    card.addEventListener("click", () => openAlbum(a));
    grid.appendChild(card);
    observeReveal(card);
  });
}

let currentMedia = [];
let unsubMedia = null;
function openAlbum(album) {
  document.getElementById("gallery").hidden = true;
  document.querySelector(".album-grid").closest("section").hidden = true;
  const detail = document.getElementById("album-detail");
  detail.hidden = false;
  document.getElementById("album-detail-title").textContent = album.name || "";
  document.getElementById("album-detail-desc").textContent = album.description || "";
  detail.scrollIntoView({ behavior: "smooth" });

  if (unsubMedia) unsubMedia();
  unsubMedia = onSnapshot(
    query(collection(db, "albums", album.id, "media"), orderBy("createdAt", "desc")),
    (snap) => {
      currentMedia = [];
      snap.forEach((d) => currentMedia.push({ id: d.id, ...d.data() }));
      currentMedia.forEach((m) => m.category && categoriesCache.add(m.category));
      refreshCategoryOptions();
      renderMediaGrid();
    }
  );
}

document.getElementById("album-back").addEventListener("click", () => {
  document.getElementById("album-detail").hidden = true;
  document.getElementById("gallery").hidden = false;
  if (unsubMedia) unsubMedia();
});

function renderMediaGrid() {
  const grid = document.getElementById("media-grid");
  const cat = document.getElementById("gallery-category").value;
  const items = currentMedia.filter(
    (m) => (!cat || m.category === cat) && (!showFavoritesOnly || m.favorite)
  );
  grid.innerHTML = "";
  items.forEach((m, i) => {
    const tile = document.createElement("div");
    tile.className = "media-tile";
    tile.innerHTML =
      m.type === "video"
        ? `<video src="${m.url}" muted preload="metadata"></video><span class="play-badge">&#9654;</span>`
        : `<img src="${m.url}" loading="lazy" alt="${m.caption || ""}" />`;
    if (m.favorite) tile.innerHTML += `<span class="fav-badge">★</span>`;
    tile.addEventListener("click", () => openLightbox(items, i));
    grid.appendChild(tile);
  });
  if (!items.length) grid.innerHTML = `<div class="empty-note">Nothing here yet.</div>`;
}

document.getElementById("gallery-category").addEventListener("change", renderMediaGrid);
document.getElementById("gallery-favorites-toggle").addEventListener("click", (e) => {
  showFavoritesOnly = !showFavoritesOnly;
  e.target.classList.toggle("active", showFavoritesOnly);
  renderMediaGrid();
});
document.getElementById("gallery-slideshow-btn").addEventListener("click", () => {
  if (currentMedia.length) openLightbox(currentMedia, 0, true);
});

function refreshCategoryOptions() {
  const sel = document.getElementById("gallery-category");
  const current = sel.value;
  sel.innerHTML = `<option value="">All categories</option>` +
    [...categoriesCache].map((c) => `<option value="${c}">${c}</option>`).join("");
  sel.value = current;
}

/* ---------- Lightbox ---------- */
const lightbox = document.getElementById("lightbox");
let lbItems = [], lbIndex = 0, slideshowTimer = null;

function openLightbox(items, index, slideshow = false) {
  lbItems = items; lbIndex = index;
  lightbox.hidden = false;
  renderLightbox();
  if (slideshow) startSlideshow();
}
function renderLightbox() {
  const m = lbItems[lbIndex];
  const stage = document.getElementById("lightbox-stage");
  stage.innerHTML =
    m.type === "video"
      ? `<video src="${m.url}" controls autoplay></video>`
      : `<img src="${m.url}" alt="${m.caption || ""}" />`;
  document.getElementById("lightbox-caption").textContent = m.caption || "";
}
function closeLightbox() {
  lightbox.hidden = true;
  document.getElementById("lightbox-stage").innerHTML = "";
  clearInterval(slideshowTimer);
}
function startSlideshow() {
  clearInterval(slideshowTimer);
  slideshowTimer = setInterval(() => {
    lbIndex = (lbIndex + 1) % lbItems.length;
    renderLightbox();
  }, 3500);
}
document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
document.getElementById("lightbox-prev").addEventListener("click", () => {
  clearInterval(slideshowTimer);
  lbIndex = (lbIndex - 1 + lbItems.length) % lbItems.length; renderLightbox();
});
document.getElementById("lightbox-next").addEventListener("click", () => {
  clearInterval(slideshowTimer);
  lbIndex = (lbIndex + 1) % lbItems.length; renderLightbox();
});
document.getElementById("lightbox-download").addEventListener("click", () => {
  const m = lbItems[lbIndex];
  const a = document.createElement("a"); a.href = m.url; a.download = m.caption || "download";
  a.target = "_blank"; a.click();
});
document.getElementById("lightbox-share").addEventListener("click", async () => {
  const m = lbItems[lbIndex];
  if (navigator.share) { try { await navigator.share({ url: m.url, title: m.caption || "" }); } catch {} }
  else { navigator.clipboard.writeText(m.url); alert("Link copied."); }
});
document.getElementById("lightbox-fullscreen").addEventListener("click", () => {
  lightbox.requestFullscreen?.();
});
document.addEventListener("keydown", (e) => {
  if (lightbox.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowRight") document.getElementById("lightbox-next").click();
  if (e.key === "ArrowLeft") document.getElementById("lightbox-prev").click();
});

/* ---------------------------------------------------------------------- */
/* JOURNAL                                                                 */
/* ---------------------------------------------------------------------- */
let journalCache = [];
let journalView = "list";

onSnapshot(query(collection(db, "journal"), orderBy("date", "desc")), (snap) => {
  journalCache = [];
  snap.forEach((d) => journalCache.push({ id: d.id, ...d.data() }));
  document.getElementById("stat-entries").textContent = journalCache.length;
  if (journalCache.length) {
    const oldest = journalCache[journalCache.length - 1].date;
    const days = Math.max(1, Math.round((Date.now() - (oldest?.toDate ? oldest.toDate() : new Date(oldest))) / 86400000));
    document.getElementById("stat-days").textContent = days;
  }
  renderJournal();
});

function renderJournal() {
  const listEl = document.getElementById("journal-list");
  const calEl = document.getElementById("calendar-wrap");
  listEl.hidden = journalView === "calendar";
  calEl.hidden = journalView !== "calendar";

  if (!journalCache.length) {
    listEl.innerHTML = `<div class="empty-note">No journal entries yet.</div>`;
    return;
  }

  const sorted = [...journalCache].sort((a, b) => (b.pinned === a.pinned ? 0 : b.pinned ? 1 : -1));

  if (journalView === "calendar") {
    renderCalendar();
    return;
  }

  listEl.innerHTML = "";
  sorted.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "journal-card reveal" + (entry.pinned ? " pinned" : "");
    const plainExcerpt = (entry.content || "").replace(/[#*_\[\]()>-]/g, "").slice(0, 140);
    card.innerHTML = `
      <div class="journal-card-head">
        <span class="journal-date">${fmtDate(entry.date)}${entry.weather ? " · " + entry.weather : ""}</span>
        <span class="journal-mood">${entry.mood || ""}</span>
      </div>
      <div class="journal-title">${entry.pinned ? "📌 " : ""}${entry.title || "Untitled"}</div>
      <div class="journal-excerpt">${plainExcerpt}${plainExcerpt.length === 140 ? "…" : ""}</div>
      <div class="journal-tags">${(entry.tags || []).map((t) => `<span class="tag">#${t}</span>`).join("")}</div>`;
    card.addEventListener("click", () => openJournalEntry(entry));
    listEl.appendChild(card);
    observeReveal(card);
  });
}

function renderCalendar() {
  const calEl = document.getElementById("calendar-wrap");
  const byDate = {};
  journalCache.forEach((e) => {
    const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
    const key = d.toISOString().slice(0, 10);
    byDate[key] = byDate[key] || [];
    byDate[key].push(e);
  });
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let html = `<div class="calendar-grid">`;
  for (let i = 0; i < first.getDay(); i++) html += `<div class="calendar-cell"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const key = new Date(year, month, day).toISOString().slice(0, 10);
    const has = byDate[key];
    html += `<div class="calendar-cell${has ? " has-entry" : ""}" data-key="${key}">${day}</div>`;
  }
  html += `</div>`;
  calEl.innerHTML = html;
  calEl.querySelectorAll(".has-entry").forEach((cell) =>
    cell.addEventListener("click", () => openJournalEntry(byDate[cell.dataset.key][0]))
  );
}

document.querySelectorAll("[data-journal-view]").forEach((btn) =>
  btn.addEventListener("click", (e) => {
    document.querySelectorAll("[data-journal-view]").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    journalView = e.target.dataset.journalView;
    renderJournal();
  })
);

const reader = document.getElementById("journal-reader");
function openJournalEntry(entry) {
  document.getElementById("journal-reader-body").innerHTML = `
    <div class="journal-reader-meta">
      <span>${fmtDate(entry.date)}</span>
      ${entry.mood ? `<span>${entry.mood}</span>` : ""}
      ${entry.weather ? `<span>${entry.weather}</span>` : ""}
    </div>
    <h1>${entry.title || "Untitled"}</h1>
    ${renderMarkdown(entry.content || "")}
    <div class="journal-tags">${(entry.tags || []).map((t) => `<span class="tag">#${t}</span>`).join("")}</div>`;
  reader.hidden = false;
}
document.getElementById("journal-reader-close").addEventListener("click", () => (reader.hidden = true));

/* ---------------------------------------------------------------------- */
/* SEARCH — client-side across journal + albums                          */
/* ---------------------------------------------------------------------- */
document.getElementById("search-input").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const results = document.getElementById("search-results");
  if (!q) { results.innerHTML = ""; return; }

  const journalHits = journalCache
    .filter((j) => (j.title + " " + j.content + " " + (j.tags || []).join(" ")).toLowerCase().includes(q))
    .map((j) => ({ type: "Journal", label: j.title || "Untitled", onClick: () => openJournalEntry(j) }));

  const albumHits = albumsCache
    .filter((a) => (a.name || "").toLowerCase().includes(q))
    .map((a) => ({ type: "Album", label: a.name, onClick: () => { openAlbum(a); searchOverlay.classList.remove("open"); } }));

  const all = [...journalHits, ...albumHits];
  results.innerHTML = all.length
    ? all.map((r, i) => `<div class="search-result-item" data-i="${i}"><span class="sr-type">${r.type}</span><div>${r.label}</div></div>`).join("")
    : `<div class="empty-note">No matches.</div>`;
  [...results.children].forEach((el, i) =>
    el.addEventListener?.("click", () => { all[i].onClick(); searchOverlay.classList.remove("open"); })
  );
});
