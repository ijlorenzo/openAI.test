import test from 'node:test';
import assert from 'node:assert/strict';
import { e1rm, workoutSummary, exerciseBests, detectPRs, lastPerformance, e1rmHistory, setsByMuscle, workoutsPerWeek, parseCSV, detectCSV, importCSV, normalizeExerciseName, fmtDuration } from '../src/training.js';

const set = (w, r, extra = {}) => ({ id: Math.random().toString(36).slice(2), w, r, type: 'normal', done: true, ...extra });
const wk = (id, date, exercises, start = 0) => ({ id, date, startedAt: start, endedAt: start + 3600000, name: 'W', exercises });

test('Epley e1RM', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 10), 133.3);
  assert.equal(e1rm(0, 10), 0);
});

test('workout summary ignores warmups and undone sets', () => {
  const w = wk('a', '2026-01-01', [{ exerciseId: 'x', name: 'X', sets: [set(100, 5), set(60, 5, { type: 'warmup' }), set(100, 5, { done: false })] }], 1000);
  assert.deepEqual(workoutSummary(w), { sets: 1, reps: 5, volume: 500, durationSec: 3600, exercises: 1 });
  assert.equal(fmtDuration(3600), '1h 0m');
  assert.equal(fmtDuration(125), '2:05');
});

test('bests, PR detection and last performance', () => {
  const W = {
    a: wk('a', '2026-01-01', [{ exerciseId: 'bench', name: 'Bench', sets: [set(80, 8)] }], 1),
    b: wk('b', '2026-01-08', [{ exerciseId: 'bench', name: 'Bench', sets: [set(85, 8)] }], 2),
  };
  const bests = exerciseBests(W, 'bench');
  assert.equal(bests.bestW, 85); assert.equal(bests.sessions, 2);
  const c = wk('c', '2026-01-15', [{ exerciseId: 'bench', name: 'Bench', sets: [set(85, 10)] }], 3);
  const prs = detectPRs({ ...W, c }, c);
  assert.equal(prs.length, 1); assert.equal(prs[0].type, '1rm');
  const d = wk('d', '2026-01-16', [{ exerciseId: 'bench', name: 'Bench', sets: [set(90, 1)] }], 4);
  assert.equal(detectPRs({ ...W, d }, d)[0].type, 'weight');
  // first ever session is not a PR
  const e = wk('e', '2026-01-17', [{ exerciseId: 'squat', name: 'Squat', sets: [set(100, 5)] }], 5);
  assert.equal(detectPRs({ ...W, e }, e).length, 0);
  assert.equal(lastPerformance(W, 'bench').date, '2026-01-08');
  assert.equal(e1rmHistory(W, 'bench').length, 2);
});

test('sets by muscle group and workouts per week', () => {
  const W = { a: wk('a', '2026-11-10', [{ exerciseId: 'bench', name: 'B', sets: [set(80, 8), set(80, 8)] }, { exerciseId: 'row', name: 'R', sets: [set(60, 10)] }]) };
  const lookup = (id) => ({ bench: { groups: ['chest', 'arms'] }, row: { groups: ['back'] } }[id]);
  assert.deepEqual(setsByMuscle(W, lookup, '2026-11-04', '2026-11-11'), { chest: 1, arms: 1, back: 1 });
  const weeks = workoutsPerWeek(W, 2, new Date(2026, 10, 11));
  assert.equal(weeks.length, 2); assert.equal(weeks[1].count, 1);
});

test('CSV parser handles quotes and newlines', () => {
  const { header, records } = parseCSV('a,b\n"x, y","line1\nline2"\n1,""\n');
  assert.deepEqual(header, ['a', 'b']);
  assert.equal(records[0].a, 'x, y'); assert.equal(records[0].b, 'line1\nline2'); assert.equal(records[1].a, '1');
});

test('Hevy export (new format) imports into workouts', () => {
  const csv = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
"Push Day","12 Jan 2025, 18:03","12 Jan 2025, 19:01","","Bench Press (Barbell)",,"",0,warmup,60,10,,,
"Push Day","12 Jan 2025, 18:03","12 Jan 2025, 19:01","","Bench Press (Barbell)",,"",1,normal,100,5,,,8
"Push Day","12 Jan 2025, 18:03","12 Jan 2025, 19:01","","Lateral Raise (Dumbbell)",,"",0,normal,10,15,,,
"Pull Day","14 Jan 2025, 07:10","14 Jan 2025, 08:00","","Lat Pulldown (Cable)",,"",0,normal,70,10,,,`;
  assert.equal(detectCSV(parseCSV(csv).header), 'hevy');
  const { kind, workouts } = importCSV(csv);
  assert.equal(kind, 'hevy'); assert.equal(workouts.length, 2);
  const push = workouts[0];
  assert.equal(push.name, 'Push Day'); assert.equal(push.date, '2025-01-12');
  assert.equal(push.exercises.length, 2);
  assert.equal(push.exercises[0].sets[0].type, 'warmup'); assert.equal(push.exercises[0].sets[1].w, 100);
  assert.equal(workoutSummary(push).durationSec, 58 * 60);
});

test('Hevy legacy / Strong format with lbs', () => {
  const csv = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2025-02-01 09:00:00,Legs,1h 5m,Squat (Barbell),1,225,5,,,,,
2025-02-01 09:00:00,Legs,1h 5m,Squat (Barbell),2,225,5,,,,,`;
  const { kind, workouts } = importCSV(csv);
  assert.equal(kind, 'strong'); assert.equal(workouts.length, 1);
  assert.equal(workouts[0].exercises[0].sets.length, 2);
  assert.ok(Math.abs(workouts[0].exercises[0].sets[0].w - 102.06) < 0.05);
  assert.equal(workoutSummary(workouts[0]).durationSec, 65 * 60);
});

test('Fitbod export groups per-set rows into one workout per session', () => {
  const csv = `Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier
2025-03-03 17:01:10 +0000,Dumbbell Bench Press,10,30,0,0,0,0,false,,2
2025-03-03 17:05:40 +0000,Dumbbell Bench Press,10,30,0,0,0,0,false,,2
2025-03-03 17:20:00 +0000,Cable Row,12,50,0,0,0,0,false,,1
2025-03-05 17:00:00 +0000,Back Squat,5,100,0,0,0,0,true,,1
2025-03-05 17:04:00 +0000,Back Squat,5,120,0,0,0,0,false,,1`;
  const { kind, workouts } = importCSV(csv);
  assert.equal(kind, 'fitbod'); assert.equal(workouts.length, 2);
  assert.equal(workouts[0].exercises.length, 2);
  assert.equal(workouts[1].exercises[0].sets[0].type, 'warmup');
  assert.ok(workouts[0].endedAt > workouts[0].startedAt);
});

test('exercise name normalisation moves the equipment to the front', () => {
  assert.equal(normalizeExerciseName('Bench Press (Barbell)'), 'barbell bench press');
  assert.equal(normalizeExerciseName('  Lat  Pulldown (Cable) '), 'cable lat pulldown');
  assert.equal(normalizeExerciseName('Pull Up'), 'pull up');
});
