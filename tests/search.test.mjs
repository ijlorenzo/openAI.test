import test from 'node:test';
import assert from 'node:assert/strict';
import { stem, editDistance, indexFood, search } from '../src/search.js';
import { FOODS } from '../src/foods.js';

const idx = FOODS.map((f) => indexFood({ ...f, curated: true }));
const names = (q) => search(idx, q).map((f) => f.name);

test('stem singularizes common food plurals', () => {
  assert.equal(stem('eggs'), 'egg');
  assert.equal(stem('berries'), 'berry');
  assert.equal(stem('tomatoes'), 'tomato');
  assert.equal(stem('peaches'), 'peach');
  assert.equal(stem('hummus'), 'hummus');
  assert.equal(stem('oats'), 'oat');
});

test('edit distance handles typos and transpositions', () => {
  assert.equal(editDistance('chiken', 'chicken'), 1);
  assert.equal(editDistance('brocoli', 'broccoli'), 1);
  assert.equal(editDistance('salmno', 'salmon'), 1);
  assert.ok(editDistance('banana', 'cheese') > 2);
});

test('plural query matches singular food', () => {
  const r = names('eggs');
  assert.ok(r[0].startsWith('Egg'), r.slice(0, 3).join(', '));
  assert.ok(r.includes('Egg, large'));
  assert.ok(names('blueberry').includes('Blueberries'));
  assert.ok(names('tomatoes').includes('Tomato'));
});

test('typos still find the food', () => {
  assert.ok(names('chiken breast')[0].startsWith('Chicken breast'));
  assert.ok(names('brocoli')[0].startsWith('Broccoli'));
  assert.ok(names('greek yogrt').some((n) => n.startsWith('Greek yogurt')));
});

test('aliases and synonyms resolve', () => {
  assert.ok(names('pb')[0].startsWith('Peanut butter'));
  assert.ok(names('yoghurt').some((n) => /yogurt/i.test(n)));
  assert.ok(names('prawns')[0].startsWith('Shrimp'));
  assert.ok(names('oj')[0].startsWith('Orange juice'));
});

test('word order and partial words work', () => {
  assert.ok(names('breast chicken')[0].startsWith('Chicken breast'));
  assert.ok(names('swee pot')[0].startsWith('Sweet potato'));
});

test('no match returns empty, and empty query returns everything', () => {
  assert.deepEqual(names('xyzzyq'), []);
  assert.equal(search(idx, '', 1000).length, FOODS.length);
});

import { readFileSync } from 'node:fs';
const sr = JSON.parse(readFileSync(new URL('../data/foods-sr.json', import.meta.url)));
const srIdx = sr.foods.map(([ndb, name, group]) => indexFood({ id: 'sr-' + ndb, name, tags: sr.groups[group] || '' }));
const full = idx.concat(srIdx);
const fullNames = (q) => search(full, q).map((f) => f.name);

test('USDA database covers kimchi and pickles', () => {
  assert.equal(fullNames('kimchi')[0], 'Cabbage, kimchi');
  assert.ok(fullNames('pickles').slice(0, 3).some((n) => n.startsWith('Pickles, cucumber')));
  assert.ok(fullNames('dill pickle')[0].startsWith('Pickles, cucumber, dill'));
  assert.ok(fullNames('sauerkraut')[0].startsWith('Sauerkraut'));
});

test('curated foods outrank USDA variants for everyday queries', () => {
  assert.equal(fullNames('eggs')[0], 'Egg, large');
  assert.equal(fullNames('chicken breast')[0], 'Chicken breast, cooked');
  assert.ok(fullNames('banana')[0] === 'Banana');
});

test('full index search is fast enough for typing', () => {
  const t0 = performance.now();
  for (const q of ['chicken', 'pickles', 'greek yogurt', 'brocoli', 'xyzzy']) search(full, q);
  const ms = (performance.now() - t0) / 5;
  assert.ok(ms < 80, `avg ${ms.toFixed(1)} ms per search`);
});
