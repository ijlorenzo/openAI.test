// Resolve program exercise names to library ids and write data/programs.json.
// Usage: node tools/build-programs.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import programs from './programs.mjs';

const data = JSON.parse(readFileSync(new URL('../data/exercises.json', import.meta.url)));
const byName = new Map(data.exercises.map((r) => [r[1].toLowerCase(), r]));
const byId = new Map(data.exercises.map((r) => [r[0], r]));
const MODE = data.fields.indexOf('mode');
let bad = [];
const out = programs.map((p) => ({
  ...p,
  days: p.days.map((d) => ({
    name: d.name,
    exercises: d.exercises.map((e) => {
      const row = e.name.startsWith('x-') ? byId.get(e.name) : byName.get(e.name.toLowerCase());
      if (!row) { bad.push(`${p.id}: ${e.name}`); return null; }
      return { exerciseId: row[0], name: row[1], mode: row[MODE], sets: e.sets, reps: e.reps, restSec: e.restSec, ...(e.progress ? { progress: e.progress } : {}) };
    }).filter(Boolean),
  })),
}));
if (bad.length) { console.error('Unresolved exercises:\n  ' + bad.join('\n  ')); process.exit(1); }
writeFileSync(new URL('../data/programs.json', import.meta.url), JSON.stringify({ programs: out }));
console.log(`${out.length} programs, ${out.reduce((n, p) => n + p.days.length, 0)} routines written`);
