// Pure nutrition math. No DOM, no storage — easy to test.

export const KCAL_PER_KG = 7700;
export const LB_PER_KG = 2.2046226218;
export const CM_PER_IN = 2.54;

export const ACTIVITY = {
  sedentary: { label: 'Sedentary', hint: 'Desk job, little exercise', factor: 1.2 },
  light: { label: 'Lightly active', hint: '1–3 workouts / week', factor: 1.375 },
  moderate: { label: 'Moderately active', hint: '3–5 workouts / week', factor: 1.55 },
  active: { label: 'Very active', hint: '6–7 workouts / week', factor: 1.725 },
  athlete: { label: 'Athlete', hint: 'Hard training + physical job', factor: 1.9 },
};

export const GOALS = {
  lose: { label: 'Lose fat', sign: -1, rates: [0.25, 0.5, 0.75, 1.0], defaultRate: 0.5 },
  maintain: { label: 'Maintain', sign: 0, rates: [0], defaultRate: 0 },
  gain: { label: 'Build muscle', sign: 1, rates: [0.25, 0.5], defaultRate: 0.25 },
};

export const kgToLb = (kg) => kg * LB_PER_KG;
export const lbToKg = (lb) => lb / LB_PER_KG;
export const cmToIn = (cm) => cm / CM_PER_IN;
export const inToCm = (inches) => inches * CM_PER_IN;

/** Mifflin–St Jeor basal metabolic rate. */
export function bmr({ sex, age, heightCm, weightKg }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'female' ? base - 161 : base + 5;
}

export function tdee(profile) {
  const factor = (ACTIVITY[profile.activity] || ACTIVITY.moderate).factor;
  return bmr(profile) * factor;
}

/** Target weekly weight change in kg (negative = loss). */
export function weeklyChangeKg({ goal, ratePct, weightKg }) {
  const sign = (GOALS[goal] || GOALS.maintain).sign;
  return sign * (ratePct / 100) * weightKg;
}

/** Daily calorie target from profile. */
export function calorieTarget(profile) {
  const maintenance = tdee(profile);
  const dailyDelta = (weeklyChangeKg(profile) * KCAL_PER_KG) / 7;
  const floor = profile.sex === 'female' ? 1200 : 1500;
  return Math.max(floor, Math.round((maintenance + dailyDelta) / 10) * 10);
}

/**
 * Split calories into macros.
 * Protein is set per kg of bodyweight (higher in a deficit), fat ~25% of
 * calories with a floor, carbs take the remainder.
 */
export function macroSplit(kcal, { weightKg, goal }) {
  const proteinPerKg = goal === 'lose' ? 2.2 : 1.8;
  let protein = Math.round(weightKg * proteinPerKg);
  const fatFloor = Math.round(weightKg * 0.6);
  let fat = Math.max(fatFloor, Math.round((kcal * 0.25) / 9));
  let carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
  if (carbs < 50) {
    // Trade fat for carbs down to the floor; then trim protein.
    const need = (50 - carbs) * 4;
    const fatGive = Math.min(Math.max(0, fat - fatFloor), Math.ceil(need / 9));
    fat -= fatGive;
    carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
    if (carbs < 50) {
      protein = Math.max(Math.round(weightKg * 1.4), Math.round((kcal - fat * 9 - 50 * 4) / 4));
      carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
    }
  }
  return { kcal: Math.round(kcal), protein, carbs, fat: Math.max(0, fat) };
}

export function targetsFromProfile(profile) {
  return macroSplit(calorieTarget(profile), profile);
}

export function macroCalories({ protein = 0, carbs = 0, fat = 0 }) {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

export function sumEntries(entries) {
  return entries.reduce(
    (acc, e) => {
      acc.kcal += e.kcal;
      acc.protein += e.protein;
      acc.carbs += e.carbs;
      acc.fat += e.fat;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function scaleFood(food, servings) {
  const s = Number(servings) || 0;
  return {
    kcal: round1(food.kcal * s),
    protein: round1(food.protein * s),
    carbs: round1(food.carbs * s),
    fat: round1(food.fat * s),
  };
}

export const round1 = (n) => Math.round(n * 10) / 10;

/** Exponentially-smoothed trend weight (like the Carbon / Happy Scale trend line). */
export function trendSeries(points, alpha = 0.3) {
  const out = [];
  let trend = null;
  for (const p of points) {
    trend = trend == null ? p.kg : trend + alpha * (p.kg - trend);
    out.push({ date: p.date, kg: p.kg, trend: round1(trend) });
  }
  return out;
}

const DAY = 86400000;
export const toISODate = (d) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const parseISODate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (iso, n) => toISODate(parseISODate(iso).getTime() + n * DAY);
export const daysBetween = (a, b) => Math.round((parseISODate(b) - parseISODate(a)) / DAY);

/**
 * Weekly check-in: compare the last 7 days of weigh-ins with the 7 before
 * that and nudge calories so the actual rate matches the target rate.
 *
 * weights: { 'YYYY-MM-DD': kg }
 * Returns { ok, reason?, actualKg, expectedKg, delta, kcalBefore, kcalAfter, targets }
 */
export function weeklyCheckin({ weights, profile, targets, today, minPoints = 3, maxStep = 150 }) {
  const dates = Object.keys(weights).sort();
  const recent = [];
  const prior = [];
  for (const d of dates) {
    const age = daysBetween(d, today);
    if (age >= 0 && age < 7) recent.push(weights[d]);
    else if (age >= 7 && age < 14) prior.push(weights[d]);
  }
  if (recent.length < minPoints || prior.length < minPoints) {
    return {
      ok: false,
      reason: `Log your weight at least ${minPoints} times a week for two weeks so the trend is reliable. This week: ${recent.length}, last week: ${prior.length}.`,
    };
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const actualKg = avg(recent) - avg(prior);
  const expectedKg = weeklyChangeKg({ ...profile, weightKg: avg(recent) });
  // Positive diff = gained more (or lost less) than planned → cut calories.
  const diff = actualKg - expectedKg;
  let delta = -Math.round(((diff * KCAL_PER_KG) / 7) / 10) * 10;
  // Dead band: ignore tiny noise.
  if (Math.abs(diff) < 0.1) delta = 0;
  delta = Math.max(-maxStep, Math.min(maxStep, delta));
  const floor = profile.sex === 'female' ? 1200 : 1500;
  const kcalAfter = Math.max(floor, targets.kcal + delta);
  const newTargets = macroSplit(kcalAfter, { ...profile, weightKg: avg(recent) });
  return {
    ok: true,
    actualKg: round1(actualKg),
    expectedKg: round1(expectedKg),
    delta: kcalAfter - targets.kcal,
    kcalBefore: targets.kcal,
    kcalAfter,
    currentKg: round1(avg(recent)),
    targets: newTargets,
  };
}
