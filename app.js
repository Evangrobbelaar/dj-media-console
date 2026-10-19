(function(){
"use strict";
const VERSION = "1.0.0";
const KINDS = ["Building","Container","Boundary wall","Room","Other"];
const $ = s => document.querySelector(s);
const el = (tag, attrs, ...kids) => {
  const n = document.createElement(tag);
  for (const k in (attrs || {})) { const v = attrs[k]; if (v == null || v === false) continue;
    if (k === "class") n.className = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? "" : v); }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = v => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : null; };
const fmt = n => n == null ? "–" : (Math.round(n * 100) / 100).toLocaleString("en-ZA", {maximumFractionDigits: 2});
const slug = s => (s || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
const total = r => (r.walls || []).reduce((a, w) => a + (num(w.length) || 0), 0);
function toast(m){ const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2400); }
function svgCam(){ const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2");
  s.innerHTML = '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'; return s; }

/* ---------- storage on this phone (IndexedDB) ---------- */
const Store = {
  idb: null, urls: new Map(),
  init(){
    return new Promise(res => { try { const r = indexedDB.open("erf-mapper", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("recs", {keyPath: "id"}); r.result.createObjectStore("blobs", {keyPath: "id"}); };
      r.onsuccess = () => { this.idb = r.result; res(true); }; r.onerror = () => res(false); } catch(e) { res(false); } });
  },
  tx(store, mode, fn){ return new Promise((res, rej) => { if (!this.idb) return rej(new Error("storage unavailable"));
    const t = this.idb.transaction(store, mode), r = fn(t.objectStore(store)); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); },
  all(){ return this.tx("recs", "readonly", s => s.getAll()).catch(() => []); },
  save(r){ return this.tx("recs", "readwrite", s => s.put(JSON.parse(JSON.stringify({...r, updatedAt: new Date().toISOString()})))); },
  async remove(r){ for (const p of r.photos || []) await this.dropPhoto(p); await this.tx("recs", "readwrite", s => s.delete(r.id)); },
  async upload(blob){ const id = uid(); await this.tx("blobs", "readwrite", s => s.put({id, blob})); return {local: id}; },
  async dropPhoto(p){ try { await this.tx("blobs", "readwrite", s => s.delete(p.local)); } catch(e) {} },
  async src(p){
    if (this.urls.has(p.local)) return this.urls.get(p.local);
    const r = await this.tx("blobs", "readonly", s => s.get(p.local)).catch(() => null); if (!r) return "";
    const u = URL.createObjectURL(r.blob); this.urls.set(p.local, u); return u;
  },
  async blob(p){ const r = await this.tx("blobs", "readonly", s => s.get(p.local)); return r && r.blob; }
};

let RECS = [];
const sorted = () => [...RECS].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
async function reload(){ RECS = await Store.all(); renderList(); }

/* ---------- list ---------- */
function renderList(){
  const list = $("#list"); list.replaceChildren();
  $("#listLabel").textContent = `Saved (${RECS.length})`;
  if (!RECS.length) list.append(el("div", {class: "empty"}, el("b", null, "Nothing measured yet"), "Tap New measurement, take a photo, type each wall's length and save."));
  for (const r of sorted()) {
    const th = el("div", {class: "thumb"}, (r.photos || []).length ? "" : "no photo");
    if ((r.photos || []).length) Store.src(r.photos[0]).then(s => s && th.append(el("img", {src: s, alt: ""})));
    const n = (r.walls || []).filter(w => num(w.length) != null).length, np = (r.photos || []).length;
    list.append(el("button", {class: "rec", onclick: () => openForm(r)}, th,
      el("div", {style: "min-width:0"}, el("div", {class: "t"}, r.title || "Untitled"),
        el("div", {class: "s"}, `${n} wall${n === 1 ? "" : "s"} · ${fmt(total(r))} m total`)),
      el("div", {class: "d"}, (r.createdAt || "").slice(5, 10).replace("-", "/"), el("br"), `${np} photo${np === 1 ? "" : "s"}`)));
  }
}

/* ---------- form ---------- */
function newRecord(){
  return {id: uid(), title: "Measurement " + (RECS.length + 1), kind: "", walls: ["Wall 1","Wall 2","Wall 3","Wall 4"].map(name => ({name, length: ""})), photos: [], notes: "", createdAt: new Date().toISOString()};
}
function openForm(rec, shootNow){
  const isNew = !RECS.some(x => x.id === rec.id);
  const r = JSON.parse(JSON.stringify(rec)); let pending = 0, confirmDel = false, saved = !isNew;
  const sheet = $("#sheet");
  const photos = el("div", {class: "photos"}), walls = el("div", {class: "walls"}), tot = el("div", {class: "total"});
  const updTotal = () => tot.textContent = `Total ${fmt(total(r))} m`;
  const shoot = sel => { const inp = $(sel); inp.value = ""; inp.onchange = () => addPhotos([...inp.files]); inp.click(); };
  async function addPhotos(files){
    if (!files.length) return; pending += files.length; drawPhotos();
    for (const f of files) {
      try { const b = await compress(f); r.photos.push({...await Store.upload(b), id: uid(), takenAt: new Date().toISOString(), type: b.type || "image/jpeg"});
        await Store.save(r); saved = true; }  // saved straight away so a photo is never lost
      catch(e) { toast("Photo failed: " + (e.message || e)); }
      pending--; drawPhotos();
    }
    const first = walls.querySelector(".len"); if (first && !first.value) first.focus();
  }
  function drawPhotos(){
    photos.replaceChildren();
    r.photos.forEach((p, i) => { const img = el("img", {alt: "Photo " + (i + 1), onclick: () => { $("#viewerImg").src = img.src; $("#viewer").hidden = false; }});
      Store.src(p).then(s => img.src = s);
      photos.append(el("div", {class: "ph"}, img, el("button", {"aria-label": "Delete photo", onclick: async () => { r.photos.splice(i, 1); await Store.dropPhoto(p); if (saved) await Store.save(r); drawPhotos(); }}, "×"))); });
    for (let i = 0; i < pending; i++) photos.append(el("div", {class: "shoot"}, "Saving photo…"));
    photos.append(el("button", {class: "shoot", onclick: () => shoot("#camIn")}, svgCam(), r.photos.length ? "Another photo" : "Take photo"));
  }
  function drawWalls(){
    walls.replaceChildren();
    r.walls.forEach((w, i) => walls.append(el("div", {class: "wall"},
      el("input", {class: "nm", value: w.name, "aria-label": "Wall name", oninput: e => w.name = e.target.value}),
      el("input", {class: "len", inputmode: "decimal", enterkeyhint: "next", value: w.length, placeholder: "0.00", "aria-label": (w.name || "Wall") + " length in metres",
        oninput: e => { w.length = e.target.value; updTotal(); },
        onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); const all = walls.querySelectorAll(".len"); if (all[i + 1]) all[i + 1].focus(); else addWall(); } }}),
      el("button", {class: "x", "aria-label": "Remove wall", onclick: () => { r.walls.splice(i, 1); drawWalls(); }}, "×"))));
    updTotal();
  }
  function addWall(){ r.walls.push({name: "Wall " + (r.walls.length + 1), length: ""}); drawWalls(); const all = walls.querySelectorAll(".len"); all[all.length - 1].focus(); }
  const titleIn = el("input", {class: "txt", value: r.title, "aria-label": "Name", oninput: e => r.title = e.target.value});
  const chips = el("div", {class: "chips"}, ...KINDS.map(k => el("button", {"aria-pressed": String(r.kind === k), onclick: () => {
    r.kind = r.kind === k ? "" : k; chips.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.textContent === r.kind)));
    if (r.kind && /^Measurement \d+$/.test(r.title)) { r.title = r.kind + " " + (RECS.filter(x => x.kind === r.kind).length + 1); titleIn.value = r.title; } }}, k)));
  const notes = el("textarea", {class: "txt", placeholder: "Height, material, anything else (optional)", "aria-label": "Notes", oninput: e => r.notes = e.target.value}); notes.value = r.notes || "";
  const close = () => { sheet.hidden = true; document.body.style.overflow = ""; reload(); };
  const saveBtn = el("button", {class: "btn primary", onclick: async () => {
    if (pending) return toast("Wait for the photo to finish saving");
    saveBtn.disabled = true;
    try { r.walls = r.walls.filter(w => num(w.length) != null || !/^Wall \d+$/.test(w.name || "")); await Store.save(r); toast("Saved"); close(); }
    catch(e) { toast("Couldn't save: " + (e.message || e)); }
    saveBtn.disabled = false; }}, "Save");
  const del = el("button", {class: "btn danger", onclick: async () => {
    if (!confirmDel) { confirmDel = true; del.textContent = "Tap again to delete"; return; }
    await Store.remove(r); toast("Deleted"); close(); }}, "Delete measurement");
  sheet.replaceChildren(el("div", {class: "sheet-in"},
    el("div", {class: "sheet-head"}, el("button", {class: "btn", onclick: () => pending ? toast("Wait for the photo to finish saving") : close()}, "Close"), el("h2", null, isNew ? "New measurement" : "Edit"), saveBtn),
    photos,
    el("div", {class: "label"}, "What is it?"), chips, titleIn,
    el("div", {class: "label"}, "Walls (metres)"), walls,
    el("div", {class: "row"}, el("button", {class: "btn", onclick: addWall}, "+ Add wall")), tot,
    notes,
    el("button", {class: "btn", onclick: () => shoot("#galIn")}, "Add photo from gallery"),
    isNew ? null : del));
  drawPhotos(); drawWalls();
  sheet.hidden = false; sheet.scrollTop = 0; document.body.style.overflow = "hidden";
  if (shootNow) shoot("#camIn");
}
async function compress(file){
  try { const bmp = await createImageBitmap(file, {imageOrientation: "from-image"}), k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85)); if (b && b.size) return b; } catch(e) {}
  return file;
}
$("#newBtn").addEventListener("click", () => openForm(newRecord(), true));
$("#viewer").addEventListener("click", () => $("#viewer").hidden = true);

/* ---------- export ---------- */
const photoName = (r, p, i) => `photos/${slug(r.title)}-${r.id.slice(-4)}/${String(i + 1).padStart(2, "0")}.${(p.type || "").includes("png") ? "png" : "jpg"}`;
function data(){
  return {format: "erf-mapper-simple/1", exportedAt: new Date().toISOString(), units: "metres",
    measurements: sorted().reverse().map(r => ({name: r.title, kind: r.kind || null, takenAt: r.createdAt, notes: r.notes || "",
      walls: (r.walls || []).map(w => ({name: w.name, length_m: num(w.length)})), total_length_m: total(r),
      photos: (r.photos || []).map((p, i) => photoName(r, p, i))}))};
}
function summary(){
  const d = data(), L = [`# Property measurements (${d.measurements.length})`, `Exported ${d.exportedAt.slice(0, 16).replace("T", " ")} UTC. All lengths in metres. Photos are in the photos/ folder, one folder per measurement.`, ""];
  for (const m of d.measurements) {
    L.push(`## ${m.name}${m.kind ? ` (${m.kind})` : ""}`);
    m.walls.forEach(w => L.push(`- ${w.name}: ${w.length_m == null ? "not measured" : fmt(w.length_m) + " m"}`));
    L.push(`- Total: ${fmt(m.total_length_m)} m`);
    if (m.notes) L.push(`- Notes: ${m.notes}`);
    m.photos.forEach(p => L.push(`- Photo: ${p}`));
    L.push("");
  }
  L.push("## Request for Claude", "Use the photos to work out which wall is which, check the measurements make sense (opposite walls of rectangles should match), flag anything missing, and summarise the property layout.");
  return L.join("\n");
}
async function deliver(blob, name){
  // Phones: share sheet (save to Files / Drive / WhatsApp). Elsewhere: normal download.
  const file = new File([blob], name, {type: blob.type || "application/zip"});
  if (navigator.canShare && navigator.canShare({files: [file]}) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({files: [file], title: name}); return "shared"; }
    catch(e) { if (e && e.name === "AbortError") return "cancelled"; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  return "downloaded";
}
$("#copyBtn").addEventListener("click", async () => {
  const text = summary();
  try { await navigator.clipboard.writeText(text); toast("Summary copied"); }
  catch(e) { const pr = $("#progress"); pr.textContent = text; const rg = document.createRange(); rg.selectNodeContents(pr); getSelection().removeAllRanges(); getSelection().addRange(rg); toast("Selected. Copy it from the menu."); }
});
$("#zipBtn").addEventListener("click", async () => {
  const btn = $("#zipBtn"), pr = $("#progress");
  if (!RECS.length) { pr.textContent = "Nothing to export yet."; return; }
  btn.disabled = true;
  try {
    const zip = new JSZip(); zip.file("summary.md", summary()); zip.file("data.json", JSON.stringify(data(), null, 2));
    const all = sorted().flatMap(r => (r.photos || []).map((p, i) => [r, p, i])); let done = 0, failed = 0;
    for (const [r, p, i] of all) { pr.textContent = `Collecting photos ${++done} of ${all.length}…`;
      try { const b = await Store.blob(p); if (b) zip.file(photoName(r, p, i), b); else failed++; } catch(e) { failed++; } }
    pr.textContent = "Building ZIP…";
    const out = await zip.generateAsync({type: "blob", compression: "STORE"}), name = `property-measurements-${new Date().toISOString().slice(0, 10)}.zip`;
    const how = await deliver(out, name);
    pr.textContent = (how === "cancelled" ? "Export cancelled." : how === "shared" ? "Shared " + name : "Downloaded " + name) + (failed ? ` (${failed} photo${failed > 1 ? "s" : ""} missing)` : "");
  } catch(e) { pr.textContent = "Export failed: " + (e.message || e); }
  btn.disabled = false;
});

/* ---------- install + offline ---------- */
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
let deferred = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("#installBtn").hidden = false; $("#installBanner").hidden = standalone; });
$("#installBtn").addEventListener("click", async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; $("#installBanner").hidden = true; });
window.addEventListener("appinstalled", () => { $("#installBanner").hidden = true; toast("Installed"); });
if (!standalone && /iPhone|iPad/i.test(navigator.userAgent)) {
  $("#installBanner").hidden = false;
  $("#installText").textContent = "To install: tap the Share button in Safari, then “Add to Home Screen”.";
}
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(() => {});
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
$("#foot").textContent = `Erf Mapper v${VERSION} · works offline · data stays on this phone`;

(async () => {
  const ok = await Store.init();
  if (!ok) $("#statusText").textContent = "Storage blocked (private browsing?)";
  reload();
})();
window.__erf = {Store, data, summary};
})();
