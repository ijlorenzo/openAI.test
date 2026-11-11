import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bmr, tdee, calorieTarget, macroSplit, targetsFromProfile, macroCalories,
  scaleFood, trendSeries, weeklyCheckin, addDays, daysBetween, toISODate,
} from '../src/nutrition.js';

const male = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'lose', ratePct: 0.5 };
const female = { sex: 'female', age: 28, heightCm: 165, weightKg: 60, activity: 'light', goal: 'maintain', ratePct: 0 };

test('BMR follows Mifflin-St Jeor', () => {
  assert.equal(bmr(male), 10 * 80 + 6.25 * 180 - 5 * 30 + 5);
  assert.equal(bmr(female), 10 * 60 + 6.25 * 165 - 5 * 28 - 161);
});

test('TDEE applies activity factor', () => {
  assert.equal(Math.round(tdee(male)), Math.round(bmr(male) * 1.55));
});

test('calorie target subtracts deficit for fat loss and respects floor', () => {
  const t = calorieTarget(male);
  const expected = tdee(male) - (0.005 * 80 * 7700) / 7;
  assert.ok(Math.abs(t - expected) <= 5);
  const tiny = calorieTarget({ ...female, age: 80, heightCm: 150, weightKg: 45, activity: 'sedentary', goal: 'lose', ratePct: 1 });
  assert.equal(tiny, 1200);
});

test('macro split adds up to within rounding of target calories', () => {
  for (const kcal of [1300, 1800, 2400, 3200]) {
    const m = macroSplit(kcal, male);
    const sum = macroCalories(m);
    assert.ok(Math.abs(sum - kcal) <= 12, `${kcal} -> ${sum}`);
    assert.ok(m.carbs >= 50);
    assert.ok(m.fat > 0);
  }
});

test('targets from profile are sane', () => {
  const t = targetsFromProfile(male);
  assert.ok(t.kcal > 1800 && t.kcal < 2500);
  assert.equal(t.protein, 176);
});

test('scaleFood multiplies and rounds', () => {
  const egg = { kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 };
  assert.deepEqual(scaleFood(egg, 2), { kcal: 144, protein: 12.6, carbs: 0.8, fat: 9.6 });
  assert.deepEqual(scaleFood(egg, 'x'), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
});

test('trend series smooths noise', () => {
  const s = trendSeries([{ date: 'a', kg: 80 }, { date: 'b', kg: 82 }, { date: 'c', kg: 80 }]);
  assert.equal(s[0].trend, 80);
  assert.equal(s[1].trend, 80.6);
  assert.ok(s[2].trend < 80.6 && s[2].trend > 80);
});

test('date helpers', () => {
  assert.equal(addDays('2026-01-30', 2), '2026-02-01');
  assert.equal(daysBetween('2026-01-01', '2026-01-08'), 7);
  assert.equal(toISODate(new Date(2026, 10, 11)), '2026-11-11');
});

function fakeWeights(today, recentKg, priorKg) {
  const w = {};
  for (let i = 0; i < 7; i++) w[addDays(today, -i)] = recentKg;
  for (let i = 7; i < 14; i++) w[addDays(today, -i)] = priorKg;
  return w;
}

test('check-in needs enough data', () => {
  const r = weeklyCheckin({ weights: { '2026-11-11': 80 }, profile: male, targets: { kcal: 2200 }, today: '2026-11-11' });
  assert.equal(r.ok, false);
});

test('check-in cuts calories when loss is slower than planned', () => {
  const today = '2026-11-11';
  // Planned: lose 0.4 kg/week. Actual: lost 0.0.
  const r = weeklyCheckin({ weights: fakeWeights(today, 80, 80), profile: male, targets: { kcal: 2200, protein: 176, carbs: 200, fat: 60 }, today });
  assert.equal(r.ok, true);
  assert.ok(r.delta < 0, 'should cut');
  assert.equal(r.delta, -150, 'capped to max step');
  assert.equal(r.kcalAfter, 2050);
  assert.equal(r.targets.kcal, 2050);
});

test('check-in holds steady when on track', () => {
  const today = '2026-11-11';
  const r = weeklyCheckin({ weights: fakeWeights(today, 79.6, 80), profile: male, targets: { kcal: 2200 }, today });
  assert.equal(r.ok, true);
  assert.equal(r.delta, 0);
});

test('check-in adds calories when losing too fast', () => {
  const today = '2026-11-11';
  const r = weeklyCheckin({ weights: fakeWeights(today, 79, 80), profile: male, targets: { kcal: 2200 }, today });
  assert.ok(r.delta > 0);
});

test('check-in for gaining raises calories when not gaining', () => {
  const today = '2026-11-11';
  const gain = { ...male, goal: 'gain', ratePct: 0.25 };
  const r = weeklyCheckin({ weights: fakeWeights(today, 80, 80), profile: gain, targets: { kcal: 2800 }, today });
  assert.ok(r.delta > 0);
});
