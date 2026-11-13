import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, normalize, mergeStates, touch, bury } from '../src/store.js';

const entry = (id, name, t) => ({ id, meal: 'lunch', name, serving: 'x', servings: 1, kcal: 100, protein: 1, carbs: 1, fat: 1, t });
function state(mods = (s) => s) { const s = defaultState(); s.profile = { sex: 'male' }; s.targets = { kcal: 2000 }; return mods(s) || s; }

test('normalize fills nested defaults for legacy saves', () => {
  const s = normalize({ entries: { '2026-01-01': [entry('a', 'A')] } });
  assert.deepEqual(Object.keys(s.tombstones).sort(), ['blocks', 'customExercises', 'customFoods', 'entries', 'routines', 'weights', 'workouts']);
  assert.equal(s.stamps.profile, 0);
  assert.equal(s.sync.provider, null);
});

test('union of entries from two devices', () => {
  const A = state((s) => { s.entries['2026-01-01'] = [entry('a', 'A', 1)]; touch(s, 'entries', 'a'); });
  const B = state((s) => { s.entries['2026-01-01'] = [entry('b', 'B', 2)]; touch(s, 'entries', 'b'); });
  const M = mergeStates(A, B);
  assert.deepEqual(M.entries['2026-01-01'].map((e) => e.id), ['a', 'b']);
});

test('newer edit wins for the same entry', () => {
  const A = state((s) => { s.entries['d'] = [entry('a', 'old')]; s.stamps.entries.a = 100; });
  const B = state((s) => { s.entries['d'] = [entry('a', 'new')]; s.stamps.entries.a = 200; });
  assert.equal(mergeStates(A, B).entries.d[0].name, 'new');
  assert.equal(mergeStates(B, A).entries.d[0].name, 'new');
});

test('deletion beats an older copy but not a newer edit', () => {
  const A = state((s) => { s.entries['d'] = [entry('a', 'A')]; s.stamps.entries.a = 100; });
  const B = state((s) => { s.tombstones.entries.a = 150; });
  assert.deepEqual(mergeStates(A, B).entries, {});
  assert.equal(mergeStates(A, B).tombstones.entries.a, 150);
  const C = state((s) => { s.entries['d'] = [entry('a', 'edited later')]; s.stamps.entries.a = 200; });
  assert.equal(mergeStates(C, B).entries.d[0].name, 'edited later');
});

test('bury then merge removes on the other side; legacy unstamped data survives', () => {
  const A = state((s) => { s.entries['d'] = [entry('a', 'A'), entry('b', 'B')]; });
  const B = state((s) => { s.entries['d'] = [entry('a', 'A'), entry('b', 'B')]; bury(s, 'entries', 'a'); s.entries['d'] = s.entries['d'].filter((e) => e.id !== 'a'); });
  const M = mergeStates(A, B);
  assert.deepEqual(M.entries.d.map((e) => e.id), ['b']);
});

test('weights merge by date with tombstones', () => {
  const A = state((s) => { s.weights['2026-01-01'] = 80; touch(s, 'weights', '2026-01-01'); s.weights['2026-01-02'] = 81; });
  const B = state((s) => { s.weights['2026-01-01'] = 79.5; s.stamps.weights['2026-01-01'] = Date.now() + 1000; bury(s, 'weights', '2026-01-02'); });
  const M = mergeStates(A, B);
  assert.equal(M.weights['2026-01-01'], 79.5);
  assert.equal(M.weights['2026-01-02'], undefined);
});

test('scalars: newer stamp wins, ties go to local', () => {
  const A = state((s) => { s.targets = { kcal: 2000 }; s.stamps.targets = 10; });
  const B = state((s) => { s.targets = { kcal: 2200 }; s.stamps.targets = 20; });
  assert.equal(mergeStates(A, B).targets.kcal, 2200);
  const C = state((s) => { s.targets = { kcal: 1900 }; s.stamps.targets = 20; });
  assert.equal(mergeStates(C, B).targets.kcal, 1900);
});

test('custom foods, check-ins and food cache union', () => {
  const A = state((s) => { s.customFoods = [{ id: 'c1', name: 'one' }]; touch(s, 'customFoods', 'c1'); s.checkins = [{ date: '2026-01-01', kcalAfter: 2000 }]; s.foodCache = { x: 1 }; });
  const B = state((s) => { s.customFoods = [{ id: 'c2', name: 'two' }]; touch(s, 'customFoods', 'c2'); s.checkins = [{ date: '2026-01-08', kcalAfter: 1900 }]; s.foodCache = { y: 2 }; });
  const M = mergeStates(A, B);
  assert.deepEqual(M.customFoods.map((f) => f.id).sort(), ['c1', 'c2']);
  assert.equal(M.checkins.length, 2);
  assert.deepEqual(M.foodCache, { x: 1, y: 2 });
});

test('merge is idempotent and keeps local sync settings', () => {
  const A = state((s) => { s.entries['d'] = [entry('a', 'A')]; touch(s, 'entries', 'a'); s.sync = { provider: 'drive', fileId: 'f1', lastSync: 5 }; });
  const B = state((s) => { s.entries['d'] = [entry('b', 'B')]; touch(s, 'entries', 'b'); });
  const M1 = mergeStates(A, B);
  const M2 = mergeStates(M1, B);
  assert.deepEqual(M2.entries, M1.entries);
  assert.equal(M1.sync.fileId, 'f1');
});

test('a fresh device restoring from Drive takes the remote profile even without stamps', () => {
  const fresh = defaultState();
  const remote = state((s) => { s.entries['d'] = [entry('a', 'A')]; s.usdaKey = 'KEY'; s.recents = ['x']; });
  const M = mergeStates(fresh, remote);
  assert.deepEqual(M.profile, { sex: 'male' });
  assert.equal(M.targets.kcal, 2000);
  assert.equal(M.usdaKey, 'KEY');
  assert.deepEqual(M.recents, ['x']);
  assert.equal(M.entries.d.length, 1);
});

test('workouts and routines merge by id with tombstones; active workout is last-writer-wins', () => {
  const A = state((s) => { s.workouts.w1 = { id: 'w1', date: '2026-01-01', name: 'A' }; touch(s, 'workouts', 'w1'); s.routines.r1 = { id: 'r1', name: 'Push' }; touch(s, 'routines', 'r1'); s.activeWorkout = { id: 'x', n: 1 }; s.stamps.activeWorkout = 10; });
  const B = state((s) => { s.workouts.w2 = { id: 'w2', date: '2026-01-02', name: 'B' }; touch(s, 'workouts', 'w2'); bury(s, 'routines', 'r1'); s.activeWorkout = { id: 'x', n: 2 }; s.stamps.activeWorkout = 20; s.customExercises = [{ id: 'cx1', name: 'Odd lift' }]; touch(s, 'customExercises', 'cx1'); });
  const M = mergeStates(A, B);
  assert.deepEqual(Object.keys(M.workouts).sort(), ['w1', 'w2']);
  assert.deepEqual(M.routines, {});
  assert.equal(M.activeWorkout.n, 2);
  assert.equal(M.customExercises[0].id, 'cx1');
});

test('active block is last-writer-wins and finished blocks merge by id', () => {
  const A = state((s) => { s.block = { id: 'b1', weeks: 8 }; s.stamps.block = 10; s.blocks.old = { id: 'old' }; touch(s, 'blocks', 'old'); });
  const B = state((s) => { s.block = { id: 'b1', weeks: 6 }; s.stamps.block = 20; });
  const M = mergeStates(A, B);
  assert.equal(M.block.weeks, 6); assert.ok(M.blocks.old);
});
