// Training UI: routines, active workout logging, history, records, import.
// Receives a context from app.js so it shares state, sheets and helpers.
import * as T from './training.js';
import * as EX from './exercises.js';
import * as N from './nutrition.js';

export function initTrain(ctx) {
  const { ui, esc, head, toast, openSheet, closeSheet, touch, bury, uid, todayISO, fmtShort } = ctx;
  const S = () => ctx.S();
  const custom = () => S().customExercises;
  const exById = (id) => EX.exerciseById(id, custom());

  /* ---------- units ---------- */
  const imperial = () => ctx.imperial();
  const wU = () => (imperial() ? 'lb' : 'kg');
  const toD = (kg) => { if (kg == null) return ''; const v = imperial() ? kg * T.LB_PER_KG : kg; const r = Math.round(v * 10) / 10; return String(r); };
  const fromD = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); if (!Number.isFinite(n)) return null; return imperial() ? Math.round((n / T.LB_PER_KG) * 1000) / 1000 : n; };
  const fmtSet = (s) => `${toD(s.w) || 0}×${s.r || 0}`;
  const fmtVol = (kg) => `${Math.round(imperial() ? kg * T.LB_PER_KG : kg).toLocaleString()} ${wU()}`;

  /* ---------- active workout ---------- */
  const active = () => S().activeWorkout;
  let saveTimer = null;
  function saveActive(syncDelay = 15000) { touch(S(), 'activeWorkout'); ctx.save(); ctx.scheduleSync(syncDelay); }
  function saveActiveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveActive(), 800); }

  function makeExercise(ex, setCount = 3, tpl = null) {
    const last = T.lastPerformance(S().workouts, ex.id);
    const prev = last ? last.sets.filter((s) => s.type !== 'warmup' && s.r > 0) : [];
    const sets = Array.from({ length: Math.max(1, setCount) }, (_, i) => {
      const p = prev[i] || prev[prev.length - 1] || null;
      return { id: uid(), w: null, r: null, type: 'normal', done: false, prevW: p ? p.w : null, prevR: p ? p.r : null };
    });
    return { key: uid(), exerciseId: ex.id, name: ex.name, restSec: tpl?.restSec || S().trainPrefs.restSec || 90, targetReps: tpl?.reps || '', sets, lastDate: last?.date || null, lastSummary: prev.length ? prev.map(fmtSet).join(', ') : null };
  }
  function startWorkout({ name = 'Workout', routineId = null, exercises = [] }) {
    const w = { id: uid(), name, routineId, startedAt: Date.now(), exercises };
    S().activeWorkout = w; saveActive(0);
    ui.view = 'workout'; ui.rest = null; ctx.render();
    return w;
  }
  function startFromRoutine(r) {
    const exercises = r.exercises.map((e) => makeExercise(exById(e.exerciseId) || { id: e.exerciseId, name: e.name }, e.sets || 3, e));
    startWorkout({ name: r.name, routineId: r.id, exercises });
  }
  function startFromWorkout(w) {
    const exercises = (w.exercises || []).map((e) => makeExercise(exById(e.exerciseId) || { id: e.exerciseId, name: e.name }, Math.max(1, e.sets.filter((s) => s.type !== 'warmup').length)));
    startWorkout({ name: w.name, routineId: w.routineId || null, exercises });
  }
  function findEx(key) { return (active()?.exercises || []).find((e) => e.key === key); }
  function findSet(key, setId) { return findEx(key)?.sets.find((s) => s.id === setId); }

  /* ---------- rest timer & elapsed ---------- */
  let tickTimer = null; let audio = null;
  function beep() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audio.currentTime;
      [0, 0.18].forEach((d) => { const o = audio.createOscillator(); const g = audio.createGain(); o.frequency.value = 880; o.connect(g); g.connect(audio.destination); g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.15); o.start(t0 + d); o.stop(t0 + d + 0.16); });
    } catch { /* no audio */ }
    try { navigator.vibrate?.([150, 80, 150]); } catch { /* ignore */ }
  }
  function primeAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch { /* ignore */ } }
  function startRest(sec) { ui.rest = { endsAt: Date.now() + sec * 1000, total: sec, rang: false }; updateRestBar(); }
  function restBarHTML() {
    const r = ui.rest; if (!r) return '';
    const left = Math.max(0, Math.ceil((r.endsAt - Date.now()) / 1000));
    return `<div class="restbar ${left <= 0 ? 'done' : ''}" data-restbar><div class="inner">
      <span class="time" data-rest-time>${left <= 0 ? 'Go!' : T.fmtDuration(left)}</span><span class="bar"><i data-rest-bar style="width:${Math.round((left / r.total) * 100)}%"></i></span>
      <button data-act="tr-rest-add">+30s</button><button data-act="tr-rest-skip">${left <= 0 ? 'OK' : 'Skip'}</button></div></div>`;
  }
  function updateRestBar() {
    const host = document.querySelector('[data-restbar]');
    const html = restBarHTML();
    if (!host) { if (html) document.getElementById('app')?.insertAdjacentHTML('beforeend', html); return; }
    if (!html) { host.remove(); return; }
    const r = ui.rest; const left = Math.max(0, Math.ceil((r.endsAt - Date.now()) / 1000));
    host.classList.toggle('done', left <= 0);
    host.querySelector('[data-rest-time]').textContent = left <= 0 ? 'Go!' : T.fmtDuration(left);
    host.querySelector('[data-rest-bar]').style.width = `${Math.round((left / r.total) * 100)}%`;
    host.querySelector('[data-act=tr-rest-skip]').textContent = left <= 0 ? 'OK' : 'Skip';
    if (left <= 0 && !r.rang) { r.rang = true; beep(); setTimeout(() => { if (ui.rest === r) { ui.rest = null; updateRestBar(); } }, 8000); }
  }
  function tick() {
    const w = active();
    const el = document.querySelector('[data-elapsed]');
    if (el && w) el.textContent = T.fmtDuration(Math.floor((Date.now() - w.startedAt) / 1000));
    if (ui.rest) updateRestBar();
  }
  function afterRender() {
    clearInterval(tickTimer);
    if (ui.view === 'workout' && active()) { tickTimer = setInterval(tick, 1000); tick(); if (ui.rest) updateRestBar(); }
    else if (ui.rest && ui.view !== 'workout') updateRestBar();
  }

  /* ---------- Train view ---------- */
  function routineLastDone(r) {
    const ws = Object.values(S().workouts).filter((w) => w.routineId === r.id);
    return ws.length ? ws.sort((a, b) => b.startedAt - a.startedAt)[0].date : null;
  }
  function renderTrain() {
    const w = active();
    const routines = Object.values(S().routines).sort((a, b) => a.name.localeCompare(b.name));
    const history = Object.values(S().workouts).sort((a, b) => b.startedAt - a.startedAt).slice(0, 10);
    const weeks = T.workoutsPerWeek(S().workouts, 1);
    return `
      <header class="header"><div><h1>Train</h1><div class="sub">${weeks[0].count} workout${weeks[0].count === 1 ? '' : 's'} this week</div></div></header>
      ${w ? `<button class="bigstart" data-act="tr-resume"><span><div class="t">Resume ${esc(w.name)}</div><div class="s">${T.fmtDuration(Math.floor((Date.now() - w.startedAt) / 1000))} · ${(w.exercises || []).reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)} sets done</div></span><span style="font-size:22px">›</span></button>`
        : `<button class="bigstart" data-act="tr-start-empty"><span><div class="t">Start empty workout</div><div class="s">Pick exercises as you go</div></span><span style="font-size:26px">+</span></button>`}
      <section class="card" style="padding:0">
        <div class="meal-head"><div class="t">Routines</div><button class="meal-add" data-act="tr-routine-new" aria-label="New routine">+</button></div>
        ${routines.length ? routines.map((r) => { const last = routineLastDone(r); return `<div class="routine" style="border-top:1px solid var(--line)">
          <div class="row"><div><div class="t">${esc(r.name)}</div><div class="s">${r.exercises.length} exercise${r.exercises.length === 1 ? '' : 's'} · ${r.exercises.map((e) => e.name.split(' - ')[0]).slice(0, 3).map(esc).join(', ')}${r.exercises.length > 3 ? '…' : ''}${last ? ` · last ${fmtShort(last)}` : ''}</div></div></div>
          <div class="actions"><button class="btn primary sm" data-act="tr-routine-start" data-id="${r.id}" ${w ? 'disabled' : ''}>Start</button><button class="btn secondary sm" data-act="tr-routine-edit" data-id="${r.id}">Edit</button></div></div>`; }).join('')
        : `<div class="empty">No routines yet. Create one, or finish a workout and save it as a routine.</div>`}
      </section>
      <section class="card">
        <div class="row" style="margin-bottom:6px"><div class="card-title" style="margin:0">History</div><button class="btn secondary sm" data-act="tr-import">Import CSV</button></div>
        ${history.length ? history.map((h) => { const s = T.workoutSummary(h); return `<button class="histrow" data-act="tr-wo-view" data-id="${h.id}">
            <span><div class="n">${esc(h.name)}${h.prs?.length ? ` <span class="badge" style="background:rgba(245,158,11,.14);color:var(--carbs)">${h.prs.length} PR</span>` : ''}</div><div class="s">${fmtShort(h.date)} · ${T.fmtDuration(s.durationSec)} · ${s.sets} sets · ${fmtVol(s.volume)}</div></span><span class="chev muted">›</span></button>`; }).join('')
        : `<p class="muted small" style="padding:8px 0">Finished workouts show up here. Already use Hevy, Strong or Fitbod? Import their CSV export to bring your history along.</p>`}
      </section>
      <section class="card row">
        <div><div style="font-weight:700">Exercise library</div><div class="small muted">Records, trends and instructions</div></div>
        <button class="btn secondary sm" data-act="tr-browse">Browse</button>
      </section>`;
  }

  /* ---------- Workout view ---------- */
  function renderWorkout() {
    const w = active();
    if (!w) { ui.view = 'train'; return renderTrain(); }
    const blocks = w.exercises.map((ex) => {
      let n = 0;
      const rows = ex.sets.map((s) => {
        const label = s.type === 'warmup' ? 'W' : String(++n);
        return `<div class="setgrid setrow ${s.done ? 'done' : ''}" data-set="${s.id}">
          <button class="num-badge ${s.type === 'warmup' ? 'w' : ''}" data-act="tr-set-menu" data-key="${ex.key}" data-set="${s.id}" aria-label="Set options">${label}</button>
          <span class="prevcell">${s.prevW != null ? `${toD(s.prevW)}×${s.prevR}` : '–'}</span>
          <input class="num" inputmode="decimal" data-tr-w data-key="${ex.key}" data-set="${s.id}" value="${s.w != null ? toD(s.w) : ''}" placeholder="${s.prevW != null ? toD(s.prevW) : '–'}" aria-label="Weight" />
          <input class="num" inputmode="numeric" data-tr-r data-key="${ex.key}" data-set="${s.id}" value="${s.r != null ? s.r : ''}" placeholder="${s.prevR != null ? s.prevR : (ex.targetReps || '–')}" aria-label="Reps" />
          <button class="check" data-act="tr-set-done" data-key="${ex.key}" data-set="${s.id}" aria-label="Complete set">✓</button></div>`;
      }).join('');
      return `<section class="card exblock" data-ex="${ex.key}">
        <div class="exname"><button style="text-align:left;font:inherit;color:inherit" data-act="tr-ex-info" data-id="${esc(ex.exerciseId)}">${esc(ex.name)}</button><button data-act="tr-ex-menu" data-key="${ex.key}" aria-label="Exercise options">⋯</button></div>
        <div class="prev">${ex.lastSummary ? `Last time: ${esc(ex.lastSummary)} · ${fmtShort(ex.lastDate)}` : 'First time logging this one'}${ex.targetReps ? ` · target ${esc(ex.targetReps)} reps` : ''}</div>
        <div class="setgrid head"><span>Set</span><span>Prev</span><span>${wU()}</span><span>Reps</span><span></span></div>
        ${rows}
        <button class="addset" data-act="tr-add-set" data-key="${ex.key}">+ Add set</button>
      </section>`;
    }).join('');
    return `
      <div class="wo-head">
        <div class="row" style="gap:10px"><button class="close" data-act="tr-back" aria-label="Back">‹</button>
          <div><button class="t" style="font:inherit;color:inherit;text-align:left" data-act="tr-rename">${esc(w.name)}</button><div class="elapsed" data-elapsed>0:00</div></div></div>
        <button class="btn primary sm" data-act="tr-finish">Finish</button>
      </div>
      ${blocks || `<section class="card"><p class="muted small">Add your first exercise to get going.</p></section>`}
      <button class="btn secondary" data-act="tr-add-ex">+ Add exercise</button>
      <button class="btn ghost" style="margin-top:6px;color:var(--danger)" data-act="tr-cancel">Discard workout</button>
      <div style="height:80px"></div>
      ${restBarHTML()}`;
  }

  /* ---------- Sheets ---------- */
  const isTall = (sh) => ['tr-pick', 'tr-routine', 'tr-ex', 'tr-wo', 'tr-import'].includes(sh.type);

  function sheetHTML(sh) {
    switch (sh.type) {
      case 'tr-pick': return sheetPick(sh);
      case 'tr-ex': return sheetExercise(sh);
      case 'tr-wo': return sheetWorkout(sh);
      case 'tr-finish': return sheetFinish(sh);
      case 'tr-routine': return sheetRoutine(sh);
      case 'tr-import': return sheetImport(sh);
      case 'tr-custom': return sheetCustom(sh);
      case 'tr-set-menu': return sheetSetMenu(sh);
      case 'tr-ex-menu': return sheetExMenu(sh);
      default: return '';
    }
  }

  function pickRows(sh) {
    if (!EX.exercisesLoaded()) { EX.loadExercises().then(() => { if (ui.sheet === sh) refreshPick(); }).catch(() => toast('Could not load the exercise library')); return `<p class="muted small" style="padding:20px 0;text-align:center">Loading exercises…</p>`; }
    const list = EX.searchExercises(sh.q || '', { custom: custom(), group: sh.group || null, limit: 80 });
    if (!list.length) return `<p class="muted small" style="padding:20px 0;text-align:center">No match. Try another word, or create it.</p>`;
    return list.map((e) => {
      const sel = sh.selected?.has(e.id);
      const sub = [EX.EQUIPMENT_LABEL[e.equipment] || e.equipment, ...(e.primary || []).slice(0, 2).map((m) => EX.MUSCLE_LABEL[m] || m)].filter(Boolean).join(' · ');
      return `<button class="exrow ${sel ? 'sel' : ''}" data-act="${sh.mode === 'browse' ? 'tr-ex-info' : 'tr-pick-toggle'}" data-id="${esc(e.id)}">
        <span><div class="n">${esc(e.name)}${e.custom ? ' <span class="badge">Custom</span>' : ''}</div><div class="s">${esc(sub)}</div></span>
        <span class="${sh.mode === 'browse' ? 'chev muted' : 'pick'}">${sh.mode === 'browse' ? '›' : (sel ? '✓' : '')}</span></button>`;
    }).join('');
  }
  function refreshPick() { const box = document.querySelector('[data-tr-results]'); if (box && ui.sheet?.type === 'tr-pick') box.innerHTML = pickRows(ui.sheet); const btn = document.querySelector('[data-act=tr-pick-done]'); if (btn) { const n = ui.sheet.selected.size; btn.disabled = !n; btn.textContent = n ? `Add ${n} exercise${n === 1 ? '' : 's'}` : 'Select exercises'; } }
  function sheetPick(sh) {
    sh.selected = sh.selected || new Set();
    const chips = [['', 'All'], ...EX.GROUPS.filter((g) => g !== 'other').map((g) => [g, EX.GROUP_LABEL[g]])].map(([g, l]) => `<button class="chip ${(sh.group || '') === g ? 'on' : ''}" data-act="tr-pick-group" data-g="${g}">${l}</button>`).join('');
    return `${head(sh.mode === 'browse' ? 'Exercises' : 'Add exercises')}
      <div class="search"><input class="input" type="search" placeholder="Search exercises" value="${esc(sh.q || '')}" data-tr-search autocomplete="off" autocorrect="off" autofocus />
        <div class="chips" style="margin-top:10px">${chips}</div></div>
      <div class="results" data-tr-results>${pickRows(sh)}</div>
      <div class="row" style="gap:8px;padding-top:12px">
        ${sh.mode === 'browse' ? '' : `<button class="btn primary" data-act="tr-pick-done" ${sh.selected.size ? '' : 'disabled'}>${sh.selected.size ? `Add ${sh.selected.size} exercise${sh.selected.size === 1 ? '' : 's'}` : 'Select exercises'}</button>`}
        <button class="btn secondary" data-act="tr-custom-new" style="${sh.mode === 'browse' ? '' : 'width:auto'}">Create exercise</button>
      </div>`;
  }

  function lineChart(pts, key, unitLabel) {
    if (pts.length < 2) return '';
    const W = 320, H = 120, px = 8, py = 12;
    const vals = pts.map((p) => p[key]);
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max(1, (hi - lo) * 0.15); lo -= pad; hi += pad;
    const x = (i) => px + (i / (pts.length - 1)) * (W - 2 * px);
    const y = (v) => py + (1 - (v - lo) / (hi - lo)) * (H - 2 * py);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
    const dots = pts.map((p, i) => `<circle class="raw" cx="${x(i).toFixed(1)}" cy="${y(p[key]).toFixed(1)}" r="3" style="fill:var(--accent);opacity:1"/>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${unitLabel} trend"><path class="trend" d="${path}"/>${dots}
      <text class="axis" x="${px}" y="${H - 2}">${fmtShort(pts[0].date)}</text><text class="axis" x="${W - px}" y="${H - 2}" text-anchor="end">${fmtShort(pts[pts.length - 1].date)}</text>
      <text class="axis" x="${W - px}" y="10" text-anchor="end">${toD(hi - pad)} ${wU()}</text></svg>`;
  }
  function sheetExercise(sh) {
    const e = exById(sh.id) || { id: sh.id, name: sh.name || 'Exercise', primary: [], equipment: '' };
    const bests = T.exerciseBests(S().workouts, e.id);
    const hist = T.e1rmHistory(S().workouts, e.id, 20);
    const recent = Object.values(S().workouts).filter((w) => w.exercises.some((x) => x.exerciseId === e.id)).sort((a, b) => b.startedAt - a.startedAt).slice(0, 5);
    if (!sh.instructions && !e.custom) EX.loadInstructions(e.id).then((ins) => { if (ui.sheet === sh) { sh.instructions = ins || []; ctx.renderSheet(); } });
    const chips = [EX.EQUIPMENT_LABEL[e.equipment] || e.equipment, ...(e.primary || []).map((m) => EX.MUSCLE_LABEL[m] || m)].filter(Boolean).map((t) => `<span class="pill">${esc(t)}</span>`).join(' ');
    return `${head(esc(e.name))}
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin:-4px 0 14px">${chips}${e.custom ? '<span class="pill accent">Custom</span>' : ''}</div>
      <div class="stat3" style="margin:0 0 14px">
        <div><div class="v num">${bests.best1rm ? toD(bests.best1rm) : '–'}</div><div class="k">Est. 1RM ${wU()}</div></div>
        <div><div class="v num">${bests.bestW ? toD(bests.bestW) : '–'}</div><div class="k">Heaviest</div></div>
        <div><div class="v num">${bests.sessions}</div><div class="k">Sessions</div></div></div>
      ${hist.length >= 2 ? `<div class="card flat" style="margin-bottom:14px"><div class="card-title">Estimated 1RM</div>${lineChart(hist, 'e1rm', '1RM')}</div>` : ''}
      ${recent.length ? `<div class="card-title">Recent</div>${recent.map((w) => { const x = w.exercises.find((q) => q.exerciseId === e.id); return `<div class="row small" style="padding:8px 0;border-top:1px solid var(--line)"><span class="muted">${fmtShort(w.date)}</span><span class="num">${x.sets.filter((s) => s.done).map(fmtSet).join(' · ')}</span></div>`; }).join('')}` : `<p class="muted small">No sessions logged yet.</p>`}
      ${sh.instructions?.length ? `<div class="card-title" style="margin-top:16px">How to</div><ol class="instructions">${(sh.showAll ? sh.instructions : sh.instructions.slice(0, 4)).map((t) => `<li>${esc(t)}</li>`).join('')}</ol>${sh.instructions.length > 4 && !sh.showAll ? `<button class="btn ghost sm" data-act="tr-ex-more">Show all ${sh.instructions.length} steps</button>` : ''}` : ''}
      <div style="height:8px"></div>
      ${active() ? `<button class="btn primary" data-act="tr-ex-add-active" data-id="${esc(e.id)}">Add to current workout</button>` : ''}
      ${e.custom ? `<button class="btn ghost" style="color:var(--danger)" data-act="tr-custom-delete" data-id="${esc(e.id)}">Delete custom exercise</button>` : ''}`;
  }

  function sheetWorkout(sh) {
    const w = S().workouts[sh.id]; if (!w) return `${head('Workout')}<p>Not found.</p>`;
    const s = T.workoutSummary(w);
    return `${head(esc(w.name))}
      <p class="muted small" style="margin:-6px 0 12px">${N.parseISODate(w.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      <div class="stat3" style="margin:0 0 14px"><div><div class="v num">${T.fmtDuration(s.durationSec)}</div><div class="k">Duration</div></div><div><div class="v num">${s.sets}</div><div class="k">Sets</div></div><div><div class="v num">${Math.round(imperial() ? s.volume * T.LB_PER_KG : s.volume).toLocaleString()}</div><div class="k">Volume ${wU()}</div></div></div>
      ${w.prs?.length ? `<div style="margin-bottom:10px">${w.prs.map((p) => `<span class="prchip">🏆 ${esc(p.name.split(' - ')[0])} · ${p.type === '1rm' ? `${toD(p.value)} est. 1RM` : `${toD(p.value)} ${wU()}`}</span>`).join('')}</div>` : ''}
      ${w.exercises.map((ex) => `<div style="padding:10px 0;border-top:1px solid var(--line)"><div style="font-weight:700">${esc(ex.name)}</div><div class="small muted num">${ex.sets.filter((x) => x.done).map((x) => (x.type === 'warmup' ? `(${fmtSet(x)})` : fmtSet(x))).join(' · ')}</div></div>`).join('')}
      <div style="height:10px"></div>
      <button class="btn primary" data-act="tr-repeat" data-id="${w.id}" ${active() ? 'disabled' : ''}>Repeat this workout</button>
      <button class="btn secondary" style="margin-top:8px" data-act="tr-save-routine" data-id="${w.id}">Save as routine</button>
      <button class="btn ghost" style="margin-top:4px;color:var(--danger)" data-act="tr-wo-delete" data-id="${w.id}">Delete workout</button>`;
  }

  function cleanedActive() {
    const w = active(); if (!w) return null;
    const exercises = w.exercises.map((ex) => ({ exerciseId: ex.exerciseId, name: ex.name, restSec: ex.restSec, sets: ex.sets.filter((s) => s.done && s.r > 0).map(({ id, w: ww, r, type }) => ({ id, w: ww || 0, r, type, done: true })) })).filter((ex) => ex.sets.length);
    return { id: w.id, name: w.name, routineId: w.routineId || null, date: N.toISODate(new Date(w.startedAt)), startedAt: w.startedAt, endedAt: Date.now(), exercises };
  }
  function routineChanged(w) {
    const r = w.routineId && S().routines[w.routineId]; if (!r) return false;
    const a = r.exercises.map((e) => `${e.exerciseId}:${e.sets}`).join('|');
    const b = active().exercises.map((e) => `${e.exerciseId}:${e.sets.filter((s) => s.type !== 'warmup').length}`).join('|');
    return a !== b;
  }
  function sheetFinish(sh) {
    const c = cleanedActive(); const s = T.workoutSummary(c);
    const prs = T.detectPRs({ ...S().workouts, [c.id]: c }, c); sh.prs = prs;
    const changed = routineChanged(c);
    return `${head('Finish workout')}
      <div class="stat3" style="margin:0 0 14px"><div><div class="v num">${T.fmtDuration(s.durationSec)}</div><div class="k">Duration</div></div><div><div class="v num">${s.sets}</div><div class="k">Sets</div></div><div><div class="v num">${Math.round(imperial() ? s.volume * T.LB_PER_KG : s.volume).toLocaleString()}</div><div class="k">Volume ${wU()}</div></div></div>
      ${prs.length ? `<div class="card-title">New records</div><div style="margin-bottom:12px">${prs.map((p) => `<span class="prchip">🏆 ${esc(p.name.split(' - ')[0])} · ${p.type === '1rm' ? `${toD(p.value)} est. 1RM` : `${toD(p.value)} ${wU()}`}</span>`).join('')}</div>` : ''}
      ${!s.sets ? `<p class="small" style="color:var(--carbs);margin-bottom:12px">No completed sets yet. Tick the ✓ on each set you did, or discard the workout.</p>` : ''}
      ${changed ? `<label class="row small" style="margin-bottom:14px"><span>Update routine “${esc(S().routines[c.routineId].name)}” with today's exercises and set counts</span><input type="checkbox" data-tr-update-routine checked style="width:20px;height:20px" /></label>` : ''}
      ${!c.routineId && s.sets ? `<label class="row small" style="margin-bottom:14px"><span>Also save as a routine</span><input type="checkbox" data-tr-make-routine style="width:20px;height:20px" /></label>` : ''}
      <button class="btn primary" data-act="tr-finish-save" ${s.sets ? '' : 'disabled'}>Save workout</button>
      <button class="btn ghost" style="margin-top:6px" data-act="close">Keep going</button>`;
  }

  function sheetRoutine(sh) {
    const d = sh.draft;
    const rows = d.exercises.map((e, i) => `<div style="padding:10px 0;border-top:1px solid var(--line)">
      <div class="row"><div style="font-weight:700">${esc(e.name)}</div><div class="row" style="gap:4px"><button class="close" data-act="tr-r-move" data-i="${i}" data-d="-1" aria-label="Move up">↑</button><button class="close" data-act="tr-r-move" data-i="${i}" data-d="1" aria-label="Move down">↓</button><button class="close" data-act="tr-r-remove" data-i="${i}" aria-label="Remove">✕</button></div></div>
      <div class="input-row three" style="margin-top:8px">
        <label class="field" style="margin:0"><span>Sets</span><input class="input num" inputmode="numeric" data-tr-rsets="${i}" value="${e.sets}" /></label>
        <label class="field" style="margin:0"><span>Reps</span><input class="input" data-tr-rreps="${i}" value="${esc(e.reps || '')}" placeholder="8-12" /></label>
        <label class="field" style="margin:0"><span>Rest</span><select class="input" data-tr-rrest="${i}">${[45, 60, 90, 120, 150, 180, 240].map((v) => `<option value="${v}" ${(e.restSec || 90) === v ? 'selected' : ''}>${v}s</option>`).join('')}</select></label>
      </div></div>`).join('');
    return `${head(d.id in S().routines ? 'Edit routine' : 'New routine')}
      <label class="field"><span>Name</span><input class="input" data-tr-rname value="${esc(d.name)}" placeholder="e.g. Push day" /></label>
      <div class="results">${rows || `<p class="muted small" style="padding:10px 0">Add the exercises for this routine.</p>`}</div>
      <button class="btn secondary" style="margin-top:10px" data-act="tr-r-add">+ Add exercises</button>
      <button class="btn primary" style="margin-top:8px" data-act="tr-routine-save">Save routine</button>
      ${d.id in S().routines ? `<button class="btn ghost" style="margin-top:4px;color:var(--danger)" data-act="tr-routine-delete" data-id="${d.id}">Delete routine</button>` : ''}`;
  }

  function sheetImport(sh) {
    const p = sh.preview;
    return `${head('Import workouts')}
      <p class="small muted" style="margin:-6px 0 12px">Choose a CSV export from <b>Hevy</b> (Settings → Export), <b>Strong</b> or <b>Fitbod</b>. Exercises are matched to the library; unknown names become custom exercises. Importing the same file twice does not duplicate.</p>
      <input class="input" type="file" accept=".csv,text/csv" data-tr-import-file />
      <p class="small muted" style="margin:12px 0 6px">…or paste the CSV:</p>
      <textarea class="input" rows="4" data-tr-import-text placeholder="title,start_time,…"></textarea>
      <button class="btn secondary" style="margin-top:10px" data-act="tr-import-parse">Preview</button>
      ${p ? `<div class="card flat" style="margin-top:12px"><div class="card-title">${esc(p.kind)} export</div>
        <div class="row small"><span>Workouts</span><b>${p.workouts.length}</b></div>
        <div class="row small"><span>Already imported</span><b>${p.dupes}</b></div>
        <div class="row small"><span>Exercises matched</span><b>${p.matched}</b></div>
        <div class="row small"><span>New custom exercises</span><b>${p.created.length}</b></div>
        ${p.created.length ? `<p class="tiny muted" style="margin-top:6px">${p.created.slice(0, 8).map(esc).join(', ')}${p.created.length > 8 ? '…' : ''}</p>` : ''}
        ${p.error ? `<p class="small" style="color:var(--danger)">${esc(p.error)}</p>` : ''}
        <button class="btn primary" style="margin-top:10px" data-act="tr-import-apply" ${p.workouts.length - p.dupes > 0 ? '' : 'disabled'}>Import ${p.workouts.length - p.dupes} workout${p.workouts.length - p.dupes === 1 ? '' : 's'}</button></div>` : ''}`;
  }

  function sheetCustom(sh) {
    return `${head('Create exercise')}
      <form data-form="tr-custom">
        <label class="field"><span>Name</span><input class="input" name="name" required placeholder="e.g. Belt squat" value="${esc(sh.name || '')}" autofocus /></label>
        <div class="input-row">
          <label class="field"><span>Equipment</span><select class="input" name="equipment">${EX.EQUIPMENT.map((q) => `<option value="${q}">${EX.EQUIPMENT_LABEL[q]}</option>`).join('')}</select></label>
          <label class="field"><span>Muscle group</span><select class="input" name="group">${EX.GROUPS.map((g) => `<option value="${g}">${EX.GROUP_LABEL[g]}</option>`).join('')}</select></label>
        </div>
        <button class="btn primary" type="submit">Save exercise</button>
      </form>`;
  }

  function sheetSetMenu(sh) {
    const s = findSet(sh.key, sh.set); if (!s) return head('Set');
    return `${head('Set options')}
      <button class="btn secondary" data-act="tr-set-type" data-key="${sh.key}" data-set="${sh.set}">${s.type === 'warmup' ? 'Mark as working set' : 'Mark as warm-up'}</button>
      <button class="btn danger" style="margin-top:8px" data-act="tr-set-delete" data-key="${sh.key}" data-set="${sh.set}">Delete set</button>`;
  }
  function sheetExMenu(sh) {
    const ex = findEx(sh.key); if (!ex) return head('Exercise');
    return `${head(esc(ex.name))}
      <div class="field"><span>Rest timer for this exercise</span><div class="seg">${[60, 90, 120, 180].map((v) => `<button class="${ex.restSec === v ? 'on' : ''}" data-act="tr-ex-rest" data-key="${sh.key}" data-v="${v}">${v}s</button>`).join('')}</div></div>
      <button class="btn secondary" data-act="tr-ex-info" data-id="${esc(ex.exerciseId)}">Records & instructions</button>
      <button class="btn danger" style="margin-top:8px" data-act="tr-ex-remove" data-key="${sh.key}">Remove from workout</button>`;
  }

  /* ---------- Trends card ---------- */
  function trendsCardHTML() {
    const ws = S().workouts; const t = todayISO();
    const byMuscle = T.setsByMuscle(ws, (id) => exById(id), N.addDays(t, -6), t);
    const weeks = T.workoutsPerWeek(ws, 8);
    const max = Math.max(1, ...Object.values(byMuscle));
    const order = EX.GROUPS.filter((g) => byMuscle[g]);
    if (!Object.keys(ws).length) return '';
    return `<section class="card"><div class="card-title">Training · last 7 days</div>
      ${order.length ? `<div class="volbars">${order.map((g) => `<div class="row"><span class="small" style="width:90px">${EX.GROUP_LABEL[g]}</span><span class="bar" style="flex:1"><i style="width:${Math.round((byMuscle[g] / max) * 100)}%"></i></span><b class="small num" style="width:52px;text-align:right">${byMuscle[g]} set${byMuscle[g] === 1 ? '' : 's'}</b></div>`).join('')}</div>` : `<p class="muted small">No sets this week yet.</p>`}
      <div class="card-title" style="margin-top:14px">Workouts per week</div>
      <div style="display:flex;gap:6px;align-items:flex-end;height:60px">${weeks.map((w) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end"><div style="width:100%;border-radius:6px;background:var(--accent);opacity:${w.count ? .9 : .15};height:${Math.max(6, (w.count / Math.max(1, ...weeks.map((x) => x.count))) * 44)}px"></div><span class="tiny muted">${w.count}</span></div>`).join('')}</div></section>`;
  }

  /* ---------- actions ---------- */
  function openPicker(mode, extra = {}) { openSheet({ type: 'tr-pick', mode, q: '', group: '', selected: new Set(), ...extra }); if (!EX.exercisesLoaded()) EX.loadExercises().then(() => refreshPick()).catch(() => {}); }
  function addExercisesToActive(ids) {
    const w = active(); if (!w) return;
    for (const id of ids) { const e = exById(id); if (e) w.exercises.push(makeExercise(e, 3)); }
    saveActive(0);
  }
  function finalizeWorkout({ updateRoutine, makeRoutine }) {
    const c = cleanedActive(); if (!c || !c.exercises.length) { toast('Nothing to save yet'); return; }
    c.prs = T.detectPRs({ ...S().workouts, [c.id]: c }, c).map(({ exerciseId, name, type, value }) => ({ exerciseId, name, type, value }));
    S().workouts[c.id] = c; touch(S(), 'workouts', c.id);
    // Routine templates mirror the whole workout as planned (all exercises, working-set rows), not just what got ticked.
    const planned = active();
    const routineOf = (w) => w.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, sets: Math.max(1, e.sets.filter((s) => s.type !== 'warmup').length), reps: e.targetReps || '', restSec: e.restSec || 90 }));
    if (updateRoutine && c.routineId && S().routines[c.routineId]) { S().routines[c.routineId].exercises = routineOf(planned); touch(S(), 'routines', c.routineId); }
    if (makeRoutine) { const id = uid(); S().routines[id] = { id, name: c.name, exercises: routineOf(planned) }; touch(S(), 'routines', id); }
    S().activeWorkout = null; touch(S(), 'activeWorkout');
    ui.rest = null; ui.view = 'train';
    closeSheet(); ctx.commit();
    toast(c.prs.length ? `Saved · ${c.prs.length} new record${c.prs.length === 1 ? '' : 's'} 🏆` : 'Workout saved');
  }
  function routineDraftFrom(r) { return r ? JSON.parse(JSON.stringify(r)) : { id: uid(), name: '', exercises: [] }; }
  function readRoutineDraft(sh) {
    const d = sh.draft; const q = (sel) => document.querySelector(sel);
    const nm = q('[data-tr-rname]'); if (nm) d.name = nm.value.trim();
    d.exercises.forEach((e, i) => {
      const s = q(`[data-tr-rsets="${i}"]`), r = q(`[data-tr-rreps="${i}"]`), rs = q(`[data-tr-rrest="${i}"]`);
      if (s) e.sets = Math.max(1, Math.min(12, parseInt(s.value, 10) || 3));
      if (r) e.reps = r.value.trim();
      if (rs) e.restSec = Number(rs.value) || 90;
    });
  }
  function parseImport(text, sh) {
    try {
      const { kind, workouts } = T.importCSV(text, { makeId: uid });
      const created = new Set(); let matched = 0, dupes = 0;
      const customList = [...custom()];
      const pending = [];
      for (const w of workouts) {
        w.id = `imp-${kind}-${w.startedAt}`;
        if (S().workouts[w.id]) { dupes++; continue; }
        for (const ex of w.exercises) {
          const m = EX.matchImportedName(ex.name, customList, T.normalizeExerciseName);
          if (m) { ex.exerciseId = m.id; ex.name = m.name; matched++; }
          else {
            let c = customList.find((x) => x.name.toLowerCase() === ex.name.toLowerCase());
            if (!c) { c = { id: 'cx-' + uid(), name: ex.name, equipment: 'other', primary: [], groups: ['other'] }; customList.push(c); pending.push(c); created.add(ex.name); }
            ex.exerciseId = c.id;
          }
        }
      }
      sh.preview = { kind, workouts, dupes, matched, created: [...created], pendingCustom: pending, error: null };
    } catch (e) {
      sh.preview = { kind: '?', workouts: [], dupes: 0, matched: 0, created: [], pendingCustom: [], error: e.message };
    }
    ctx.renderSheet();
  }
  function applyImport(sh) {
    const p = sh.preview; if (!p) return;
    for (const c of p.pendingCustom) { S().customExercises.push(c); touch(S(), 'customExercises', c.id); }
    let n = 0;
    for (const w of p.workouts) { if (S().workouts[w.id]) continue; delete w.source; S().workouts[w.id] = w; touch(S(), 'workouts', w.id); n++; }
    closeSheet(); ctx.commit(); toast(`Imported ${n} workout${n === 1 ? '' : 's'}`);
  }

  function onAction(act, el) {
    const sh = ui.sheet; const w = active();
    switch (act) {
      case 'tr-start-empty': startWorkout({}); openPicker('workout'); break;
      case 'tr-resume': ui.view = 'workout'; ctx.render(); break;
      case 'tr-back': ui.view = 'train'; ctx.render(); break;
      case 'tr-routine-start': { const r = S().routines[el.dataset.id]; if (r && !w) { EX.loadExercises().catch(() => {}); startFromRoutine(r); } break; }
      case 'tr-routine-new': openSheet({ type: 'tr-routine', draft: routineDraftFrom(null) }); break;
      case 'tr-routine-edit': openSheet({ type: 'tr-routine', draft: routineDraftFrom(S().routines[el.dataset.id]) }); break;
      case 'tr-r-add': readRoutineDraft(sh); openPicker('routine', { returnTo: sh }); break;
      case 'tr-r-move': { readRoutineDraft(sh); const i = Number(el.dataset.i), d = Number(el.dataset.d), arr = sh.draft.exercises; const j = i + d; if (j >= 0 && j < arr.length) { [arr[i], arr[j]] = [arr[j], arr[i]]; } ctx.renderSheet(); break; }
      case 'tr-r-remove': readRoutineDraft(sh); sh.draft.exercises.splice(Number(el.dataset.i), 1); ctx.renderSheet(); break;
      case 'tr-routine-save': {
        readRoutineDraft(sh); const d = sh.draft;
        if (!d.name) { toast('Give the routine a name'); return; }
        if (!d.exercises.length) { toast('Add at least one exercise'); return; }
        S().routines[d.id] = d; touch(S(), 'routines', d.id); closeSheet(); ctx.commit(); toast('Routine saved'); break;
      }
      case 'tr-routine-delete': if (confirm('Delete this routine? Past workouts are kept.')) { delete S().routines[el.dataset.id]; bury(S(), 'routines', el.dataset.id); closeSheet(); ctx.commit(); } break;
      case 'tr-add-ex': openPicker('workout'); break;
      case 'tr-browse': openPicker('browse'); break;
      case 'tr-pick-group': sh.group = el.dataset.g; refreshPick(); document.querySelectorAll('[data-act=tr-pick-group]').forEach((b) => b.classList.toggle('on', b.dataset.g === sh.group)); break;
      case 'tr-pick-toggle': { const id = el.dataset.id; if (sh.selected.has(id)) sh.selected.delete(id); else sh.selected.add(id); refreshPick(); break; }
      case 'tr-pick-done': {
        const ids = [...sh.selected]; if (!ids.length) return;
        if (sh.mode === 'workout') { addExercisesToActive(ids); closeSheet(); ctx.render(); }
        else if (sh.mode === 'routine') { const back = sh.returnTo; for (const id of ids) { const e = exById(id); if (e) back.draft.exercises.push({ exerciseId: e.id, name: e.name, sets: 3, reps: '', restSec: S().trainPrefs.restSec || 90 }); } openSheet(back); }
        break;
      }
      case 'tr-custom-new': openSheet({ type: 'tr-custom', returnTo: sh, name: sh?.q || '' }); break;
      case 'tr-custom-delete': {
        const id = el.dataset.id; S().customExercises = S().customExercises.filter((c) => c.id !== id); bury(S(), 'customExercises', id); closeSheet(); ctx.commit(); toast('Deleted'); break;
      }
      case 'tr-ex-info': openSheet({ type: 'tr-ex', id: el.dataset.id, back: sh }); break;
      case 'tr-ex-more': sh.showAll = true; ctx.renderSheet(); break;
      case 'tr-ex-add-active': addExercisesToActive([el.dataset.id]); closeSheet(); ui.view = 'workout'; ctx.render(); toast('Added'); break;
      case 'tr-ex-menu': openSheet({ type: 'tr-ex-menu', key: el.dataset.key }); break;
      case 'tr-ex-rest': { const ex = findEx(el.dataset.key); if (ex) { ex.restSec = Number(el.dataset.v); saveActive(); ctx.renderSheet(); } break; }
      case 'tr-ex-remove': { w.exercises = w.exercises.filter((e) => e.key !== el.dataset.key); saveActive(0); closeSheet(); ctx.render(); break; }
      case 'tr-add-set': { const ex = findEx(el.dataset.key); if (ex) { const last = ex.sets[ex.sets.length - 1]; ex.sets.push({ id: uid(), w: null, r: null, type: 'normal', done: false, prevW: last ? (last.w ?? last.prevW) : null, prevR: last ? (last.r ?? last.prevR) : null }); saveActive(); ctx.render(); } break; }
      case 'tr-set-menu': openSheet({ type: 'tr-set-menu', key: el.dataset.key, set: el.dataset.set }); break;
      case 'tr-set-type': { const s = findSet(el.dataset.key, el.dataset.set); if (s) { s.type = s.type === 'warmup' ? 'normal' : 'warmup'; saveActive(); closeSheet(); ctx.render(); } break; }
      case 'tr-set-delete': { const ex = findEx(el.dataset.key); if (ex) { ex.sets = ex.sets.filter((s) => s.id !== el.dataset.set); saveActive(); closeSheet(); ctx.render(); } break; }
      case 'tr-set-done': {
        const ex = findEx(el.dataset.key), s = ex && ex.sets.find((x) => x.id === el.dataset.set); if (!s) return;
        primeAudio();
        if (s.done) { s.done = false; saveActive(); ctx.render(); return; }
        const row = el.closest('.setrow');
        const wv = row.querySelector('[data-tr-w]').value, rv = row.querySelector('[data-tr-r]').value;
        const wKg = wv !== '' ? fromD(wv) : (s.prevW ?? null);
        const reps = rv !== '' ? parseInt(rv, 10) : (s.prevR ?? (parseInt(ex.targetReps, 10) || null));
        if (!(reps > 0)) { toast('Enter the reps first'); row.querySelector('[data-tr-r]').focus(); return; }
        s.w = wKg ?? 0; s.r = reps; s.done = true;
        // carry values forward as the next set's hint
        const i = ex.sets.indexOf(s); const nx = ex.sets[i + 1]; if (nx && nx.w == null && nx.r == null) { nx.prevW = s.w; nx.prevR = s.r; }
        startRest(ex.restSec || S().trainPrefs.restSec || 90);
        saveActive(); ctx.render(); break;
      }
      case 'tr-rest-add': if (ui.rest) { ui.rest.endsAt += 30000; ui.rest.total += 30; ui.rest.rang = false; updateRestBar(); } break;
      case 'tr-rest-skip': ui.rest = null; updateRestBar(); break;
      case 'tr-rename': { const n = prompt('Workout name', w.name); if (n && n.trim()) { w.name = n.trim(); saveActive(); ctx.render(); } break; }
      case 'tr-finish': openSheet({ type: 'tr-finish' }); break;
      case 'tr-finish-save': finalizeWorkout({ updateRoutine: !!document.querySelector('[data-tr-update-routine]')?.checked, makeRoutine: !!document.querySelector('[data-tr-make-routine]')?.checked }); break;
      case 'tr-cancel': if (confirm('Discard this workout? Nothing will be saved.')) { S().activeWorkout = null; touch(S(), 'activeWorkout'); ui.rest = null; ui.view = 'train'; ctx.commit(); } break;
      case 'tr-wo-view': openSheet({ type: 'tr-wo', id: el.dataset.id }); break;
      case 'tr-wo-delete': if (confirm('Delete this workout from your history?')) { delete S().workouts[el.dataset.id]; bury(S(), 'workouts', el.dataset.id); closeSheet(); ctx.commit(); toast('Deleted'); } break;
      case 'tr-repeat': { const src = S().workouts[el.dataset.id]; if (src && !active()) { closeSheet(); EX.loadExercises().catch(() => {}); startFromWorkout(src); } break; }
      case 'tr-save-routine': { const src = S().workouts[el.dataset.id]; if (!src) return; const id = uid(); S().routines[id] = { id, name: src.name, exercises: src.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, sets: Math.max(1, e.sets.filter((s) => s.type !== 'warmup').length), reps: '', restSec: e.restSec || 90 })) }; touch(S(), 'routines', id); closeSheet(); ctx.commit(); toast('Routine saved'); break; }
      case 'tr-import': openSheet({ type: 'tr-import', preview: null }); EX.loadExercises().catch(() => {}); break;
      case 'tr-import-parse': { const t = document.querySelector('[data-tr-import-text]').value.trim(); if (!t) { toast('Choose a file or paste the CSV'); return; } EX.loadExercises().then(() => parseImport(t, sh)).catch(() => parseImport(t, sh)); break; }
      case 'tr-import-apply': applyImport(sh); break;
      default: break;
    }
  }

  function onSubmit(kind, form, F) {
    if (kind === 'tr-custom') {
      const sh = ui.sheet; const name = String(F.get('name') || '').trim(); if (!name) return;
      const c = { id: 'cx-' + uid(), name, equipment: String(F.get('equipment') || 'other'), primary: [], groups: [String(F.get('group') || 'other')] };
      S().customExercises.push(c); touch(S(), 'customExercises', c.id); ctx.save(); ctx.scheduleSync();
      const back = sh.returnTo;
      if (back && back.type === 'tr-pick') { if (back.mode !== 'browse') back.selected.add(c.id); back.q = ''; openSheet(back); }
      else closeSheet();
      toast('Exercise created');
    }
  }

  function onInput(t) {
    if (t.matches('[data-tr-search]')) { ui.sheet.q = t.value; refreshPick(); return; }
    if (t.matches('[data-tr-w]') || t.matches('[data-tr-r]')) {
      const s = findSet(t.dataset.key, t.dataset.set); if (!s) return;
      if (t.matches('[data-tr-w]')) s.w = t.value === '' ? null : fromD(t.value); else s.r = t.value === '' ? null : parseInt(t.value, 10) || null;
      saveActiveSoon();
    }
  }
  function onChange(t) {
    if (t.matches('[data-tr-import-file]') && t.files?.[0]) { const sh = ui.sheet; t.files[0].text().then((txt) => EX.loadExercises().then(() => parseImport(txt, sh)).catch(() => parseImport(txt, sh))); }
  }

  return { renderTrain, renderWorkout, sheetHTML, isTall, onAction, onSubmit, onInput, onChange, afterRender, trendsCardHTML, hasActive: () => !!active() };
}
