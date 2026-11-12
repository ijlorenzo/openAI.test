// Exercise library: Free Exercise DB (public domain) loaded lazily, plus the
// user's custom exercises. Search reuses the forgiving food search engine.
import { indexFood, search } from './search.js';

export const GROUPS = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'other'];
export const GROUP_LABEL = { chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms', legs: 'Legs', core: 'Core', other: 'Other' };
export const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'body only', 'kettlebells', 'bands', 'other'];
export const EQUIPMENT_LABEL = { barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine', 'body only': 'Bodyweight', kettlebells: 'Kettlebell', bands: 'Bands', 'medicine ball': 'Med ball', 'exercise ball': 'Swiss ball', 'foam roll': 'Foam roll', 'e-z curl bar': 'EZ bar', other: 'Other', '': 'Other' };
export const MUSCLE_LABEL = { quadriceps: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', adductors: 'Adductors', abductors: 'Abductors', chest: 'Chest', shoulders: 'Shoulders', triceps: 'Triceps', biceps: 'Biceps', forearms: 'Forearms', lats: 'Lats', 'middle back': 'Mid back', 'lower back': 'Lower back', traps: 'Traps', neck: 'Neck', abdominals: 'Abs' };

// Gym shorthand → library wording. Applied to queries and imported names.
const EX_ALIASES = [
  [/\brdl\b/g, 'romanian deadlift'], [/\bohp\b/g, 'military press'], [/\boverhead press\b/g, 'military press'],
  [/\bback squat\b/g, 'barbell squat'], [/\bbulgarian split squat\b/g, 'split squat with dumbbells'], [/\bpull[- ]?ups?\b/g, 'pullups'],
  [/\bchin[- ]?ups?\b/g, 'chin-up'], [/\bpush[- ]?ups?\b/g, 'pushups'], [/\bdb\b/g, 'dumbbell'], [/\bbb\b/g, 'barbell'], [/\bkb\b/g, 'kettlebell'],
  [/\bbw\b/g, 'body only'], [/\bbodyweight\b/g, 'body only'], [/\bsldl\b/g, 'stiff-legged deadlift'], [/\bgoodmorning\b/g, 'good morning'],
  [/\bskull ?crushers?\b/g, 'skullcrusher'], [/\blateral raises?\b/g, 'side lateral raise'], [/\bpec ?deck\b/g, 'butterfly'],
  [/\bfarmers? (walk|carry)\b/g, "farmer's walk"], [/\bkettlebell swings?\b/g, 'one-arm kettlebell swings'], [/\bcable row\b/g, 'seated cable rows'],
  [/\bhip thrusts?\b/g, 'barbell hip thrust'], [/\btricep\b/g, 'triceps'], [/\bbicep\b/g, 'biceps'], [/\bcalf raises?\b/g, 'calf raises'],
  [/\bleg curls?\b/g, 'leg curls'], [/\bleg ext\b/g, 'leg extensions'], [/\bshoulder press\b/g, 'dumbbell shoulder press'],
  [/\bincline bench\b/g, 'incline bench press'], [/\bflat bench\b/g, 'bench press'], [/\bbench\b(?! press)/g, 'bench press'],
];
export function expandAliases(q) {
  let s = ' ' + String(q || '').toLowerCase() + ' ';
  for (const [re, rep] of EX_ALIASES) s = s.replace(re, rep);
  return s.trim();
}

let groupsMap = {};
let library = []; // library exercise objects
let byId = new Map();
let libIndex = [];
let loadP = null;
let instructions = null; let instrP = null;

export function loadExercises() {
  if (loadP) return loadP;
  loadP = fetch('data/exercises.json').then((r) => r.json()).then((d) => {
    groupsMap = d.groups || {};
    library = d.exercises.map(([id, name, equipment, primary, secondary, category, level, mechanic, force, popular]) => {
      const groups = [...new Set(primary.map((m) => groupsMap[m] || 'other'))];
      if (!groups.length) groups.push('other');
      return { id, name, equipment: equipment || 'other', primary, secondary, category, level, mechanic, force, popular, groups,
        tags: `${equipment} ${primary.join(' ')} ${secondary.join(' ')} ${groups.join(' ')} ${category}` };
    });
    byId = new Map(library.map((e) => [e.id, e]));
    // Popular first (in rank order) so equal-score ties resolve toward staples.
    const ordered = [...library].sort((a, b) => (b.popular >= 0) - (a.popular >= 0) || (a.popular >= 0 ? a.popular - b.popular : 0));
    libIndex = ordered.map((e) => indexFood({ ...e, curated: e.popular >= 0 }));
    return library;
  }).catch((e) => { loadP = null; throw e; });
  return loadP;
}
export const exercisesLoaded = () => library.length > 0;

export function loadInstructions(id) {
  if (instructions) return Promise.resolve(instructions[id] || null);
  if (!instrP) instrP = fetch('data/exercise-instructions.json').then((r) => r.json()).then((d) => { instructions = d; return d; }).catch(() => { instrP = null; return {}; });
  return instrP.then((d) => d[id] || null);
}

export function normalizeCustom(c) {
  const primary = c.primary || [];
  const groups = c.groups && c.groups.length ? c.groups : [...new Set(primary.map((m) => groupsMap[m] || 'other'))];
  return { ...c, custom: true, equipment: c.equipment || 'other', primary, secondary: c.secondary || [], groups: groups.length ? groups : ['other'], popular: 0,
    tags: `${c.equipment || ''} ${primary.join(' ')} ${groups.join(' ')} custom` };
}

export function exerciseById(id, customList = []) {
  const c = customList.find((x) => x.id === id);
  if (c) return normalizeCustom(c);
  return byId.get(id) || null;
}

/**
 * Search exercises. With no query, returns popular ones (then the rest)
 * filtered by group/equipment. Custom exercises always rank first.
 */
export function searchExercises(q, { custom = [], group = null, equipment = null, limit = 60 } = {}) {
  const customIdx = custom.map((c) => indexFood({ ...normalizeCustom(c), curated: true }));
  let idx = customIdx.concat(libIndex);
  if (group) idx = idx.filter((e) => e.f.groups.includes(group));
  if (equipment) idx = idx.filter((e) => e.f.equipment === equipment);
  const query = expandAliases(q);
  if (query) return search(idx, query, limit);
  const list = idx.map((e) => e.f);
  list.sort((a, b) => (b.custom ? 1 : 0) - (a.custom ? 1 : 0) || (b.popular >= 0) - (a.popular >= 0) || (a.popular >= 0 && b.popular >= 0 ? a.popular - b.popular : 0) || a.name.localeCompare(b.name));
  return list.slice(0, limit);
}

/** Best-effort match of an imported exercise name to the library. Returns an exercise or null. */
export function matchImportedName(rawName, custom = [], normalize = (s) => s) {
  const q = expandAliases(normalize(rawName));
  const exact = [...custom.map(normalizeCustom), ...library].find((e) => e.name.toLowerCase() === q || e.name.toLowerCase() === String(rawName).toLowerCase());
  if (exact) return exact;
  const res = searchExercises(q, { custom, limit: 3 });
  if (!res.length) return null;
  // Require every query word to appear somewhere in the match's name words (prefix) to avoid wild guesses.
  const words = q.split(/\s+/).filter((w) => w.length > 2 && !['with', 'the', 'and'].includes(w));
  const top = res[0];
  const nameWords = top.name.toLowerCase().split(/[^a-z0-9]+/);
  const covered = words.filter((w) => nameWords.some((n) => n.startsWith(w.slice(0, Math.min(w.length, 5))))).length;
  return covered >= Math.max(1, Math.ceil(words.length * 0.6)) ? top : null;
}
