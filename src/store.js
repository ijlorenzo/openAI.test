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
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
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
  return { ...defaultState(), ...parsed };
}
