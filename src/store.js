// Persistence: a single JSON blob in localStorage, with change notification.

const KEY = 'macrolog.v1';

export const MEALS = [
  { id: 'breakfast', label: 'Breakfast', icon: '☀️' },
  { id: 'lunch', label: 'Lunch', icon: '🥗' },
  { id: 'dinner', label: 'Dinner', icon: '🍽️' },
  { id: 'snacks', label: 'Snacks', icon: '🍎' },
];

export function defaultState() {
  return {
    version: 1,
    profile: null, // set after onboarding
    targets: null, // { kcal, protein, carbs, fat }
    entries: {}, // date -> [entry]
    weights: {}, // date -> kg
    customFoods: [],
    foodCache: {}, // id -> food fetched online (so recents/edits resolve offline)
    usdaKey: '',
    recents: [], // food ids, most recent first
    checkins: [], // { date, kcalBefore, kcalAfter, actualKg, expectedKg }
    lastCheckin: null,
    // Sync bookkeeping: per-record last-modified stamps and deletion tombstones
    // so two devices can merge without clobbering each other.
    stamps: { entries: {}, weights: {}, customFoods: {}, profile: 0, targets: 0, usdaKey: 0, lastCheckin: 0, recents: 0 },
    tombstones: { entries: {}, weights: {}, customFoods: {} },
    sync: { provider: null, fileId: null, lastSync: 0 },
  };
}

/** Fill in any missing nested defaults (older saves, imported backups). */
export function normalize(state) {
  const d = defaultState();
  const out = { ...d, ...state };
  out.stamps = { ...d.stamps, ...(state.stamps || {}) };
  for (const k of ['entries', 'weights', 'customFoods']) out.stamps[k] = { ...(state.stamps?.[k] || {}) };
  out.tombstones = { entries: {}, weights: {}, customFoods: {}, ...(state.tombstones || {}) };
  out.sync = { ...d.sync, ...(state.sync || {}) };
  out.entries = state.entries || {};
  out.weights = state.weights || {};
  out.customFoods = state.customFoods || [];
  out.recents = state.recents || [];
  out.checkins = state.checkins || [];
  out.foodCache = state.foodCache || {};
  return out;
}

export const now = () => Date.now();

/** Record that a record changed. group: entries | weights | customFoods | profile | targets | usdaKey | lastCheckin | recents */
export function touch(S, group, key) {
  if (key == null) S.stamps[group] = now();
  else { S.stamps[group][key] = now(); if (S.tombstones[group]) delete S.tombstones[group][key]; }
}

/** Record a deletion so it wins over an older copy on another device. */
export function bury(S, group, key) {
  S.tombstones[group][key] = now();
  delete S.stamps[group][key];
}

const pickNewer = (a, b, sa, sb) => (sb > sa ? b : a);

/**
 * Deterministic merge of two states. Newer stamp wins per record; deletions
 * win over anything not modified after them; unknown-age records (no stamp)
 * are kept so legacy data is never lost.
 */
export function mergeStates(localIn, remoteIn) {
  const L = normalize(localIn), R = normalize(remoteIn);
  const out = normalize({});
  const maxStamp = (g, k) => Math.max(L.stamps[g][k] || 0, R.stamps[g][k] || 0);
  const maxTomb = (g, k) => Math.max(L.tombstones[g][k] || 0, R.tombstones[g][k] || 0);

  const empty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
  for (const g of ['profile', 'targets', 'usdaKey', 'lastCheckin', 'recents']) {
    // A missing value never beats a present one, whatever the stamps say.
    if (empty(L[g]) && !empty(R[g])) out[g] = R[g];
    else if (empty(R[g]) && !empty(L[g])) out[g] = L[g];
    else out[g] = pickNewer(L[g], R[g], L.stamps[g] || 0, R.stamps[g] || 0);
    out.stamps[g] = Math.max(L.stamps[g] || 0, R.stamps[g] || 0);
  }

  // Entries: union by id, newer stamp wins, tombstones delete.
  const byId = new Map();
  for (const src of [R, L]) { // local last so it wins ties
    for (const [date, list] of Object.entries(src.entries)) {
      for (const e of list) {
        const u = src.stamps.entries[e.id] || 0;
        const cur = byId.get(e.id);
        if (!cur || u >= cur.u) byId.set(e.id, { date, e, u });
      }
    }
  }
  for (const [id, { date, e, u }] of byId) {
    const t = maxTomb('entries', id);
    if (t && t >= u) { out.tombstones.entries[id] = t; continue; }
    (out.entries[date] ||= []).push(e);
    const st = maxStamp('entries', id);
    if (st) out.stamps.entries[id] = st;
  }
  for (const list of Object.values(out.entries)) list.sort((a, b) => (a.t || 0) - (b.t || 0));
  for (const id of new Set([...Object.keys(L.tombstones.entries), ...Object.keys(R.tombstones.entries)])) {
    if (!byId.has(id)) out.tombstones.entries[id] = maxTomb('entries', id);
  }

  // Weights: by date.
  for (const date of new Set([...Object.keys(L.weights), ...Object.keys(R.weights), ...Object.keys(L.tombstones.weights), ...Object.keys(R.tombstones.weights)])) {
    const lu = L.stamps.weights[date] || 0, ru = R.stamps.weights[date] || 0;
    const has = (S) => Object.prototype.hasOwnProperty.call(S.weights, date);
    let val, u;
    if (has(L) && has(R)) { val = ru > lu ? R.weights[date] : L.weights[date]; u = Math.max(lu, ru); }
    else if (has(L)) { val = L.weights[date]; u = lu; }
    else if (has(R)) { val = R.weights[date]; u = ru; }
    const t = maxTomb('weights', date);
    if (val !== undefined && !(t && t >= u)) { out.weights[date] = val; if (u) out.stamps.weights[date] = u; }
    else if (t) out.tombstones.weights[date] = t;
  }

  // Custom foods: by id.
  const foods = new Map();
  for (const src of [R, L]) for (const f of src.customFoods) {
    const u = src.stamps.customFoods[f.id] || 0;
    const cur = foods.get(f.id);
    if (!cur || u >= cur.u) foods.set(f.id, { f, u });
  }
  for (const [id, { f, u }] of foods) {
    const t = maxTomb('customFoods', id);
    if (t && t >= u) { out.tombstones.customFoods[id] = t; continue; }
    out.customFoods.push(f);
    const st = maxStamp('customFoods', id);
    if (st) out.stamps.customFoods[id] = st;
  }
  for (const id of new Set([...Object.keys(L.tombstones.customFoods), ...Object.keys(R.tombstones.customFoods)])) {
    if (!foods.has(id)) out.tombstones.customFoods[id] = maxTomb('customFoods', id);
  }

  // Check-ins: union by date; keep the later-applied one per day.
  const ck = new Map();
  for (const c of [...R.checkins, ...L.checkins]) ck.set(c.date, c);
  out.checkins = [...ck.values()].sort((a, b) => a.date.localeCompare(b.date));

  out.foodCache = { ...R.foodCache, ...L.foodCache };
  out.version = Math.max(L.version || 1, R.version || 1);
  out.sync = { ...L.sync };
  return out;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return normalize(parsed);
  } catch {
    return defaultState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('save failed', e);
  }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function exportJSON(state) {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !('entries' in parsed)) {
    throw new Error('That file does not look like a Macro Log backup.');
  }
  return normalize(parsed);
}
