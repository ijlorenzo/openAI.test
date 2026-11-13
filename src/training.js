// Pure training logic: estimates, records, volume and CSV import parsing.
import { toISODate } from './nutrition.js';

export const LB_PER_KG = 2.2046226218;

/** Epley estimated one-rep max. Reps of 1 return the weight itself. */
export function e1rm(kg, reps) {
  if (!(kg > 0) || !(reps > 0)) return 0;
  if (reps === 1) return kg;
  return Math.round(kg * (1 + reps / 30) * 10) / 10;
}

export const setVolume = (s) => (s.w > 0 && s.r > 0 ? s.w * s.r : 0);
/** A set counts when it is done and has any measurable content (reps, seconds or distance). */
export const workingSets = (sets) => sets.filter((s) => s.done && s.type !== 'warmup' && (s.r > 0 || s.dur > 0 || s.dist > 0));
export const modeOf = (ex) => ex.mode || 'strength';

export function workoutSummary(w) {
  let sets = 0, volume = 0, reps = 0, activeSec = 0, distKm = 0;
  for (const ex of w.exercises || []) {
    const mode = modeOf(ex);
    for (const s of workingSets(ex.sets || [])) {
      sets++;
      if (mode === 'strength') { reps += s.r || 0; volume += setVolume(s); }
      if (s.dur > 0) activeSec += s.dur;
      if (s.dist > 0) distKm += s.dist;
    }
  }
  const durationSec = w.startedAt && w.endedAt ? Math.max(0, Math.round((w.endedAt - w.startedAt) / 1000)) : 0;
  return { sets, reps, volume: Math.round(volume), durationSec, activeSec, distKm: Math.round(distKm * 100) / 100, exercises: (w.exercises || []).length, kind: w.kind || 'strength' };
}

export function fmtDuration(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Best set (by e1RM) and heaviest weight per exercise across finished workouts, excluding a given workout id. */
export function exerciseBests(workouts, exerciseId, { excludeId = null } = {}) {
  let best1rm = 0, bestW = 0, bestVol = 0, bestDur = 0, bestDist = 0, totalSec = 0, sessions = 0;
  for (const w of Object.values(workouts)) {
    if (w.id === excludeId) continue;
    let touched = false;
    for (const ex of w.exercises || []) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of workingSets(ex.sets || [])) {
        touched = true;
        best1rm = Math.max(best1rm, e1rm(s.w, s.r));
        bestW = Math.max(bestW, s.w || 0);
        bestVol = Math.max(bestVol, setVolume(s));
        bestDur = Math.max(bestDur, s.dur || 0);
        bestDist = Math.max(bestDist, s.dist || 0);
        totalSec += s.dur || 0;
      }
    }
    if (touched) sessions++;
  }
  return { best1rm, bestW, bestVol, bestDur, bestDist, totalSec, sessions };
}

/** Personal records set in this workout relative to all earlier workouts. */
export function detectPRs(workouts, w) {
  const prs = [];
  for (const ex of w.exercises || []) {
    const before = exerciseBests(workouts, ex.exerciseId, { excludeId: w.id });
    const mode = modeOf(ex);
    const sets = workingSets(ex.sets || []);
    if (!sets.length || before.sessions === 0) continue;
    if (mode === 'strength') {
      let top1rm = 0, topW = 0, topSet = null;
      for (const s of sets) { const v = e1rm(s.w, s.r); if (v > top1rm) { top1rm = v; topSet = s; } topW = Math.max(topW, s.w || 0); }
      if (top1rm > before.best1rm) prs.push({ exerciseId: ex.exerciseId, name: ex.name, type: '1rm', value: top1rm, set: topSet });
      else if (topW > before.bestW) prs.push({ exerciseId: ex.exerciseId, name: ex.name, type: 'weight', value: topW, set: topSet });
    } else if (mode === 'timed') {
      const top = Math.max(...sets.map((s) => s.dur || 0));
      if (top > before.bestDur) prs.push({ exerciseId: ex.exerciseId, name: ex.name, type: 'hold', value: top });
    } else if (mode === 'cardio') {
      const dist = Math.max(...sets.map((s) => s.dist || 0)), dur = Math.max(...sets.map((s) => s.dur || 0));
      if (dist > before.bestDist && dist > 0) prs.push({ exerciseId: ex.exerciseId, name: ex.name, type: 'distance', value: dist });
      else if (dur > before.bestDur && dur > 0) prs.push({ exerciseId: ex.exerciseId, name: ex.name, type: 'duration', value: dur });
    }
  }
  return prs;
}

/** Most recent finished workout containing the exercise (for "previous" hints). */
export function lastPerformance(workouts, exerciseId, { beforeId = null } = {}) {
  const list = Object.values(workouts).filter((w) => w.id !== beforeId && (w.exercises || []).some((e) => e.exerciseId === exerciseId));
  list.sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
  const w = list[0];
  if (!w) return null;
  const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
  return { date: w.date, sets: ex.sets.filter((s) => s.done) };
}

/** History per session for charts: e1rm (strength), best hold (timed), distance/duration (cardio, session). */
export function e1rmHistory(workouts, exerciseId, limit = 30) {
  const pts = [];
  for (const w of Object.values(workouts)) {
    let best = 0, topW = 0, vol = 0, dur = 0, dist = 0, touched = false;
    for (const ex of w.exercises || []) if (ex.exerciseId === exerciseId) for (const s of workingSets(ex.sets || [])) { touched = true; best = Math.max(best, e1rm(s.w, s.r)); topW = Math.max(topW, s.w || 0); vol += setVolume(s); dur = Math.max(dur, s.dur || 0); dist += s.dist || 0; }
    if (touched) pts.push({ date: w.date, e1rm: best, topW, volume: Math.round(vol), dur, dist: Math.round(dist * 100) / 100, id: w.id, startedAt: w.startedAt || 0 });
  }
  pts.sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt);
  return pts.slice(-limit);
}

/** Minutes and distance by mode over a date range. */
export function activityTotals(workouts, fromISO, toISO) {
  const out = { strengthSets: 0, cardioSec: 0, cardioKm: 0, sessionSec: 0, holdSec: 0, workouts: 0 };
  for (const w of Object.values(workouts)) {
    if (w.date < fromISO || w.date > toISO) continue;
    out.workouts++;
    for (const ex of w.exercises || []) {
      const mode = modeOf(ex);
      for (const s of workingSets(ex.sets || [])) {
        if (mode === 'strength') out.strengthSets++;
        else if (mode === 'cardio') { out.cardioSec += s.dur || 0; out.cardioKm += s.dist || 0; }
        else if (mode === 'session') out.sessionSec += s.dur || 0;
        else if (mode === 'timed') out.holdSec += s.dur || 0;
      }
    }
  }
  out.cardioKm = Math.round(out.cardioKm * 100) / 100;
  return out;
}

/**
 * Suggest the next load for a routine exercise with a linear progression rule:
 * if every working set last time reached the top of the target rep range, add the increment.
 */
export function suggestNext(lastSets, targetReps, incKg) {
  if (!incKg || !lastSets || !lastSets.length) return null;
  const working = lastSets.filter((s) => s.type !== 'warmup' && s.r > 0);
  if (!working.length) return null;
  const m = /(\d+)(?:\s*-\s*(\d+))?/.exec(String(targetReps || ''));
  if (!m) return null;
  const top = Number(m[2] || m[1]);
  const maxW = Math.max(...working.map((s) => s.w || 0));
  const hit = working.filter((s) => (s.w || 0) >= maxW - 0.01).every((s) => s.r >= top);
  return hit && maxW > 0 ? Math.round((maxW + incKg) * 100) / 100 : null;
}

/** Working sets per muscle group over a date range (inclusive ISO dates). */
export function setsByMuscle(workouts, exerciseLookup, fromISO, toISO) {
  const out = {};
  for (const w of Object.values(workouts)) {
    if (w.date < fromISO || w.date > toISO) continue;
    for (const ex of w.exercises || []) {
      if (modeOf(ex) !== 'strength') continue;
      const info = exerciseLookup(ex.exerciseId);
      const groups = info?.groups?.length ? info.groups : ['other'];
      const n = workingSets(ex.sets || []).length;
      for (const g of groups) out[g] = (out[g] || 0) + n / groups.length;
    }
  }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 10) / 10;
  return out;
}

export function workoutsPerWeek(workouts, weeks = 8, today = new Date()) {
  const out = [];
  const t = new Date(today); t.setHours(0, 0, 0, 0);
  const dow = (t.getDay() + 6) % 7; // Monday start
  const thisMonday = new Date(t); thisMonday.setDate(t.getDate() - dow);
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday); start.setDate(thisMonday.getDate() - i * 7);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const a = toISODate(start), b = toISODate(end);
    out.push({ start: a, end: b, count: Object.values(workouts).filter((w) => w.date >= a && w.date <= b).length });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* CSV import (Hevy, Fitbod, Strong)                                    */
/* ------------------------------------------------------------------ */
export function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else field += c;
  }
  row.push(field); if (row.some((x) => x !== '')) rows.push(row);
  if (!rows.length) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
  return { header, records };
}

const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

function parseDateLoose(s) {
  if (!s) return null;
  // Hevy: "12 Jan 2025, 18:03" or ISO; Fitbod: "2025-01-12 18:03:21 +0000"; Strong: "2025-01-12 18:03:21"
  let d = new Date(s);
  if (Number.isNaN(d.getTime())) d = new Date(String(s).replace(/,/, '').replace(/(\d{1,2}) (\w{3}) (\d{4})/, '$2 $1, $3'));
  if (Number.isNaN(d.getTime())) d = new Date(String(s).replace(' ', 'T').replace(/ \+\d{4}$/, 'Z'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Detect the source app from CSV headers. */
export function detectCSV(header) {
  const h = header.map((x) => x.toLowerCase());
  if (h.includes('exercise_title')) return 'hevy';
  if (h.includes('exercise name') && h.includes('set order')) return 'strong'; // Strong, and Hevy's older export
  if (h.includes('iswarmup') || (h.includes('exercise') && h.some((x) => x.startsWith('weight(')))) return 'fitbod';
  return null;
}

/**
 * Convert CSV text into workouts: [{ id, name, date, startedAt, endedAt, exercises: [{ name, sets: [{ w(kg), r, type, done }] }] }]
 * Exercise names are left as-is; the caller maps them to library ids.
 */
export function importCSV(text, { makeId = () => Math.random().toString(36).slice(2) } = {}) {
  const { header, records } = parseCSV(text);
  const kind = detectCSV(header);
  if (!kind) throw new Error('Unrecognised CSV. Expected a Hevy, Strong or Fitbod export.');
  const h = Object.fromEntries(header.map((x) => [x.toLowerCase(), x]));
  const get = (r, ...names) => { for (const n of names) { const k = h[n.toLowerCase()]; if (k !== undefined && r[k] !== '') return r[k]; } return ''; };
  const groups = new Map(); // key -> workout

  for (const r of records) {
    let key, name, start, end, exName, w, reps, type;
    if (kind === 'hevy' || kind === 'strong') {
      const startRaw = get(r, 'start_time', 'Date');
      start = parseDateLoose(startRaw);
      end = parseDateLoose(get(r, 'end_time')) || null;
      name = get(r, 'title', 'Workout Name') || 'Workout';
      exName = get(r, 'exercise_title', 'Exercise Name');
      key = `${startRaw}|${name}`;
      const kg = get(r, 'weight_kg', 'Weight (kg)');
      const lbs = get(r, 'weight_lbs', 'Weight (lbs)', 'Weight');
      w = kg !== '' ? num(kg) : num(lbs) / LB_PER_KG;
      reps = num(get(r, 'reps', 'Reps'));
      const t = get(r, 'set_type', 'Set Type').toLowerCase();
      type = t.includes('warm') ? 'warmup' : t.includes('drop') ? 'drop' : t.includes('fail') ? 'failure' : 'normal';
      if (!end && get(r, 'Duration')) { const m = /(\d+)h?\s*(\d+)?m?/.exec(get(r, 'Duration')); if (m && start) end = new Date(start.getTime() + ((Number(m[1]) || 0) * 60 + (Number(m[2]) || 0)) * 60000); }
    } else {
      start = parseDateLoose(get(r, 'Date'));
      if (!start) continue;
      // Fitbod has per-set timestamps; group sets within 3 h of the first set of the day.
      const dayKey = toISODate(start);
      let found = null;
      for (const [k, g] of groups) if (k.startsWith(dayKey + '|') && Math.abs(start - g._first) < 3 * 3600 * 1000) { found = k; break; }
      key = found || `${dayKey}|${start.getTime()}`;
      name = 'Fitbod workout';
      exName = get(r, 'Exercise');
      const kg = get(r, 'Weight(kg)', 'Weight (kg)');
      w = kg !== '' ? num(kg) : num(get(r, 'Weight(lb)', 'Weight (lbs)')) / LB_PER_KG;
      reps = num(get(r, 'Reps'));
      type = /true|1/i.test(get(r, 'isWarmup')) ? 'warmup' : 'normal';
      end = null;
    }
    if (!start || !exName) continue;
    if (!groups.has(key)) groups.set(key, { id: 'imp-' + makeId(), name, date: toISODate(start), startedAt: start.getTime(), endedAt: end ? end.getTime() : null, _first: start, _last: start, exercises: [], source: kind });
    const g = groups.get(key);
    if (start > g._last) g._last = start;
    if (end && (!g.endedAt || end.getTime() > g.endedAt)) g.endedAt = end.getTime();
    let ex = g.exercises[g.exercises.length - 1];
    if (!ex || ex.name !== exName) { ex = { name: exName, sets: [] }; g.exercises.push(ex); }
    if (reps > 0 || w > 0) ex.sets.push({ id: makeId(), w: Math.round(w * 100) / 100, r: Math.round(reps), type, done: true });
  }
  const out = [];
  for (const g of groups.values()) {
    if (!g.endedAt) g.endedAt = g._last.getTime() + (g._last.getTime() === g.startedAt ? 45 * 60000 : 3 * 60000);
    delete g._first; delete g._last;
    g.exercises = g.exercises.filter((e) => e.sets.length);
    if (g.exercises.length) out.push(g);
  }
  out.sort((a, b) => a.startedAt - b.startedAt);
  return { kind, workouts: out };
}

/** Normalise an app export's exercise name for library matching: "Bench Press (Barbell)" → "barbell bench press". */
export function normalizeExerciseName(name) {
  let s = String(name || '').trim();
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(s);
  if (m) s = `${m[2]} ${m[1]}`;
  return s.replace(/\s+/g, ' ').toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Training blocks: a locked plan with a target rate and a deload       */
/* ------------------------------------------------------------------ */
import { addDays as _addDays, daysBetween as _daysBetween } from './nutrition.js';

/** Where we are in the block. Week is 1-based; the final week is the deload when enabled. */
export function blockPosition(block, today) {
  const daysIn = Math.max(0, _daysBetween(block.startDate, today));
  const week = Math.min(block.weeks, Math.floor(daysIn / 7) + 1);
  const done = daysIn >= block.weeks * 7;
  const isDeload = !!block.deload && week === block.weeks && !done;
  return { week, weeks: block.weeks, daysIn, done, isDeload, endDate: _addDays(block.startDate, block.weeks * 7 - 1) };
}

/** Target e1RM after `weeks` weeks at ratePct per two weeks, compounding. */
export function targetE1rm(baseline, ratePct, weeks) {
  if (!(baseline > 0)) return 0;
  return Math.round(baseline * Math.pow(1 + ratePct / 100, weeks / 2) * 10) / 10;
}

/** Load that gives a target e1RM at `reps` (inverse Epley). */
export function loadForE1rm(e1rmTarget, reps) {
  if (!(e1rmTarget > 0) || !(reps > 0)) return 0;
  return reps === 1 ? e1rmTarget : e1rmTarget / (1 + reps / 30);
}

/** Best e1RM in the window before the block started (so the plan starts from reality). */
export function baselineFor(workouts, exerciseId, startDate, lookbackDays = 28) {
  const from = _addDays(startDate, -lookbackDays);
  let best = 0;
  for (const w of Object.values(workouts)) {
    if (w.date < from || w.date >= startDate) continue;
    for (const ex of w.exercises || []) if (ex.exerciseId === exerciseId) for (const s of workingSets(ex.sets || [])) best = Math.max(best, e1rm(s.w, s.r));
  }
  return best || null;
}

/**
 * Progress of one focus lift inside the block.
 * current = best e1RM over the last two sessions in the block; stalls = consecutive
 * recent sessions whose best e1RM did not beat the one before.
 */
export function focusProgress(workouts, block, exerciseId, today) {
  const pos = blockPosition(block, today);
  const sessions = e1rmHistory(workouts, exerciseId, 60).filter((p) => p.date >= block.startDate && p.date <= today && p.e1rm > 0);
  // The block starts from where you actually are: the first in-block session sets the baseline;
  // until then, recent history (block.baseline) stands in so targets can be shown.
  const baseline = sessions.length ? sessions[0].e1rm : (block.baseline?.[exerciseId] || null);
  const lastTwo = sessions.slice(-2);
  const current = lastTwo.length ? Math.max(...lastTwo.map((p) => p.e1rm)) : null;
  // Target for the training weeks only (deload week does not raise the bar).
  const trainingWeeks = block.deload ? block.weeks - 1 : block.weeks;
  const weeksElapsed = Math.min(trainingWeeks, pos.daysIn / 7);
  const target = baseline ? targetE1rm(baseline, block.ratePct, weeksElapsed) : null;
  const goal = baseline ? targetE1rm(baseline, block.ratePct, trainingWeeks) : null;
  let stalls = 0;
  for (let i = sessions.length - 1; i > 0; i--) { if (sessions[i].e1rm <= sessions[i - 1].e1rm + 0.01) stalls++; else break; }
  let status = 'no-data';
  let pct = null, targetPct = null;
  if (baseline && current) {
    pct = Math.round(((current / baseline) - 1) * 1000) / 10;
    targetPct = Math.round(((target / baseline) - 1) * 1000) / 10;
    const diff = pct - targetPct;
    status = diff >= 1.5 ? 'ahead' : diff >= -1.5 ? 'on-track' : 'behind';
  }
  return { baseline, current, target, goal, pct, targetPct, status, stalls, sessions: sessions.length, isDeload: pos.isDeload, week: pos.week };
}

/** Which routine comes next in the block's rotation, given finished workouts. */
export function nextRoutineId(block, workouts) {
  const ids = block.routineIds || [];
  if (!ids.length) return null;
  const done = Object.values(workouts).filter((w) => w.routineId && ids.includes(w.routineId) && w.date >= block.startDate).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  if (!done.length) return ids[0];
  const i = ids.indexOf(done[0].routineId);
  return ids[(i + 1) % ids.length];
}

/** Per-session hint for a focus lift: the load that puts you on the target line at `reps`, or deload load. */
export function sessionTargetKg({ progress, reps, lastTopKg, isDeload }) {
  if (isDeload) return lastTopKg ? lastTopKg * 0.6 : null;
  if (!progress || !progress.target || !(reps > 0)) return null;
  return loadForE1rm(progress.target, reps);
}
