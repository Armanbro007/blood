/* BloodMate front end.
   There is no server yet, so everything is saved in this browser's localStorage.
   The `Store` object below is the only place that touches storage, so a real
   API can replace it later without changing the pages. */

const GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

// Which donor groups each recipient group can receive red cells from.
const CAN_RECEIVE_FROM = {
  "O-": ["O-"],
  "O+": ["O+", "O-"],
  "A-": ["A-", "O-"],
  "A+": ["A+", "A-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "AB-": ["AB-", "A-", "B-", "O-"],
  "AB+": ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
};
const canGiveTo = (g) => GROUPS.filter((r) => CAN_RECEIVE_FROM[r].includes(g));

const DISTRICTS = [
  "Bagerhat", "Bandarban", "Barguna", "Barishal", "Bhola", "Bogura", "Brahmanbaria", "Chandpur",
  "Chapainawabganj", "Chattogram", "Chuadanga", "Cox's Bazar", "Cumilla", "Dhaka", "Dinajpur", "Faridpur",
  "Feni", "Gaibandha", "Gazipur", "Gopalganj", "Habiganj", "Jamalpur", "Jashore", "Jhalokati",
  "Jhenaidah", "Joypurhat", "Khagrachhari", "Khulna", "Kishoreganj", "Kurigram", "Kushtia", "Lakshmipur",
  "Lalmonirhat", "Madaripur", "Magura", "Manikganj", "Meherpur", "Moulvibazar", "Munshiganj", "Mymensingh",
  "Naogaon", "Narail", "Narayanganj", "Narsingdi", "Natore", "Netrokona", "Nilphamari", "Noakhali",
  "Pabna", "Panchagarh", "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi", "Rangamati", "Rangpur",
  "Satkhira", "Shariatpur", "Sherpur", "Sirajganj", "Sunamganj", "Sylhet", "Tangail", "Thakurgaon",
];

const GAP_DAYS = 120; // about 4 months between whole-blood donations
const DAY = 86400000;

/* ---------- storage ---------- */
const KEY = "bloodmate.v2";
const today = () => new Date(new Date().toDateString());
const isoDaysAgo = (n) => new Date(today() - n * DAY).toISOString().slice(0, 10);
const isoDaysAhead = (n) => new Date(+today() + n * DAY).toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function seed() {
  // Sample records so the pages are not empty on first visit. Marked `sample`.
  const s = (name, group, district, area, lastDaysAgo, available = true) => ({
    id: uid(), sample: true, name, group, district, area, available,
    lastDonated: lastDaysAgo == null ? "" : isoDaysAgo(lastDaysAgo), phone: "", createdAt: Date.now(),
  });
  return {
    users: [
      s("Rahim U.", "O+", "Chattogram", "Agrabad", 200),
      s("Nusrat J.", "A+", "Chattogram", "GEC Circle", 40),
      s("Tanvir H.", "B+", "Dhaka", "Mirpur", null),
      s("Farhana A.", "O-", "Dhaka", "Dhanmondi", 150),
      s("Sabbir R.", "AB+", "Chattogram", "Halishahar", 300),
      s("Mitu S.", "B-", "Sylhet", "Zindabazar", 90),
      s("Arif K.", "A-", "Cumilla", "Kandirpar", 260),
      s("Jannat F.", "O+", "Dhaka", "Uttara", 20),
      s("Imran M.", "B+", "Chattogram", "Panchlaish", 180, false),
      s("Shuvo D.", "AB-", "Rajshahi", "Shaheb Bazar", 400),
      s("Lamia T.", "A+", "Khulna", "Sonadanga", 130),
      s("Hasan B.", "O+", "Chattogram", "Chawkbazar", null),
    ],
    requests: [
      { id: uid(), sample: true, group: "O-", units: 2, hospital: "Chittagong Medical College Hospital", district: "Chattogram", neededBy: isoDaysAhead(1), contactName: "Sample request", phone: "", note: "Surgery tomorrow morning.", status: "open", ownerId: null, createdAt: Date.now() - 3 * 3600e3 },
      { id: uid(), sample: true, group: "B+", units: 1, hospital: "Dhaka Medical College Hospital", district: "Dhaka", neededBy: isoDaysAhead(3), contactName: "Sample request", phone: "", note: "Thalassemia patient, regular transfusion.", status: "open", ownerId: null, createdAt: Date.now() - 20 * 3600e3 },
      { id: uid(), sample: true, group: "A+", units: 1, hospital: "Sylhet MAG Osmani Medical College Hospital", district: "Sylhet", neededBy: isoDaysAhead(5), contactName: "Sample request", phone: "", note: "", status: "open", ownerId: null, createdAt: Date.now() - 44 * 3600e3 },
    ],
    session: null,
  };
}

const Store = {
  _d: null,
  get d() {
    if (this._d) return this._d;
    try { this._d = JSON.parse(localStorage.getItem(KEY)); } catch { this._d = null; }
    if (!this._d) { this._d = seed(); this.save(); }
    return this._d;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this._d)); } catch { /* private mode */ } },
  reset() { this._d = seed(); this.save(); },

  donors() { return this.d.users; },
  me() { return this.d.users.find((u) => u.id === this.d.session) || null; },
  byEmail(email) { return this.d.users.find((u) => u.email && u.email === email.toLowerCase().trim()); },
  addUser(u) { u.id = uid(); u.createdAt = Date.now(); this.d.users.push(u); this.d.session = u.id; this.save(); return u; },
  updateMe(patch) { const m = this.me(); if (m) { Object.assign(m, patch); this.save(); } return m; },
  deleteMe() {
    const m = this.me(); if (!m) return;
    this.d.users = this.d.users.filter((u) => u.id !== m.id);
    this.d.requests = this.d.requests.filter((r) => r.ownerId !== m.id);
    this.d.session = null; this.save();
  },
  login(id) { this.d.session = id; this.save(); },
  logout() { this.d.session = null; this.save(); },

  requests() { return this.d.requests; },
  addRequest(r) { r.id = uid(); r.createdAt = Date.now(); r.status = "open"; this.d.requests.unshift(r); this.save(); return r; },
  setRequest(id, patch) { const r = this.d.requests.find((x) => x.id === id); if (r) { Object.assign(r, patch); this.save(); } },
  removeRequest(id) { this.d.requests = this.d.requests.filter((x) => x.id !== id); this.save(); },
};

/* ---------- helpers ---------- */
async function hash(text) {
  // Demo only: a real backend must hash passwords on the server with a slow, salted hash.
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("bloodmate:" + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function eligibility(u) {
  if (!u.lastDonated) return { ok: true, daysLeft: 0, pct: 100, next: null };
  const since = Math.floor((today() - new Date(u.lastDonated)) / DAY);
  const daysLeft = Math.max(0, GAP_DAYS - since);
  return { ok: daysLeft === 0, daysLeft, pct: Math.min(100, Math.round((since / GAP_DAYS) * 100)), next: new Date(+new Date(u.lastDonated) + GAP_DAYS * DAY) };
}
const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
function timeAgo(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); return `${d} day${d > 1 ? "s" : ""} ago`;
}
function dueLabel(iso) {
  const days = Math.round((new Date(iso) - today()) / DAY);
  if (days < 0) return { text: "Date passed", cls: "" };
  if (days === 0) return { text: "Needed today", cls: "hot" };
  if (days === 1) return { text: "Needed tomorrow", cls: "hot" };
  return { text: `Needed in ${days} days`, cls: days <= 3 ? "warn" : "" };
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const options = (list, placeholder) => (placeholder ? `<option value="">${placeholder}</option>` : "") + list.map((v) => `<option>${esc(v)}</option>`).join("");
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function toast(msg) {
  let t = $(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- theme ---------- */
(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("bloodmate.theme"); } catch {}
  const dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
})();
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("bloodmate.theme", next); } catch {}
}

/* ---------- shared header and footer ---------- */
const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5c5.2 7 10 12.4 10 18a10 10 0 0 1-20 0c0-5.6 4.8-11 10-18Z" fill="var(--brand)"/><path d="M11.5 21h9M16 16.5v9" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`;
const ICON = {
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
};

function renderChrome() {
  const page = document.body.dataset.page;
  const me = Store.me();
  const links = [
    ["index.html", "Home", "home"], ["find.html", "Find donors", "find"], ["requests.html", "Requests", "requests"],
    ["learn.html", "Learn", "learn"], ["about.html", "About", "about"],
  ];
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="demo-bar">Demo version: everything you enter is saved only in this browser. <a href="about.html#status">Why?</a></div>
    <nav class="container nav" aria-label="Main">
      <a class="brand" href="index.html">${LOGO}<span>BloodMate</span></a>
      <ul class="nav-links" id="nav-links">
        ${links.map(([h, t, k]) => `<li><a href="${h}"${k === page ? ' aria-current="page"' : ""}>${t}</a></li>`).join("")}
      </ul>
      <div class="nav-actions">
        <button class="icon-btn" type="button" id="theme-btn" aria-label="Switch light or dark theme">${ICON.moon}</button>
        ${me
          ? `<a class="btn btn-primary btn-sm" href="dashboard.html"><span class="long">My dashboard</span><span class="short">Dashboard</span></a>`
          : `<a class="btn btn-ghost btn-sm" href="login.html">Sign in</a><a class="btn btn-primary btn-sm" href="register.html"><span class="long">Become a donor</span><span class="short">Join</span></a>`}
        <button class="icon-btn menu-btn" type="button" id="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links">${ICON.menu}</button>
      </div>
    </nav>`;
  document.body.prepend(header);
  $("#theme-btn").onclick = toggleTheme;
  $("#menu-btn").onclick = (e) => {
    const open = $("#nav-links").classList.toggle("open");
    e.currentTarget.setAttribute("aria-expanded", open);
  };

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="brand" href="index.html">${LOGO}<span>BloodMate</span></a>
          <p style="margin-top:12px;max-width:38ch">Connects blood donors and patients in Bangladesh by blood group and district.</p>
        </div>
        <div><h4>Use BloodMate</h4><ul>
          <li><a href="find.html">Find donors</a></li><li><a href="requests.html">Blood requests</a></li>
          <li><a href="register.html">Become a donor</a></li><li><a href="dashboard.html">Dashboard</a></li></ul></div>
        <div><h4>Project</h4><ul>
          <li><a href="learn.html">Donation guide</a></li><li><a href="about.html">About</a></li>
          <li><a href="https://github.com/Armanbro007/blood">Source code</a></li></ul></div>
      </div>
      <div class="footer-bottom">
        <span>Built by <a href="https://github.com/Armanbro007">Arman Rahman</a>.</span>
        <span>In an emergency, contact your nearest hospital blood bank first.</span>
      </div>
    </div>`;
  document.body.append(footer);
}

function initReveal() {
  const els = $$(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  els.forEach((e) => io.observe(e));
}

/* ---------- shared renderers ---------- */
function donorCard(u, { showContact = true } = {}) {
  const el = eligibility(u);
  const status = !u.available ? `<span class="pill">Not available</span>`
    : el.ok ? `<span class="pill ok">Can donate now</span>`
    : `<span class="pill warn">Eligible in ${el.daysLeft} days</span>`;
  const last = u.lastDonated ? `Last gave ${fmtDate(u.lastDonated)}` : "Has not donated yet";
  const action = !showContact ? "" : u.sample
    ? `<button class="btn btn-ghost btn-sm" disabled title="Sample donor, no contact details">Sample donor</button>`
    : `<button class="btn btn-primary btn-sm" data-contact="${esc(u.id)}">Contact</button>`;
  return `<article class="row-card">
    <span class="badge">${esc(u.group)}</span>
    <div class="grow"><h3>${esc(u.name)}</h3>
      <div class="meta"><span>${esc(u.area ? u.area + ", " : "")}${esc(u.district)}</span><span>${last}</span></div></div>
    <div>${status}</div>
    <div class="actions">${action}</div>
  </article>`;
}

function contactDialog(name, phone, extra = "") {
  let d = $("#contact-dialog");
  if (!d) { d = document.createElement("dialog"); d.id = "contact-dialog"; document.body.append(d); }
  d.innerHTML = `<h3>Contact ${esc(name)}</h3>
    <p class="muted">${extra || "Please call politely and explain the patient's need, hospital and time."}</p>
    <p style="font-size:1.4rem;font-weight:800;margin:8px 0 20px">${esc(phone)}</p>
    <div style="display:flex;gap:8px"><a class="btn btn-primary" href="tel:${esc(phone.replace(/\s/g, ""))}">Call now</a>
    <button class="btn btn-ghost" type="button" onclick="this.closest('dialog').close()">Close</button></div>`;
  d.showModal();
}

document.addEventListener("DOMContentLoaded", () => {
  renderChrome();
  initReveal();
});
