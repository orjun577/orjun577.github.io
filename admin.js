// admin.js — admin dashboard behavior
import { auth, db, storage, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "./firebase.js";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDocs, getDoc,
  onSnapshot, query, orderBy, serverTimestamp, increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* ---------------------------------------------------------------------- */
/* AUTH GATE                                                               */
/* ---------------------------------------------------------------------- */
const loginScreen = document.getElementById("admin-login");
const shell = document.getElementById("admin-shell");

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.hidden = true;
    shell.hidden = false;
    initDashboard();
  } else {
    loginScreen.hidden = false;
    shell.hidden = true;
  }
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errEl.textContent = "Sign-in failed — check your email and password.";
  }
});

document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

/* ---------------------------------------------------------------------- */
/* PANEL NAVIGATION                                                        */
/* ---------------------------------------------------------------------- */
document.querySelectorAll(".admin-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach((p) => (p.hidden = true));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.panel).hidden = false;
  });
});

let dashboardInitialized = false;
function initDashboard() {
  if (dashboardInitialized) return;
  dashboardInitialized = true;
  watchOverview();
  watchAlbums();
  watchJournal();
  watchTimeline();
  watchAbout();
  watchCategories();
  watchSettings();
}

/* ---------------------------------------------------------------------- */
/* OVERVIEW / STATS                                                        */
/* ---------------------------------------------------------------------- */
function watchOverview() {
  onSnapshot(collection(db, "albums"), (snap) => {
    document.getElementById("sc-albums").textContent = snap.size;
  });
  onSnapshot(collection(db, "journal"), (snap) => {
    document.getElementById("sc-journal").textContent = snap.size;
  });
  onSnapshot(doc(db, "settings", "site"), (snap) => {
    document.getElementById("sc-visitors").textContent = snap.data()?.visitorCount || 0;
  });
}

async function refreshRecentUploads() {
  const grid = document.getElementById("recent-uploads");
  const albumsSnap = await getDocs(collection(db, "albums"));
  let all = [];
  for (const a of albumsSnap.docs) {
    const mediaSnap = await getDocs(query(collection(db, "albums", a.id, "media"), orderBy("createdAt", "desc")));
    mediaSnap.forEach((m) => all.push(m.data()));
  }
  all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  all = all.slice(0, 12);
  document.getElementById("sc-media").textContent = all.length ? "…" : "0";
  grid.innerHTML = all
    .map((m) => (m.type === "video" ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" loading="lazy" />`))
    .join("") || `<p class="empty-note">Nothing uploaded yet.</p>`;

  // total media count across all albums
  let total = 0;
  for (const a of albumsSnap.docs) total += a.data().mediaCount || 0;
  document.getElementById("sc-media").textContent = total;
  document.getElementById("sc-storage").textContent = total ? `~${(total * 2.4).toFixed(1)} MB` : "—";
}

/* ---------------------------------------------------------------------- */
/* ALBUMS & MEDIA                                                          */
/* ---------------------------------------------------------------------- */
let albumsCache = [];
function watchAlbums() {
  onSnapshot(query(collection(db, "albums"), orderBy("createdAt", "desc")), (snap) => {
    albumsCache = [];
    snap.forEach((d) => albumsCache.push({ id: d.id, ...d.data() }));
    renderAdminAlbumGrid();
    refreshRecentUploads();
  });
}

function renderAdminAlbumGrid() {
  const grid = document.getElementById("admin-album-grid");
  grid.innerHTML = albumsCache
    .map(
      (a) => `
    <div class="album-card" data-id="${a.id}">
      <img class="album-cover" src="${a.coverURL || ""}" loading="lazy" alt="" />
      <div class="album-meta"><h3>${a.name || "Untitled"}</h3><p>${a.mediaCount || 0} items</p></div>
    </div>`
    )
    .join("") || `<p class="empty-note">No albums yet — create one to get started.</p>`;
  grid.querySelectorAll(".album-card").forEach((card) =>
    card.addEventListener("click", () => openAdminAlbum(albumsCache.find((a) => a.id === card.dataset.id)))
  );
}

document.getElementById("new-album-btn").addEventListener("click", async () => {
  const name = prompt("Album name:");
  if (!name) return;
  await addDoc(collection(db, "albums"), {
    name, description: "", coverURL: "", mediaCount: 0, createdAt: serverTimestamp(),
  });
});

let currentAlbum = null;
let currentAlbumMedia = [];
let unsubAdminMedia = null;

function openAdminAlbum(album) {
  currentAlbum = album;
  document.getElementById("admin-album-grid").parentElement.querySelector(".panel-head").hidden = false;
  document.getElementById("admin-album-grid").hidden = true;
  document.getElementById("admin-album-detail").hidden = false;
  document.getElementById("admin-album-title").textContent = album.name;

  if (unsubAdminMedia) unsubAdminMedia();
  unsubAdminMedia = onSnapshot(
    query(collection(db, "albums", album.id, "media"), orderBy("createdAt", "desc")),
    (snap) => {
      currentAlbumMedia = [];
      snap.forEach((d) => currentAlbumMedia.push({ id: d.id, ...d.data() }));
      renderAdminMediaGrid();
    }
  );
}

document.getElementById("admin-album-back").addEventListener("click", () => {
  document.getElementById("admin-album-grid").hidden = false;
  document.getElementById("admin-album-detail").hidden = true;
  if (unsubAdminMedia) unsubAdminMedia();
});

document.getElementById("rename-album-btn").addEventListener("click", async () => {
  const name = prompt("New album name:", currentAlbum.name);
  if (!name) return;
  await updateDoc(doc(db, "albums", currentAlbum.id), { name });
  document.getElementById("admin-album-title").textContent = name;
  currentAlbum.name = name;
});

document.getElementById("delete-album-btn").addEventListener("click", async () => {
  if (!confirm(`Delete "${currentAlbum.name}" and all its media? This cannot be undone.`)) return;
  for (const m of currentAlbumMedia) {
    try { await deleteObject(ref(storage, m.storagePath)); } catch {}
    await deleteDoc(doc(db, "albums", currentAlbum.id, "media", m.id));
  }
  await deleteDoc(doc(db, "albums", currentAlbum.id));
  document.getElementById("admin-album-back").click();
});

function renderAdminMediaGrid() {
  const grid = document.getElementById("admin-media-grid");
  grid.innerHTML = currentAlbumMedia
    .map(
      (m) => `
    <div class="admin-media-tile" data-id="${m.id}">
      ${m.type === "video" ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" loading="lazy" />`}
      <div class="tile-actions">
        <button data-act="fav" title="Toggle favorite">${m.favorite ? "★" : "☆"}</button>
        <button data-act="edit" title="Edit caption">✎</button>
        <button data-act="del" title="Delete">🗑</button>
      </div>
    </div>`
    )
    .join("") || `<p class="empty-note">No files yet — upload some above.</p>`;

  grid.querySelectorAll(".admin-media-tile").forEach((tile) => {
    const media = currentAlbumMedia.find((m) => m.id === tile.dataset.id);
    tile.querySelector('[data-act="fav"]').addEventListener("click", () =>
      updateDoc(doc(db, "albums", currentAlbum.id, "media", media.id), { favorite: !media.favorite })
    );
    tile.querySelector('[data-act="edit"]').addEventListener("click", async () => {
      const caption = prompt("Caption:", media.caption || "");
      if (caption === null) return;
      const category = prompt("Category:", media.category || "");
      await updateDoc(doc(db, "albums", currentAlbum.id, "media", media.id), { caption, category: category || "" });
    });
    tile.querySelector('[data-act="del"]').addEventListener("click", async () => {
      if (!confirm("Delete this file?")) return;
      try { await deleteObject(ref(storage, media.storagePath)); } catch {}
      await deleteDoc(doc(db, "albums", currentAlbum.id, "media", media.id));
      await updateDoc(doc(db, "albums", currentAlbum.id), { mediaCount: increment(-1) });
    });
  });
}

/* ---------- upload (drag & drop + bulk) ---------- */
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
dropzone.addEventListener("click", () => fileInput.click());
["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); })
);
dropzone.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

async function handleFiles(fileList) {
  const files = [...fileList];
  const progressWrap = document.getElementById("upload-progress");
  progressWrap.innerHTML = "";

  for (const file of files) {
    const isVideo = file.type.startsWith("video");
    const rowId = `up-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    progressWrap.insertAdjacentHTML(
      "beforeend",
      `<div id="${rowId}"><span>${file.name}</span><div class="bar-track"><div class="bar-fill"></div></div></div>`
    );
    const row = document.getElementById(rowId);
    const storagePath = `albums/${currentAlbum.id}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);

    await new Promise((resolve) => {
      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          row.querySelector(".bar-fill").style.width = pct + "%";
        },
        () => resolve(),
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          await addDoc(collection(db, "albums", currentAlbum.id, "media"), {
            url, storagePath, type: isVideo ? "video" : "image",
            caption: "", category: "", favorite: false, createdAt: serverTimestamp(),
          });
          await updateDoc(doc(db, "albums", currentAlbum.id), { mediaCount: increment(1) });
          if (!isVideo && !currentAlbum.coverURL) {
            await updateDoc(doc(db, "albums", currentAlbum.id), { coverURL: url });
          }
          row.remove();
          resolve();
        }
      );
    });
  }
}

/* ---------------------------------------------------------------------- */
/* JOURNAL                                                                 */
/* ---------------------------------------------------------------------- */
let journalCache = [];
let journalAutosaveTimer = null;
let editingEntryId = null;

function watchJournal() {
  onSnapshot(query(collection(db, "journal"), orderBy("date", "desc")), (snap) => {
    journalCache = [];
    snap.forEach((d) => journalCache.push({ id: d.id, ...d.data() }));
    renderAdminJournalList();
  });
}

function renderAdminJournalList() {
  const list = document.getElementById("admin-journal-list");
  list.innerHTML = journalCache
    .map(
      (j) => `
    <div class="admin-list-row" data-id="${j.id}">
      <div><div class="row-main">${j.pinned ? "📌 " : ""}${j.title || "Untitled"}</div><div class="row-meta">${fmtInputDate(j.date)}</div></div>
      <div class="row-actions"><button data-act="edit">Edit</button><button data-act="del">Delete</button></div>
    </div>`
    )
    .join("") || `<p class="empty-note">No entries yet.</p>`;

  list.querySelectorAll(".admin-list-row").forEach((row) => {
    const entry = journalCache.find((j) => j.id === row.dataset.id);
    row.querySelector('[data-act="edit"]').addEventListener("click", () => openJournalEditor(entry));
    row.querySelector('[data-act="del"]').addEventListener("click", async () => {
      if (confirm("Delete this entry?")) await deleteDoc(doc(db, "journal", entry.id));
    });
  });
}

function fmtInputDate(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : new Date();
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}

const journalEditor = document.getElementById("journal-editor");
function openJournalEditor(entry) {
  editingEntryId = entry?.id || null;
  document.getElementById("je-title").value = entry?.title || "";
  document.getElementById("je-date").value = fmtInputDate(entry?.date) || new Date().toISOString().slice(0, 10);
  document.getElementById("je-mood").value = entry?.mood || "";
  document.getElementById("je-weather").value = entry?.weather || "";
  document.getElementById("je-pinned").checked = !!entry?.pinned;
  document.getElementById("je-tags").value = (entry?.tags || []).join(", ");
  document.getElementById("je-content").value = entry?.content || "";
  document.getElementById("je-delete").hidden = !entry;
  document.getElementById("je-autosave-note").textContent = "";
  journalEditor.hidden = false;
}
document.getElementById("new-entry-btn").addEventListener("click", () => openJournalEditor(null));
document.getElementById("je-cancel").addEventListener("click", () => (journalEditor.hidden = true));

function collectJournalPayload() {
  return {
    title: document.getElementById("je-title").value.trim(),
    date: new Date(document.getElementById("je-date").value || Date.now()),
    mood: document.getElementById("je-mood").value.trim(),
    weather: document.getElementById("je-weather").value.trim(),
    pinned: document.getElementById("je-pinned").checked,
    tags: document.getElementById("je-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
    content: document.getElementById("je-content").value,
  };
}

async function saveJournalEntry(silent = false) {
  const payload = collectJournalPayload();
  if (!payload.title) return;
  if (editingEntryId) {
    await setDoc(doc(db, "journal", editingEntryId), payload, { merge: true });
  } else {
    const ref = await addDoc(collection(db, "journal"), { ...payload, createdAt: serverTimestamp() });
    editingEntryId = ref.id;
    document.getElementById("je-delete").hidden = false;
  }
  if (silent) {
    document.getElementById("je-autosave-note").textContent = "Autosaved " + new Date().toLocaleTimeString();
  }
}

document.getElementById("je-save").addEventListener("click", async () => {
  await saveJournalEntry(false);
  journalEditor.hidden = true;
});
document.getElementById("je-delete").addEventListener("click", async () => {
  if (editingEntryId && confirm("Delete this entry?")) {
    await deleteDoc(doc(db, "journal", editingEntryId));
    journalEditor.hidden = true;
  }
});
// autosave every few seconds while the editor is open and has a title
["je-title", "je-content", "je-mood", "je-weather", "je-tags", "je-date", "je-pinned"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    clearTimeout(journalAutosaveTimer);
    journalAutosaveTimer = setTimeout(() => saveJournalEntry(true), 2000);
  });
});

/* ---------------------------------------------------------------------- */
/* TIMELINE / LIFE JOURNEY                                                 */
/* ---------------------------------------------------------------------- */
let timelineCache = [];
let editingMilestoneId = null;

function watchTimeline() {
  onSnapshot(query(collection(db, "timeline"), orderBy("date", "asc")), (snap) => {
    timelineCache = [];
    snap.forEach((d) => timelineCache.push({ id: d.id, ...d.data() }));
    renderAdminTimelineList();
  });
}

function renderAdminTimelineList() {
  const list = document.getElementById("admin-timeline-list");
  list.innerHTML = timelineCache
    .map(
      (t) => `
    <div class="admin-list-row" data-id="${t.id}">
      <div><div class="row-main">${t.title}</div><div class="row-meta">${fmtInputDate(t.date)}</div></div>
      <div class="row-actions"><button data-act="edit">Edit</button><button data-act="del">Delete</button></div>
    </div>`
    )
    .join("") || `<p class="empty-note">No milestones yet.</p>`;

  list.querySelectorAll(".admin-list-row").forEach((row) => {
    const item = timelineCache.find((t) => t.id === row.dataset.id);
    row.querySelector('[data-act="edit"]').addEventListener("click", () => openTimelineEditor(item));
    row.querySelector('[data-act="del"]').addEventListener("click", async () => {
      if (confirm("Delete this milestone?")) await deleteDoc(doc(db, "timeline", item.id));
    });
  });
}

const timelineEditor = document.getElementById("timeline-editor");
function openTimelineEditor(item) {
  editingMilestoneId = item?.id || null;
  document.getElementById("tl-date").value = fmtInputDate(item?.date) || new Date().toISOString().slice(0, 10);
  document.getElementById("tl-title").value = item?.title || "";
  document.getElementById("tl-desc").value = item?.description || "";
  document.getElementById("tl-delete").hidden = !item;
  timelineEditor.hidden = false;
}
document.getElementById("new-milestone-btn").addEventListener("click", () => openTimelineEditor(null));
document.getElementById("tl-cancel").addEventListener("click", () => (timelineEditor.hidden = true));
document.getElementById("tl-save").addEventListener("click", async () => {
  const payload = {
    date: new Date(document.getElementById("tl-date").value),
    title: document.getElementById("tl-title").value.trim(),
    description: document.getElementById("tl-desc").value.trim(),
  };
  if (!payload.title) return;
  if (editingMilestoneId) await setDoc(doc(db, "timeline", editingMilestoneId), payload, { merge: true });
  else await addDoc(collection(db, "timeline"), payload);
  timelineEditor.hidden = true;
});
document.getElementById("tl-delete").addEventListener("click", async () => {
  if (editingMilestoneId && confirm("Delete this milestone?")) {
    await deleteDoc(doc(db, "timeline", editingMilestoneId));
    timelineEditor.hidden = true;
  }
});

/* ---------------------------------------------------------------------- */
/* ABOUT ME                                                                 */
/* ---------------------------------------------------------------------- */
function watchAbout() {
  onSnapshot(doc(db, "about", "main"), (snap) => {
    const d = snap.data() || {};
    document.getElementById("about-bio-input").value = d.bio || "";
    document.getElementById("about-goals-input").value = (d.goals || []).join("\n");
    document.getElementById("about-ach-input").value = (d.achievements || []).join("\n");
  });
}
document.getElementById("about-save-btn").addEventListener("click", async () => {
  const file = document.getElementById("about-photo-input").files[0];
  const payload = {
    bio: document.getElementById("about-bio-input").value,
    goals: document.getElementById("about-goals-input").value.split("\n").map((s) => s.trim()).filter(Boolean),
    achievements: document.getElementById("about-ach-input").value.split("\n").map((s) => s.trim()).filter(Boolean),
  };
  if (file) {
    const storageRef = ref(storage, `about/portrait_${Date.now()}_${file.name}`);
    await uploadBytesResumable(storageRef, file).then((t) => t);
    payload.photoURL = await getDownloadURL(storageRef);
  }
  await setDoc(doc(db, "about", "main"), payload, { merge: true });
  alert("About Me saved.");
});

/* ---------------------------------------------------------------------- */
/* CATEGORIES                                                              */
/* ---------------------------------------------------------------------- */
function watchCategories() {
  onSnapshot(collection(db, "categories"), (snap) => {
    const list = document.getElementById("admin-category-list");
    list.innerHTML = "";
    snap.forEach((d) => {
      const row = document.createElement("div");
      row.className = "admin-list-row";
      row.innerHTML = `<div class="row-main">${d.data().name}</div><div class="row-actions"><button data-act="del">Delete</button></div>`;
      row.querySelector('[data-act="del"]').addEventListener("click", () => deleteDoc(doc(db, "categories", d.id)));
      list.appendChild(row);
    });
    if (snap.empty) list.innerHTML = `<p class="empty-note">No categories yet.</p>`;
  });
}
document.getElementById("add-category-btn").addEventListener("click", async () => {
  const input = document.getElementById("new-category-input");
  if (!input.value.trim()) return;
  await addDoc(collection(db, "categories"), { name: input.value.trim() });
  input.value = "";
});

/* ---------------------------------------------------------------------- */
/* HOMEPAGE / FEATURED + SETTINGS                                          */
/* ---------------------------------------------------------------------- */
function watchSettings() {
  onSnapshot(doc(db, "settings", "site"), (snap) => {
    const d = snap.data() || {};
    document.getElementById("settings-title-input").value = d.siteTitle || "";
    document.getElementById("settings-music-input").value = d.musicURL || "";
    document.getElementById("settings-visitor-count").textContent = d.visitorCount || 0;
    document.getElementById("home-subtitle-input").value = d.heroSubtitle || "";
  });
}
document.getElementById("settings-save-btn").addEventListener("click", async () => {
  await setDoc(
    doc(db, "settings", "site"),
    {
      siteTitle: document.getElementById("settings-title-input").value,
      musicURL: document.getElementById("settings-music-input").value,
    },
    { merge: true }
  );
  alert("Settings saved.");
});
document.getElementById("home-save-btn").addEventListener("click", async () => {
  await setDoc(doc(db, "settings", "site"), { heroSubtitle: document.getElementById("home-subtitle-input").value }, { merge: true });
  alert("Homepage saved.");
});
