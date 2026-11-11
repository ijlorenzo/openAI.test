import * as N from './nutrition.js';
import { searchFoods } from './foods.js';
import { load, save, reset, uid, MEALS, exportJSON, importJSON } from './store.js';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
let S = load();
const ui = {
  view: 'today',
  date: N.toISODate(new Date()),
  sheet: null,
  range: 30,
  search: '',
  tab: 'all',
  onb: null,
};

const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet-root');
const $toast = document.getElementById('toast-root');

function commit() { save(S); render(); }

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const imperial = () => (S.profile?.units || ui.onb?.draft?.units || 'imperial') === 'imperial';
const fmtKg = (kg, digits = 1) => (imperial() ? `${N.kgToLb(kg).toFixed(digits)} lb` : `${kg.toFixed(digits)} kg`);
const wUnit = () => (imperial() ? 'lb' : 'kg');
const toDisplayW = (kg) => Math.round((imperial() ? N.kgToLb(kg) : kg) * 10) / 10;
const fromDisplayW = (v) => (imperial() ? N.lbToKg(Number(v)) : Number(v));
const r0 = (n) => Math.round(n);
const todayISO = () => N.toISODate(new Date());
const entriesFor = (date) => S.entries[date] || [];

function fmtDate(iso) {
  const t = todayISO();
  if (iso === t) return 'Today';
  if (iso === N.addDays(t, -1)) return 'Yesterday';
  if (iso === N.addDays(t, 1)) return 'Tomorrow';
  return N.parseISODate(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtShort(iso) {
  return N.parseISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

let toastTimer;
function toast(msg) {
  $toast.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($toast.innerHTML = ''), 1800);
}

function openSheet(sheet) { ui.sheet = sheet; ui.sheetFresh = true; renderSheet(); }
function closeSheet() { ui.sheet = null; renderSheet(); }

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */
const ICON = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  trends: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
};

/* ------------------------------------------------------------------ */
/* Render root                                                         */
/* ------------------------------------------------------------------ */
function render() {
  if (!S.profile || !S.targets) {
    $app.classList.add('no-tabs');
    $app.innerHTML = renderOnboarding();
    return;
  }
  $app.classList.remove('no-tabs');
  let body = '';
  if (ui.view === 'today') body = renderToday();
  else if (ui.view === 'trends') body = renderTrends();
  else body = renderSettings();
  $app.innerHTML = body + renderTabs();
}

function renderTabs() {
  const tab = (id, label) => `<button class="tab ${ui.view === id ? 'on' : ''}" data-act="view" data-view="${id}" aria-label="${label}">${ICON[id]}<span>${label}</span></button>`;
  return `<nav class="tabs"><div class="tabs-inner">${tab('today', 'Today')}${tab('trends', 'Trends')}${tab('settings', 'Settings')}</div></nav>`;
}

/* ------------------------------------------------------------------ */
/* Onboarding                                                          */
/* ------------------------------------------------------------------ */
function onbDefault() {
  return { step: 0, draft: { units: 'imperial', sex: 'male', age: 30, heightCm: 175, weightKg: 77, activity: 'moderate', goal: 'lose', ratePct: 0.5 } };
}

function renderOnboarding() {
  if (!ui.onb) ui.onb = onbDefault();
  const { step, draft: d } = ui.onb;
  const imp = d.units === 'imperial';
  const totalIn = Math.round(N.cmToIn(d.heightCm));
  const ft = Math.floor(totalIn / 12);
  const inch = totalIn % 12;
  const wrap = (stepLabel, title, lead, body, actions) => `
    <section class="onb">
      <div class="body">
        <div class="step">${stepLabel}</div>
        <h1>${title}</h1>
        <p class="lead">${lead}</p>
        ${body}
      </div>
      <div class="actions">${actions}</div>
    </section>`;

  if (step === 0) {
    return `
      <section class="onb">
        <div class="body hero">
          <img class="logo" src="icons/icon-192.png" alt="" />
          <h1>Macro Log</h1>
          <p class="lead">Track your meals and macros in seconds. Every week your coach checks your progress and adjusts your calories, so you keep moving toward your goal.</p>
        </div>
        <div class="actions"><button class="btn primary" data-act="onb-next">Get started</button></div>
      </section>`;
  }
  if (step === 1) {
    return wrap('Step 1 of 3', 'About you', 'Used to estimate how much energy you burn each day.', `
      <div class="field"><span>Units</span>
        <div class="seg">
          <button class="${imp ? 'on' : ''}" data-act="onb-set" data-k="units" data-v="imperial">lb / ft</button>
          <button class="${!imp ? 'on' : ''}" data-act="onb-set" data-k="units" data-v="metric">kg / cm</button>
        </div></div>
      <div class="field"><span>Sex</span>
        <div class="seg">
          <button class="${d.sex === 'male' ? 'on' : ''}" data-act="onb-set" data-k="sex" data-v="male">Male</button>
          <button class="${d.sex === 'female' ? 'on' : ''}" data-act="onb-set" data-k="sex" data-v="female">Female</button>
        </div></div>
      <div class="input-row">
        <label class="field"><span>Age</span><div class="suffix"><input class="input num" inputmode="numeric" data-onb="age" value="${d.age}" /><b>yrs</b></div></label>
        <label class="field"><span>Weight</span><div class="suffix"><input class="input num" inputmode="decimal" data-onb="weight" value="${toDisplayWDraft(d)}" /><b>${imp ? 'lb' : 'kg'}</b></div></label>
      </div>
      ${imp
        ? `<div class="field"><span>Height</span><div class="input-row">
             <div class="suffix"><input class="input num" inputmode="numeric" data-onb="ft" value="${ft}" /><b>ft</b></div>
             <div class="suffix"><input class="input num" inputmode="numeric" data-onb="in" value="${inch}" /><b>in</b></div></div></div>`
        : `<label class="field"><span>Height</span><div class="suffix"><input class="input num" inputmode="numeric" data-onb="cm" value="${Math.round(d.heightCm)}" /><b>cm</b></div></label>`}
    `, `<button class="btn secondary" data-act="onb-back" style="width:auto">Back</button><button class="btn primary" data-act="onb-next">Continue</button>`);
  }
  if (step === 2) {
    const choices = Object.entries(N.ACTIVITY).map(([k, a]) => `
      <button class="choice ${d.activity === k ? 'on' : ''}" data-act="onb-set" data-k="activity" data-v="${k}">
        <span><div class="l">${a.label}</div><div class="h">${a.hint}</div></span>${d.activity === k ? '<span style="color:var(--accent)">✓</span>' : ''}
      </button>`).join('');
    return wrap('Step 2 of 3', 'Activity level', 'Pick the option that matches a typical week.', choices,
      `<button class="btn secondary" data-act="onb-back" style="width:auto">Back</button><button class="btn primary" data-act="onb-next">Continue</button>`);
  }
  if (step === 3) {
    const g = N.GOALS[d.goal];
    const rates = g.rates.length > 1 ? `
      <div class="field"><span>Pace · % of bodyweight per week</span>
        <div class="seg">${g.rates.map((r) => `<button class="${d.ratePct === r ? 'on' : ''}" data-act="onb-set" data-k="ratePct" data-v="${r}">${r}%</button>`).join('')}</div>
        <p class="small muted" style="margin-top:8px">${paceHint(d)}</p>
      </div>` : `<p class="small muted">We'll set calories at your estimated maintenance and fine-tune weekly.</p>`;
    return wrap('Step 3 of 3', 'Your goal', 'Slower paces preserve more muscle and are easier to stick to.', `
      <div class="seg" style="margin-bottom:16px">
        ${Object.entries(N.GOALS).map(([k, gg]) => `<button class="${d.goal === k ? 'on' : ''}" data-act="onb-set" data-k="goal" data-v="${k}">${gg.label}</button>`).join('')}
      </div>${rates}`,
      `<button class="btn secondary" data-act="onb-back" style="width:auto">Back</button><button class="btn primary" data-act="onb-next">See my plan</button>`);
  }
  const t = N.targetsFromProfile(d);
  const maint = r0(N.tdee(d));
  return wrap('Your plan', 'Daily targets', `Estimated maintenance is about <b class="num">${maint}</b> kcal. ${d.goal === 'maintain' ? 'We\'ll start you there.' : `To ${d.goal === 'lose' ? 'lose' : 'gain'} ~${fmtKgDraft(Math.abs(N.weeklyChangeKg(d)), d)} a week, start here:`}`, `
    <div class="targets">
      <div class="card"><div class="v num">${t.kcal}</div><div class="k">Calories</div></div>
      <div class="card"><div class="v num" style="color:var(--protein)">${t.protein}g</div><div class="k">Protein</div></div>
      <div class="card"><div class="v num" style="color:var(--carbs)">${t.carbs}g</div><div class="k">Carbs</div></div>
      <div class="card"><div class="v num" style="color:var(--fat)">${t.fat}g</div><div class="k">Fat</div></div>
    </div>
    <p class="small muted" style="margin-top:16px">These are a starting point. Log your weight most days and run the weekly check-in from Trends; your calories will adjust to how your body actually responds. You can edit any target in Settings.</p>`,
    `<button class="btn secondary" data-act="onb-back" style="width:auto">Back</button><button class="btn primary" data-act="onb-finish">Start tracking</button>`);
}
const toDisplayWDraft = (d) => Math.round((d.units === 'imperial' ? N.kgToLb(d.weightKg) : d.weightKg) * 10) / 10;
const fmtKgDraft = (kg, d) => (d.units === 'imperial' ? `${N.kgToLb(kg).toFixed(1)} lb` : `${kg.toFixed(2)} kg`);
function paceHint(d) {
  const kg = Math.abs(N.weeklyChangeKg(d));
  if (!kg) return '';
  return `About ${fmtKgDraft(kg, d)} per week · ${d.ratePct <= 0.5 ? 'Sustainable, recommended for most people.' : d.ratePct <= 0.75 ? 'Aggressive. Expect more hunger.' : 'Very aggressive. Best for short pushes only.'}`;
}

function readOnbInputs() {
  const d = ui.onb.draft;
  const get = (k) => $app.querySelector(`[data-onb="${k}"]`);
  const age = get('age'); if (age) d.age = clamp(Number(age.value) || d.age, 13, 100);
  const w = get('weight'); if (w && Number(w.value) > 0) d.weightKg = d.units === 'imperial' ? N.lbToKg(Number(w.value)) : Number(w.value);
  const ft = get('ft'); const inch = get('in');
  if (ft && inch) d.heightCm = N.inToCm((Number(ft.value) || 0) * 12 + (Number(inch.value) || 0)) || d.heightCm;
  const cm = get('cm'); if (cm && Number(cm.value) > 0) d.heightCm = Number(cm.value);
}
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* ------------------------------------------------------------------ */
/* Today                                                               */
/* ------------------------------------------------------------------ */
function renderToday() {
  const T = S.targets;
  const list = entriesFor(ui.date);
  const tot = N.sumEntries(list);
  const pct = T.kcal ? tot.kcal / T.kcal : 0;
  const C = 2 * Math.PI * 72;
  const offset = C * (1 - Math.min(1, pct));
  const remaining = T.kcal - r0(tot.kcal);
  const over = remaining < 0;
  const todayW = S.weights[ui.date];

  const macro = (k, label) => {
    const v = tot[k]; const t = T[k]; const p = t ? Math.min(100, (v / t) * 100) : 0;
    return `<div class="macro ${k} ${v > t ? 'over' : ''}">
      <div class="name"><i class="dot"></i>${label}</div>
      <div class="vals num">${r0(v)}<span> / ${t} g</span></div>
      <div class="bar"><i style="width:${p}%"></i></div></div>`;
  };

  const meals = MEALS.map((m) => {
    const items = list.filter((e) => e.meal === m.id);
    const kc = r0(N.sumEntries(items).kcal);
    return `<section class="card meal">
      <div class="meal-head">
        <div class="t"><span>${m.icon}</span>${m.label}</div>
        <div class="row" style="gap:10px"><span class="kcal num">${items.length ? kc + ' kcal' : ''}</span>
          <button class="meal-add" data-act="add" data-meal="${m.id}" aria-label="Add to ${m.label}">+</button></div>
      </div>
      ${items.map((e) => `<button class="entry" data-act="edit-entry" data-id="${e.id}">
          <span><div class="n">${esc(e.name)}</div><div class="s">${fmtServings(e)}</div></span>
          <span class="r"><div class="kc num">${r0(e.kcal)}</div><div class="m num">P ${r0(e.protein)} · C ${r0(e.carbs)} · F ${r0(e.fat)}</div></span>
        </button>`).join('')}
      ${!items.length ? `<div class="empty">Nothing logged yet.</div>` : ''}
    </section>`;
  }).join('');

  return `
    <header class="header">
      <div><h1>${fmtDate(ui.date)}</h1><div class="sub">${N.parseISODate(ui.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div></div>
      <div class="datenav">
        <button data-act="date" data-d="-1" aria-label="Previous day">‹</button>
        ${ui.date !== todayISO() ? `<button class="today-btn" data-act="date" data-d="0">Today</button>` : ''}
        <button data-act="date" data-d="1" aria-label="Next day">›</button>
      </div>
    </header>

    <section class="card">
      <div class="summary">
        <div class="ring ${over ? 'over' : ''}">
          <svg viewBox="0 0 160 160"><circle class="track" cx="80" cy="80" r="72"/><circle class="bar" cx="80" cy="80" r="72" stroke-dasharray="${C}" stroke-dashoffset="${offset}"/></svg>
          <div class="center"><div class="big num">${Math.abs(remaining)}</div><div class="label">${over ? 'over' : 'left'}</div></div>
        </div>
        <div class="kstats">
          <div class="kstat"><div class="v num">${r0(tot.kcal)}</div><div class="k">Eaten</div></div>
          <div class="kstat"><div class="v num">${T.kcal}</div><div class="k">Target</div></div>
          <div class="kstat"><div class="v num">${Math.round(pct * 100)}%</div><div class="k">Of budget</div></div>
        </div>
      </div>
      <div class="macros">${macro('protein', 'Protein')}${macro('carbs', 'Carbs')}${macro('fat', 'Fat')}</div>
    </section>

    ${meals}

    <section class="card row">
      <div><div style="font-weight:700">Weight</div><div class="small muted">${todayW ? `Logged ${fmtKg(todayW)}` : 'Log it most days for a better coach.'}</div></div>
      <button class="btn ${todayW ? 'secondary' : 'primary'} sm" data-act="weight">${todayW ? 'Edit' : 'Log weight'}</button>
    </section>`;
}

function fmtServings(e) {
  const q = Number(e.servings);
  const qs = Number.isInteger(q) ? q : q.toFixed(q < 1 ? 2 : 1).replace(/\.?0+$/, '');
  return `${qs} × ${esc(e.serving)}`;
}

/* ------------------------------------------------------------------ */
/* Trends                                                              */
/* ------------------------------------------------------------------ */
function weightPoints() {
  return Object.keys(S.weights).sort().map((date) => ({ date, kg: S.weights[date] }));
}

function renderTrends() {
  const all = N.trendSeries(weightPoints());
  const t = todayISO();
  const cut = ui.range === 0 ? null : N.addDays(t, -ui.range);
  const pts = cut ? all.filter((p) => p.date >= cut) : all;
  const last = all[all.length - 1];
  const weekAgo = all.filter((p) => N.daysBetween(p.date, t) >= 7).pop();
  const first = all[0];

  const stats = last ? `
    <div class="stat3">
      <div><div class="v num">${toDisplayW(last.trend)}</div><div class="k">Trend ${wUnit()}</div></div>
      <div><div class="v num">${weekAgo ? signed(toDisplayW(last.trend) - toDisplayW(weekAgo.trend)) : '–'}</div><div class="k">7 days</div></div>
      <div><div class="v num">${signed(toDisplayW(last.trend) - toDisplayW(first.kg))}</div><div class="k">Overall</div></div>
    </div>` : '';

  const lastCheck = S.checkins[S.checkins.length - 1];
  const since = S.lastCheckin ? N.daysBetween(S.lastCheckin, t) : null;

  return `
    <header class="header"><div><h1>Trends</h1><div class="sub">Weight, calories and your weekly coach</div></div></header>

    <section class="card">
      <div class="row" style="margin-bottom:8px"><div class="card-title" style="margin:0">Weight</div>
        <button class="btn secondary sm" data-act="weight">Log</button></div>
      <div class="seg range">
        ${[[30, '30d'], [90, '90d'], [0, 'All']].map(([v, l]) => `<button class="${ui.range === v ? 'on' : ''}" data-act="range" data-v="${v}">${l}</button>`).join('')}
      </div>
      ${pts.length >= 2 ? weightChart(pts) : `<p class="muted small" style="padding:24px 0;text-align:center">${all.length ? 'Not enough points in this range yet.' : 'Log your weight a few times and your trend line will appear here.'}</p>`}
      ${stats}
    </section>

    <section class="card">
      <div class="card-title">Weekly check-in</div>
      <p class="small" style="margin-bottom:12px">Compares this week's average weight with last week's and nudges your calories so your real pace matches your goal of <b>${goalText()}</b>.</p>
      ${lastCheck ? `<p class="small muted" style="margin-bottom:12px">Last check-in ${fmtShort(lastCheck.date)}: ${lastCheck.kcalBefore} → <b>${lastCheck.kcalAfter}</b> kcal${since != null && since < 7 ? ` · next one in ${7 - since} day${7 - since === 1 ? '' : 's'}` : ''}</p>` : ''}
      <button class="btn primary" data-act="checkin">Run check-in</button>
    </section>

    <section class="card">
      <div class="card-title">Calories · last 7 days</div>
      ${calorieChart()}
    </section>

    ${S.checkins.length ? `<section class="card"><div class="card-title">History</div>
      ${[...S.checkins].reverse().slice(0, 8).map((c) => `<div class="row small" style="padding:8px 0;border-top:1px solid var(--line)">
        <span>${fmtShort(c.date)} · ${fmtKg(c.currentKg)}</span><span class="num">${c.kcalBefore} → <b>${c.kcalAfter}</b></span></div>`).join('')}</section>` : ''}`;
}

const signed = (n) => `${n > 0 ? '+' : ''}${(Math.round(n * 10) / 10).toFixed(1)}`;
function goalText() {
  const p = S.profile;
  if (p.goal === 'maintain') return 'maintaining';
  return `${p.goal === 'lose' ? 'losing' : 'gaining'} ${p.ratePct}% / week`;
}

function weightChart(pts) {
  const W = 320, H = 150, px = 8, py = 14;
  const vals = pts.flatMap((p) => [toDisplayW(p.kg), toDisplayW(p.trend)]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(0.5, (hi - lo) * 0.15); lo -= pad; hi += pad;
  const t0 = N.parseISODate(pts[0].date).getTime(), t1 = N.parseISODate(pts[pts.length - 1].date).getTime() || t0 + 1;
  const x = (d) => px + ((N.parseISODate(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - 2 * px);
  const y = (v) => py + (1 - (v - lo) / (hi - lo)) * (H - 2 * py);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(toDisplayW(p.trend)).toFixed(1)}`).join(' ');
  const dots = pts.map((p) => `<circle class="raw" cx="${x(p.date).toFixed(1)}" cy="${y(toDisplayW(p.kg)).toFixed(1)}" r="2.5"/>`).join('');
  const gridVals = [lo + pad, (lo + hi) / 2, hi - pad];
  const grid = gridVals.map((v) => `<line class="grid" x1="${px}" x2="${W - px}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="axis" x="${W - px}" y="${(y(v) - 3).toFixed(1)}" text-anchor="end">${v.toFixed(1)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend">${grid}${dots}<path class="trend" d="${path}"/>
    <text class="axis" x="${px}" y="${H - 2}">${fmtShort(pts[0].date)}</text><text class="axis" x="${W - px}" y="${H - 2}" text-anchor="end">${fmtShort(pts[pts.length - 1].date)}</text></svg>`;
}

function calorieChart() {
  const t = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => N.addDays(t, i - 6));
  const T = S.targets.kcal;
  const vals = days.map((d) => N.sumEntries(entriesFor(d)).kcal);
  const max = Math.max(T * 1.15, ...vals, 1);
  const W = 320, H = 130, px = 8, top = 10, bottom = 18, bw = 28;
  const y = (v) => top + (1 - v / max) * (H - top - bottom);
  const bars = days.map((d, i) => {
    const cx = px + (i + 0.5) * ((W - 2 * px) / 7);
    const v = vals[i];
    const cls = v === 0 ? 'empty' : v > T * 1.05 ? 'over' : '';
    const h = v === 0 ? 3 : H - bottom - y(v);
    return `<rect class="kbar ${cls}" x="${(cx - bw / 2).toFixed(1)}" y="${(H - bottom - h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="6"/>
      <text class="axis" x="${cx.toFixed(1)}" y="${H - 4}" text-anchor="middle">${N.parseISODate(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</text>`;
  }).join('');
  const avg = vals.filter(Boolean).length ? r0(vals.reduce((a, b) => a + b, 0) / vals.filter(Boolean).length) : 0;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories last 7 days">${bars}
    <line class="target" x1="${px}" x2="${W - px}" y1="${y(T).toFixed(1)}" y2="${y(T).toFixed(1)}"/>
    <text class="axis" x="${W - px}" y="${(y(T) - 4).toFixed(1)}" text-anchor="end">${T}</text></svg>
    <div class="row small muted" style="margin-top:6px"><span>Average on logged days</span><b class="num" style="color:var(--text)">${avg || '–'} kcal</b></div>`;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */
function renderSettings() {
  const T = S.targets, p = S.profile;
  const theme = localStorage.getItem('macrolog.theme') || 'auto';
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `
    <header class="header"><div><h1>Settings</h1><div class="sub">Targets, profile and data</div></div></header>
    <section class="card">
      <div class="card-title">Plan</div>
      <button class="setrow" data-act="sheet-targets"><span><div class="l">Daily targets</div><div class="h num">${T.kcal} kcal · P ${T.protein} · C ${T.carbs} · F ${T.fat}</div></span><span class="chev">›</span></button>
      <button class="setrow" data-act="sheet-profile"><span><div class="l">Profile & goal</div><div class="h">${N.GOALS[p.goal].label}${p.goal !== 'maintain' ? ` · ${p.ratePct}% / wk` : ''} · ${N.ACTIVITY[p.activity].label}</div></span><span class="chev">›</span></button>
    </section>
    <section class="card">
      <div class="card-title">Preferences</div>
      <div class="field"><span>Units</span><div class="seg">
        <button class="${p.units === 'imperial' ? 'on' : ''}" data-act="units" data-v="imperial">lb / ft</button>
        <button class="${p.units === 'metric' ? 'on' : ''}" data-act="units" data-v="metric">kg / cm</button></div></div>
      <div class="field" style="margin:0"><span>Appearance</span><div class="seg">
        ${['auto', 'light', 'dark'].map((v) => `<button class="${theme === v ? 'on' : ''}" data-act="theme" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>
    </section>
    <section class="card">
      <div class="card-title">Data</div>
      <p class="small muted" style="margin-bottom:10px">Everything stays on this device. Export a backup now and then.</p>
      <div class="row" style="gap:8px">
        <button class="btn secondary" data-act="export">Export</button>
        <button class="btn secondary" data-act="sheet-import">Import</button>
      </div>
      <button class="btn danger" style="margin-top:10px" data-act="reset">Erase all data</button>
    </section>
    ${!standalone ? `<section class="card flat"><div class="card-title">Install on iPhone</div>
      <p class="small">Open this page in <b>Safari</b>, tap the <b>Share</b> button, then <b>Add to Home Screen</b>. It will launch full-screen and work offline.</p></section>` : ''}
    <p class="tiny muted" style="text-align:center;padding:8px 0 16px">Macro Log · Estimates use the Mifflin–St Jeor equation. Not medical advice.</p>`;
}

/* ------------------------------------------------------------------ */
/* Sheets                                                              */
/* ------------------------------------------------------------------ */
function renderSheet() {
  const sh = ui.sheet;
  if (!sh) { $sheet.innerHTML = ''; document.body.style.overflow = ''; return; }
  document.body.style.overflow = 'hidden';
  let inner = '', tall = false;
  if (sh.type === 'add') { inner = sheetAdd(sh); tall = true; }
  else if (sh.type === 'food') inner = sheetFood(sh);
  else if (sh.type === 'quick') inner = sheetQuick(sh);
  else if (sh.type === 'custom') inner = sheetCustom(sh);
  else if (sh.type === 'weight') inner = sheetWeight(sh);
  else if (sh.type === 'checkin') inner = sheetCheckin(sh);
  else if (sh.type === 'targets') inner = sheetTargets();
  else if (sh.type === 'profile') inner = sheetProfile(sh);
  else if (sh.type === 'import') inner = sheetImport();
  const enter = ui.sheetFresh ? 'enter' : '';
  ui.sheetFresh = false;
  $sheet.innerHTML = `<div class="scrim ${enter}" data-act="close"></div><div class="sheet ${tall ? 'tall' : ''} ${enter}" role="dialog" aria-modal="true"><div class="grab"></div>${inner}</div>`;
  const focus = $sheet.querySelector('[autofocus]');
  if (focus) setTimeout(() => focus.focus(), 50);
}

const head = (title) => `<div class="sheet-head"><h2>${title}</h2><button class="close" data-act="close" aria-label="Close">✕</button></div>`;

function sheetAdd(sh) {
  const mealLabel = MEALS.find((m) => m.id === sh.meal).label;
  return `${head(`Add to ${mealLabel}`)}
    <div class="search"><input class="input" type="search" placeholder="Search foods" value="${esc(ui.search)}" data-search autocomplete="off" autocorrect="off" autofocus />
      <div class="seg" style="margin-top:10px">
        ${[['recent', 'Recent'], ['all', 'All foods'], ['custom', 'My foods']].map(([v, l]) => `<button class="${ui.tab === v ? 'on' : ''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
      </div></div>
    <div class="results" data-results>${resultsHTML(sh)}</div>
    <div class="row" style="gap:8px;padding-top:12px">
      <button class="btn secondary" data-act="sheet-quick">Quick add</button>
      <button class="btn secondary" data-act="sheet-custom">Create food</button>
    </div>`;
}

function allFoodsForSearch() { return S.customFoods; }
function foodById(id) { return S.customFoods.find((f) => f.id === id) || searchFoods('').find((f) => f.id === id); }

function resultsHTML() {
  let list;
  const q = ui.search.trim();
  if (q) list = searchFoods(q, allFoodsForSearch());
  else if (ui.tab === 'recent') list = S.recents.map(foodById).filter(Boolean);
  else if (ui.tab === 'custom') list = S.customFoods;
  else list = searchFoods('', allFoodsForSearch());
  if (!list.length) {
    const msg = q ? `No match for “${esc(q)}”. Try fewer words, or create it.` : ui.tab === 'recent' ? 'Foods you log will show up here.' : 'Create a food to see it here.';
    return `<p class="muted small" style="padding:24px 0;text-align:center">${msg}</p>`;
  }
  return list.slice(0, 80).map((f) => `<button class="food" data-act="pick" data-id="${esc(f.id)}">
      <span><div class="n">${esc(f.name)}${f.brand ? ` <span class="muted">· ${esc(f.brand)}</span>` : ''}</div><div class="s">${esc(f.serving)} · P ${f.protein} · C ${f.carbs} · F ${f.fat}</div></span>
      <span class="kc num">${f.kcal}<small> kcal</small></span></button>`).join('');
}

function sheetFood(sh) {
  const f = sh.food;
  const m = N.scaleFood(f, sh.servings);
  const mealSel = `<div class="seg" style="margin:14px 0">${MEALS.map((mm) => `<button class="${sh.meal === mm.id ? 'on' : ''}" data-act="food-meal" data-v="${mm.id}">${mm.label}</button>`).join('')}</div>`;
  return `${head(esc(f.name))}
    <p class="muted small" style="margin-top:-6px">${esc(f.serving)} per serving${f.brand ? ` · ${esc(f.brand)}` : ''}</p>
    <div class="stepper" style="margin:22px 0 6px">
      <button data-act="serv" data-d="-1" aria-label="Fewer">−</button>
      <input class="num" inputmode="decimal" value="${fmtQty(sh.servings)}" data-serv aria-label="Servings" />
      <button data-act="serv" data-d="1" aria-label="More">+</button>
    </div>
    <p class="muted small" style="text-align:center;margin-bottom:12px">servings</p>
    <div class="card flat" style="margin:0">
      <div class="row"><span style="font-size:28px;font-weight:800" class="num">${r0(m.kcal)} <span class="muted small" style="font-weight:600">kcal</span></span>
        <span class="macroline"><span class="p">P <b>${m.protein}</b></span><span class="c">C <b>${m.carbs}</b></span><span class="f">F <b>${m.fat}</b></span></span></div>
    </div>
    ${mealSel}
    <button class="btn primary" data-act="food-save">${sh.entryId ? 'Save changes' : `Add to ${MEALS.find((x) => x.id === sh.meal).label}`}</button>
    ${sh.entryId ? `<button class="btn danger" style="margin-top:8px" data-act="entry-delete">Remove from log</button>` : ''}
    ${!sh.entryId && f.custom ? `<button class="btn ghost" style="margin-top:4px" data-act="custom-delete" data-id="${esc(f.id)}">Delete this custom food</button>` : ''}`;
}
const fmtQty = (q) => (Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100));

function sheetQuick(sh) {
  return `${head('Quick add')}
    <p class="muted small" style="margin:-6px 0 14px">Log macros directly without a food. Calories are filled in from macros if you leave them blank.</p>
    <form data-form="quick">
      <label class="field"><span>Name (optional)</span><input class="input" name="name" placeholder="e.g. Restaurant lunch" /></label>
      <div class="input-row three">
        <label class="field"><span>Protein g</span><input class="input num" name="protein" inputmode="decimal" placeholder="0" /></label>
        <label class="field"><span>Carbs g</span><input class="input num" name="carbs" inputmode="decimal" placeholder="0" /></label>
        <label class="field"><span>Fat g</span><input class="input num" name="fat" inputmode="decimal" placeholder="0" /></label>
      </div>
      <label class="field"><span>Calories</span><input class="input num" name="kcal" inputmode="numeric" placeholder="auto" /></label>
      <div class="seg" style="margin-bottom:14px">${MEALS.map((mm) => `<button type="button" class="${sh.meal === mm.id ? 'on' : ''}" data-act="food-meal" data-v="${mm.id}">${mm.label}</button>`).join('')}</div>
      <button class="btn primary" type="submit">Add</button>
    </form>`;
}

function sheetCustom(sh) {
  return `${head('Create food')}
    <form data-form="custom">
      <label class="field"><span>Name</span><input class="input" name="name" required placeholder="e.g. Mom's lasagna" autofocus /></label>
      <label class="field"><span>Serving size</span><input class="input" name="serving" required placeholder="e.g. 1 slice (150 g)" /></label>
      <div class="input-row">
        <label class="field"><span>Calories</span><input class="input num" name="kcal" inputmode="numeric" required placeholder="0" /></label>
        <label class="field"><span>Protein g</span><input class="input num" name="protein" inputmode="decimal" placeholder="0" /></label>
        <label class="field"><span>Carbs g</span><input class="input num" name="carbs" inputmode="decimal" placeholder="0" /></label>
        <label class="field"><span>Fat g</span><input class="input num" name="fat" inputmode="decimal" placeholder="0" /></label>
      </div>
      <button class="btn primary" type="submit">Save food</button>
    </form>`;
}

function sheetWeight(sh) {
  const d = sh.date || ui.date;
  const cur = S.weights[d];
  return `${head('Log weight')}
    <p class="muted small" style="margin:-6px 0 14px">${fmtDate(d)} · best first thing in the morning.</p>
    <form data-form="weight">
      <input type="hidden" name="date" value="${d}" />
      <label class="field"><span>Weight</span><div class="suffix"><input class="input num" name="w" inputmode="decimal" required step="0.1" value="${cur ? toDisplayW(cur) : ''}" placeholder="${toDisplayW(S.profile.weightKg)}" autofocus /><b>${wUnit()}</b></div></label>
      <button class="btn primary" type="submit">Save</button>
      ${cur ? `<button class="btn ghost" type="button" style="margin-top:6px" data-act="weight-delete" data-date="${d}">Remove entry</button>` : ''}
    </form>`;
}

function sheetCheckin(sh) {
  const r = sh.result;
  if (!r.ok) return `${head('Not yet')}<p>${esc(r.reason)}</p><button class="btn secondary" style="margin-top:16px" data-act="close">OK</button>`;
  const dir = r.delta === 0 ? 'Hold steady' : r.delta > 0 ? `Add ${r.delta} kcal` : `Cut ${-r.delta} kcal`;
  const why = r.delta === 0
    ? 'Your weekly change is right on plan. Keep doing what you are doing.'
    : r.delta > 0
      ? (S.profile.goal === 'gain' ? 'You are gaining slower than planned, so calories go up.' : 'You are losing faster than planned. A few more calories will protect muscle and energy.')
      : (S.profile.goal === 'gain' ? 'You are gaining faster than planned, so calories come down a bit.' : 'You are losing slower than planned, so calories come down a bit.');
  return `${head('Weekly check-in')}
    <div class="targets" style="margin-bottom:14px">
      <div class="card flat"><div class="v num">${signed(toDisplayW(r.actualKg))}</div><div class="k">Actual / wk</div></div>
      <div class="card flat"><div class="v num">${signed(toDisplayW(r.expectedKg))}</div><div class="k">Planned / wk</div></div>
    </div>
    <h3 style="font-size:22px;font-weight:800;letter-spacing:-.02em">${dir}</h3>
    <p class="small muted" style="margin:6px 0 14px">${why}</p>
    <div class="card flat" style="margin-bottom:14px">
      <div class="row"><span class="muted small">Calories</span><b class="num">${r.kcalBefore} → ${r.kcalAfter}</b></div>
      <div class="row" style="margin-top:6px"><span class="muted small">Protein · Carbs · Fat</span><b class="num">${r.targets.protein} · ${r.targets.carbs} · ${r.targets.fat} g</b></div>
    </div>
    ${sh.early ? `<p class="small" style="color:var(--carbs);margin-bottom:12px">It has been under 7 days since your last check-in. Weekly is best; applying more often chases noise.</p>` : ''}
    <button class="btn primary" data-act="checkin-apply">Apply new targets</button>
    <button class="btn ghost" style="margin-top:6px" data-act="close">Not now</button>`;
}

function sheetTargets() {
  const T = S.targets;
  return `${head('Daily targets')}
    <form data-form="targets">
      <label class="field"><span>Calories</span><input class="input num" name="kcal" inputmode="numeric" value="${T.kcal}" required /></label>
      <div class="input-row three">
        <label class="field"><span>Protein g</span><input class="input num" name="protein" inputmode="numeric" value="${T.protein}" required /></label>
        <label class="field"><span>Carbs g</span><input class="input num" name="carbs" inputmode="numeric" value="${T.carbs}" required /></label>
        <label class="field"><span>Fat g</span><input class="input num" name="fat" inputmode="numeric" value="${T.fat}" required /></label>
      </div>
      <p class="small muted" style="margin:-4px 0 14px">Macros add up to <b class="num" data-macro-kcal>${N.macroCalories(T)}</b> kcal.</p>
      <button class="btn primary" type="submit">Save</button>
      <button class="btn ghost" type="button" style="margin-top:6px" data-act="targets-recalc">Recalculate from profile</button>
    </form>`;
}

function sheetProfile() {
  const p = S.profile; const imp = p.units === 'imperial';
  const totalIn = Math.round(N.cmToIn(p.heightCm));
  return `${head('Profile & goal')}
    <form data-form="profile">
      <div class="field"><span>Sex</span><select class="input" name="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option></select></div>
      <div class="input-row">
        <label class="field"><span>Age</span><input class="input num" name="age" inputmode="numeric" value="${p.age}" /></label>
        <label class="field"><span>Weight (${wUnit()})</span><input class="input num" name="weight" inputmode="decimal" value="${toDisplayW(p.weightKg)}" /></label>
      </div>
      ${imp ? `<div class="field"><span>Height</span><div class="input-row">
          <div class="suffix"><input class="input num" name="ft" inputmode="numeric" value="${Math.floor(totalIn / 12)}" /><b>ft</b></div>
          <div class="suffix"><input class="input num" name="in" inputmode="numeric" value="${totalIn % 12}" /><b>in</b></div></div></div>`
        : `<label class="field"><span>Height (cm)</span><input class="input num" name="cm" inputmode="numeric" value="${Math.round(p.heightCm)}" /></label>`}
      <div class="field"><span>Activity</span><select class="input" name="activity">${Object.entries(N.ACTIVITY).map(([k, a]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${a.label} · ${a.hint}</option>`).join('')}</select></div>
      <div class="field"><span>Goal</span><select class="input" name="goal">${Object.entries(N.GOALS).map(([k, g]) => `<option value="${k}" ${p.goal === k ? 'selected' : ''}>${g.label}</option>`).join('')}</select></div>
      <div class="field"><span>Pace · % bodyweight / week</span><select class="input" name="ratePct">${[0, 0.25, 0.5, 0.75, 1].map((r) => `<option value="${r}" ${Number(p.ratePct) === r ? 'selected' : ''}>${r}%</option>`).join('')}</select></div>
      <label class="row small" style="margin-bottom:14px"><span>Recalculate my targets from this</span><input type="checkbox" name="recalc" checked style="width:20px;height:20px" /></label>
      <button class="btn primary" type="submit">Save</button>
    </form>`;
}

function sheetImport() {
  return `${head('Import backup')}
    <p class="small muted" style="margin:-6px 0 12px">Choose a Macro Log JSON export. This replaces the data on this device.</p>
    <input class="input" type="file" accept="application/json,.json" data-import-file />
    <p class="small muted" style="margin:12px 0 6px">…or paste it:</p>
    <textarea class="input" rows="5" data-import-text placeholder="{ ... }"></textarea>
    <button class="btn primary" style="margin-top:12px" data-act="import-apply">Import</button>`;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */
function addEntry(meal, food, servings, date = ui.date) {
  const m = N.scaleFood(food, servings);
  const e = { id: uid(), meal, name: food.name, serving: food.serving, servings, foodId: food.id, per: { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat }, ...m };
  S.entries[date] = [...entriesFor(date), e];
  if (food.id && !String(food.id).startsWith('quick')) {
    S.recents = [food.id, ...S.recents.filter((x) => x !== food.id)].slice(0, 30);
  }
}

function runCheckin() {
  const t = todayISO();
  const result = N.weeklyCheckin({ weights: S.weights, profile: S.profile, targets: S.targets, today: t });
  const early = S.lastCheckin ? N.daysBetween(S.lastCheckin, t) < 7 : false;
  openSheet({ type: 'checkin', result, early });
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function applyTheme(v) {
  if (v === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', v);
}

const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const sh = ui.sheet;

  switch (act) {
    case 'view': ui.view = el.dataset.view; window.scrollTo(0, 0); render(); break;
    case 'date': {
      const d = Number(el.dataset.d);
      ui.date = d === 0 ? todayISO() : N.addDays(ui.date, d);
      render(); break;
    }
    case 'add': ui.search = ''; ui.tab = S.recents.length ? 'recent' : 'all'; openSheet({ type: 'add', meal: el.dataset.meal }); break;
    case 'tab': ui.tab = el.dataset.v; renderSheet(); break;
    case 'pick': {
      const f = foodById(el.dataset.id);
      if (f) openSheet({ type: 'food', food: f, meal: sh.meal, servings: 1 });
      break;
    }
    case 'serv': {
      const cur = num($sheet.querySelector('[data-serv]')?.value) || sh.servings;
      const step = cur < 1 || (cur === 1 && el.dataset.d === '-1') ? 0.25 : cur < 3 ? 0.5 : 1;
      sh.servings = Math.max(0.25, Math.round((cur + step * Number(el.dataset.d)) * 100) / 100);
      renderSheet(); break;
    }
    case 'food-meal': sh.meal = el.dataset.v; renderSheet(); break;
    case 'food-save': {
      const servings = Math.max(0.01, num($sheet.querySelector('[data-serv]')?.value) || sh.servings);
      if (sh.entryId) {
        const list = entriesFor(sh.date);
        const i = list.findIndex((e) => e.id === sh.entryId);
        if (i >= 0) {
          const m = N.scaleFood(sh.food, servings);
          list[i] = { ...list[i], meal: sh.meal, servings, ...m };
        }
        toast('Updated');
      } else {
        addEntry(sh.meal, sh.food, servings);
        toast(`Added to ${MEALS.find((x) => x.id === sh.meal).label}`);
      }
      closeSheet(); commit(); break;
    }
    case 'edit-entry': {
      const e = entriesFor(ui.date).find((x) => x.id === el.dataset.id);
      if (!e) break;
      const food = { id: e.foodId, name: e.name, serving: e.serving, ...e.per };
      openSheet({ type: 'food', food, meal: e.meal, servings: e.servings, entryId: e.id, date: ui.date });
      break;
    }
    case 'entry-delete': {
      S.entries[sh.date] = entriesFor(sh.date).filter((e) => e.id !== sh.entryId);
      closeSheet(); commit(); toast('Removed'); break;
    }
    case 'custom-delete': {
      S.customFoods = S.customFoods.filter((f) => f.id !== el.dataset.id);
      S.recents = S.recents.filter((x) => x !== el.dataset.id);
      save(S); ui.tab = 'custom'; openSheet({ type: 'add', meal: sh.meal }); toast('Deleted'); break;
    }
    case 'sheet-quick': openSheet({ type: 'quick', meal: sh.meal }); break;
    case 'sheet-custom': openSheet({ type: 'custom', meal: sh.meal }); break;
    case 'weight': openSheet({ type: 'weight', date: ui.view === 'today' ? ui.date : todayISO() }); break;
    case 'weight-delete': delete S.weights[el.dataset.date]; closeSheet(); commit(); break;
    case 'range': ui.range = Number(el.dataset.v); render(); break;
    case 'checkin': runCheckin(); break;
    case 'checkin-apply': {
      const r = sh.result;
      S.targets = r.targets;
      S.profile.weightKg = r.currentKg;
      S.lastCheckin = todayISO();
      S.checkins.push({ date: todayISO(), kcalBefore: r.kcalBefore, kcalAfter: r.kcalAfter, actualKg: r.actualKg, expectedKg: r.expectedKg, currentKg: r.currentKg });
      closeSheet(); commit(); toast(r.delta ? 'Targets updated' : 'Targets unchanged'); break;
    }
    case 'sheet-targets': openSheet({ type: 'targets' }); break;
    case 'sheet-profile': openSheet({ type: 'profile' }); break;
    case 'sheet-import': openSheet({ type: 'import' }); break;
    case 'targets-recalc': S.targets = N.targetsFromProfile(S.profile); closeSheet(); commit(); toast('Recalculated'); break;
    case 'units': S.profile.units = el.dataset.v; commit(); break;
    case 'theme': localStorage.setItem('macrolog.theme', el.dataset.v); applyTheme(el.dataset.v); render(); break;
    case 'export': download(`macrolog-${todayISO()}.json`, exportJSON(S)); toast('Backup exported'); break;
    case 'import-apply': {
      const txt = $sheet.querySelector('[data-import-text]').value.trim();
      if (txt) { try { S = importJSON(txt); closeSheet(); commit(); toast('Imported'); } catch (e) { toast(e.message); } }
      else toast('Choose a file or paste the backup');
      break;
    }
    case 'reset': {
      if (confirm('Erase all data on this device? This cannot be undone.')) { reset(); S = load(); ui.onb = null; ui.view = 'today'; render(); }
      break;
    }
    case 'close': closeSheet(); break;

    // Onboarding
    case 'onb-set': {
      readOnbInputs();
      const { k, v } = el.dataset; const d = ui.onb.draft;
      d[k] = k === 'ratePct' ? Number(v) : v;
      if (k === 'goal') d.ratePct = N.GOALS[v].defaultRate;
      render(); break;
    }
    case 'onb-next': readOnbInputs(); ui.onb.step++; window.scrollTo(0, 0); render(); break;
    case 'onb-back': readOnbInputs(); ui.onb.step = Math.max(0, ui.onb.step - 1); render(); break;
    case 'onb-finish': {
      const d = ui.onb.draft;
      S.profile = { ...d };
      S.targets = N.targetsFromProfile(d);
      S.weights[todayISO()] = S.weights[todayISO()] ?? N.round1(d.weightKg);
      ui.onb = null; commit(); break;
    }
    default: break;
  }
});

document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.matches('[data-search]')) {
    ui.search = t.value;
    const box = $sheet.querySelector('[data-results]');
    if (box) box.innerHTML = resultsHTML(ui.sheet);
  } else if (t.matches('[data-serv]')) {
    const v = num(t.value);
    if (v > 0) { ui.sheet.servings = v; const f = ui.sheet.food; const m = N.scaleFood(f, v);
      const card = $sheet.querySelector('.card.flat .row');
      if (card) card.innerHTML = `<span style="font-size:28px;font-weight:800" class="num">${r0(m.kcal)} <span class="muted small" style="font-weight:600">kcal</span></span><span class="macroline"><span class="p">P <b>${m.protein}</b></span><span class="c">C <b>${m.carbs}</b></span><span class="f">F <b>${m.fat}</b></span></span>`; }
  } else if (t.closest('[data-form="targets"]')) {
    const f = t.closest('form');
    const out = f.querySelector('[data-macro-kcal]');
    if (out) out.textContent = N.macroCalories({ protein: num(f.protein.value), carbs: num(f.carbs.value), fat: num(f.fat.value) });
  }
});

document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.matches('[data-import-file]') && t.files?.[0]) {
    t.files[0].text().then((txt) => { S = importJSON(txt); closeSheet(); commit(); toast('Imported'); }).catch((e) => toast(e.message));
  }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  const kind = form.dataset.form; const sh = ui.sheet; const F = new FormData(form);
  const g = (k) => F.get(k);

  if (kind === 'quick') {
    const protein = num(g('protein')), carbs = num(g('carbs')), fat = num(g('fat'));
    const kcal = num(g('kcal')) || N.macroCalories({ protein, carbs, fat });
    if (!kcal && !protein && !carbs && !fat) { toast('Enter at least one value'); return; }
    const food = { id: 'quick', name: (g('name') || '').trim() || 'Quick add', serving: 'entry', kcal, protein, carbs, fat };
    addEntry(sh.meal, food, 1); closeSheet(); commit(); toast('Added');
  } else if (kind === 'custom') {
    const food = { id: 'custom-' + uid(), custom: true, name: g('name').trim(), serving: g('serving').trim(), kcal: num(g('kcal')), protein: num(g('protein')), carbs: num(g('carbs')), fat: num(g('fat')), tags: 'custom' };
    S.customFoods = [food, ...S.customFoods]; save(S);
    openSheet({ type: 'food', food, meal: sh.meal, servings: 1 }); toast('Food saved');
  } else if (kind === 'weight') {
    const kg = fromDisplayW(num(g('w')));
    if (!(kg > 20 && kg < 400)) { toast('That weight looks off'); return; }
    S.weights[g('date')] = Math.round(kg * 100) / 100;
    closeSheet(); commit(); toast('Weight saved');
  } else if (kind === 'targets') {
    const T = { kcal: r0(num(g('kcal'))), protein: r0(num(g('protein'))), carbs: r0(num(g('carbs'))), fat: r0(num(g('fat'))) };
    if (T.kcal < 800) { toast('Calories look too low'); return; }
    S.targets = T; closeSheet(); commit(); toast('Targets saved');
  } else if (kind === 'profile') {
    const p = { ...S.profile };
    p.sex = g('sex'); p.age = clamp(num(g('age')) || p.age, 13, 100);
    p.weightKg = fromDisplayW(num(g('weight'))) || p.weightKg;
    if (g('cm')) p.heightCm = num(g('cm')) || p.heightCm;
    else p.heightCm = N.inToCm(num(g('ft')) * 12 + num(g('in'))) || p.heightCm;
    p.activity = g('activity'); p.goal = g('goal'); p.ratePct = num(g('ratePct'));
    if (p.goal === 'maintain') p.ratePct = 0;
    S.profile = p;
    if (g('recalc')) S.targets = N.targetsFromProfile(p);
    closeSheet(); commit(); toast('Profile saved');
  }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.sheet) closeSheet(); });

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
applyTheme(localStorage.getItem('macrolog.theme') || 'auto');
render();
// Roll the date over if the app stays open past midnight.
setInterval(() => { const t = todayISO(); if (ui.date !== t && ui._autoDate !== false && fmtDate(ui.date) === 'Yesterday' && !ui.sheet) { ui.date = t; render(); } }, 60000);
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
