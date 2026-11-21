// SIH 2026 Explorer: filters, charts, insights and table over data/problems.json.
const state = { q: "", theme: "", org: "", cat: "", hideGeneric: true, healthOnly: false, mislabelOnly: false };
let ALL = [], charts = {};

const $ = (id) => document.getElementById(id);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0) + "%";

function countBy(items, key) {
  const m = new Map();
  for (const it of items) for (const k of [].concat(key(it))) m.set(k, (m.get(k) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function filtered() {
  const q = state.q.toLowerCase();
  return ALL.filter((p) =>
    (!state.hideGeneric || !p.generic) &&
    (!state.healthOnly || p.health) &&
    (!state.mislabelOnly || p.mislabel) &&
    (!state.theme || p.theme === state.theme) &&
    (!state.org || p.org === state.org) &&
    (!state.cat || p.category === state.cat) &&
    (!q || p.title.toLowerCase().includes(q) || p.org.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)));
}

// ---------- insights (computed from the full, de-genericised data) ----------
function insights() {
  const real = ALL.filter((p) => !p.generic);
  const ai = real.filter((p) => p.tech.includes("AI / ML")).length;
  const orgs = countBy(real, (p) => p.org_short);
  const top3 = orgs.slice(0, 3).reduce((s, [, n]) => s + n, 0);
  const health = real.filter((p) => p.health);
  const mis = real.filter((p) => p.mislabel);
  const medtech = real.filter((p) => p.theme.startsWith("MedTech"));
  const misc = real.filter((p) => p.theme === "Miscellaneous").length;
  const hw = real.filter((p) => p.category === "Hardware").length;
  const items = [
    `<strong>AI is the default answer.</strong> ${ai} of ${real.length} real problem statements (${pct(ai, real.length)}) name AI, ML or prediction in the title, so an AI entry alone won't stand out.`,
    `<strong>Three bodies set ${pct(top3, real.length)} of the agenda:</strong> ${orgs.slice(0, 3).map(([o, n]) => `${esc(o)} (${n})`).join(", ")}. ${ALL.filter((p) => p.generic).length} more rows are AICTE's open "Student Innovation" slots with no brief.`,
    `<strong>Hardware is a smaller pond.</strong> Only ${hw} of ${real.length} (${pct(hw, real.length)}) are hardware problems, so fewer teams compete for each.`,
    `<strong>Theme labels can't be trusted.</strong> ${mis.length} problems sit in the wrong health bucket: a clinical-trials dashboard filed under Space Technology, land-record digitisation under MedTech. ${misc} more are just "Miscellaneous". <button data-act="mislabel">Show the ${mis.length}</button>`,
    `<strong>For a doctor:</strong> ${health.length} problems are about human health, but only ${medtech.filter((p) => p.health).length} of the ${medtech.length} MedTech-themed ones are. Filter by health, not by theme. <button data-act="health">Show the ${health.length}</button>`,
  ];
  $("insights").innerHTML = items.map((s) => `<li>${s}</li>`).join("");
  $("insights").onclick = (e) => {
    const act = e.target.dataset && e.target.dataset.act;
    if (!act) return;
    resetState();
    if (act === "health") state.healthOnly = true;
    if (act === "mislabel") state.mislabelOnly = true;
    syncControls(); render();
    document.querySelector(".table-card").scrollIntoView({ behavior: "smooth" });
  };
}

// ---------- charts ----------
function barChart(id, horizontal, onClick) {
  const ctx = $(id);
  return new Chart(ctx, {
    type: "bar",
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 4, maxBarThickness: 26 }] },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed[horizontal ? "x" : "y"]} problems` } } },
      scales: {
        x: { grid: { display: !horizontal ? false : true, color: css("--line") }, ticks: { color: css("--muted"), precision: 0 } },
        y: { grid: { display: horizontal ? false : true, color: css("--line") }, ticks: { color: css("--ink"), autoSkip: false, font: { size: 12 },
          callback(v) { // shorten long labels on phones so they aren't cut off
            const l = this.getLabelForValue(v), max = window.innerWidth < 760 ? 18 : 40;
            return l.length > max ? l.slice(0, max - 1).trimEnd() + "…" : l; } } },
      },
      onClick: onClick ? (e, els) => els.length && onClick(els[0].index) : undefined,
      onHover: onClick ? (e, els) => { e.native.target.style.cursor = els.length ? "pointer" : "default"; } : undefined,
    },
  });
}

function setBars(chart, pairs, highlight) {
  chart.data.labels = pairs.map(([k]) => k);
  chart.data.datasets[0].data = pairs.map(([, v]) => v);
  chart.data.datasets[0].backgroundColor = pairs.map(([k]) => (highlight && highlight !== k ? css("--bar-2") : css("--bar")));
  chart.update();
}

// ---------- render ----------
function render() {
  const rows = filtered();
  $("k-count").textContent = rows.length;
  $("k-orgs").textContent = new Set(rows.map((p) => p.org)).size;
  $("k-ai").textContent = pct(rows.filter((p) => p.tech.includes("AI / ML")).length, rows.length);
  const hw = rows.filter((p) => p.category === "Hardware").length;
  $("k-hw").textContent = `${rows.length - hw} · ${hw}`;

  // theme chart shows all themes for the other filters, so clicking keeps context
  const forTheme = (() => { const t = state.theme; state.theme = ""; const r = filtered(); state.theme = t; return r; })();
  charts.theme.$pairs = countBy(forTheme, (p) => p.theme);
  setBars(charts.theme, charts.theme.$pairs, state.theme);
  setBars(charts.org, countBy(rows, (p) => p.org_short).slice(0, 10));
  setBars(charts.tech, countBy(rows.filter((p) => p.tech.length), (p) => p.tech));

  $("t-count").textContent = `${rows.length} shown`;
  $("rows").innerHTML = rows.map((p) => `<tr>
    <td class="id">${p.id}</td>
    <td class="title">${esc(p.title)}<div>${p.health ? '<span class="tag health">health</span>' : ""}${p.mislabel ? '<span class="tag warn">theme looks wrong</span>' : ""}${p.tech.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div></td>
    <td>${esc(p.org_short)}</td><td>${esc(p.theme)}</td><td>${p.category}</td></tr>`).join("")
    || `<tr><td colspan="5" class="hint">No problem statements match these filters.</td></tr>`;
}

function resetState() {
  Object.assign(state, { q: "", theme: "", org: "", cat: "", hideGeneric: true, healthOnly: false, mislabelOnly: false });
}

function syncControls() {
  $("q").value = state.q; $("f-theme").value = state.theme; $("f-org").value = state.org;
  $("f-generic").checked = state.hideGeneric; $("f-health").checked = state.healthOnly;
  document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.cat === state.cat));
}

async function init() {
  const data = await (await fetch("data/problems.json")).json();
  ALL = data.problems;
  $("deadline").textContent = data.meta.deadline;

  for (const [t] of countBy(ALL, (p) => p.theme).sort((a, b) => a[0].localeCompare(b[0])))
    $("f-theme").insertAdjacentHTML("beforeend", `<option>${esc(t)}</option>`);
  for (const [o, n] of countBy(ALL, (p) => p.org).sort((a, b) => a[0].localeCompare(b[0])))
    $("f-org").insertAdjacentHTML("beforeend", `<option value="${esc(o)}">${esc(o)} (${n})</option>`);

  charts.theme = barChart("c-theme", true, (i) => {
    const t = charts.theme.$pairs[i][0];
    state.theme = state.theme === t ? "" : t; syncControls(); render();
  });
  charts.org = barChart("c-org", true);
  charts.tech = barChart("c-tech", true);

  $("q").oninput = (e) => { state.q = e.target.value; render(); };
  $("f-theme").onchange = (e) => { state.theme = e.target.value; render(); };
  $("f-org").onchange = (e) => { state.org = e.target.value; render(); };
  $("f-generic").onchange = (e) => { state.hideGeneric = e.target.checked; render(); };
  $("f-health").onchange = (e) => { state.healthOnly = e.target.checked; state.mislabelOnly = false; render(); };
  document.querySelector(".seg").onclick = (e) => {
    if (e.target.dataset.cat === undefined) return;
    state.cat = e.target.dataset.cat; syncControls(); render();
  };
  $("reset").onclick = () => { resetState(); syncControls(); render(); };

  insights();
  render();
}

init();
