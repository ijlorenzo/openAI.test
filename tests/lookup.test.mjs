import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeOff, normalizeUsda, normalizeBarcode } from '../src/lookup.js';

const offProduct = JSON.parse(readFileSync(new URL('./fixtures/off-product.json', import.meta.url))).product;
const offSearch = JSON.parse(readFileSync(new URL('./fixtures/off-search.json', import.meta.url))).products;

test('normalizeOff uses per-serving values when present and keeps per-100g', () => {
  const f = normalizeOff(offProduct);
  assert.equal(f.id, 'off-0737628064502');
  assert.equal(f.brand, 'Simply Asia');
  assert.match(f.name, /Thai peanut noodle kit/i);
  assert.equal(f.serving, '0.333 PACKAGE (52 g)');
  assert.deepEqual([f.kcal, f.protein, f.carbs, f.fat], [200, 5, 37, 4]);
  assert.deepEqual(f.per100, { serving: '100 g', kcal: 385, protein: 9.6, carbs: 71.2, fat: 7.7 });
});

test('normalizeOff handles search hits, deriving serving from serving_quantity', () => {
  const foods = offSearch.map(normalizeOff).filter(Boolean);
  assert.ok(foods.length >= 3);
  for (const f of foods) {
    assert.ok(f.kcal >= 0 && f.protein >= 0);
    assert.ok(f.serving);
    assert.ok(f.id.startsWith('off-'));
  }
});

test('normalizeOff falls back to kJ and rejects empty nutriments', () => {
  const f = normalizeOff({ code: '1', product_name: 'KJ only', nutriments: { energy_100g: 418.4, proteins_100g: 1 } });
  assert.equal(f.kcal, 100);
  assert.equal(f.serving, '100 g');
  assert.equal(normalizeOff({ code: '2', product_name: 'Nothing', nutriments: {} }), null);
  assert.equal(normalizeOff(null), null);
});

test('normalizeUsda scales per-100g nutrients to the labeled serving', () => {
  const f = normalizeUsda({
    fdcId: 123, description: 'GREEK NONFAT YOGURT, PLAIN', brandOwner: 'Chobani, LLC', gtinUpc: '00894700010014',
    servingSize: 170, servingSizeUnit: 'g', householdServingFullText: '1 container',
    foodNutrients: [
      { nutrientId: 1008, value: 59, unitName: 'KCAL' }, { nutrientId: 1003, value: 10 },
      { nutrientId: 1005, value: 3.5 }, { nutrientId: 1004, value: 0 },
    ],
  });
  assert.equal(f.id, 'usda-123');
  assert.equal(f.name, 'Greek Nonfat Yogurt, Plain');
  assert.equal(f.brand, 'Chobani, LLC');
  assert.equal(f.barcode, '894700010014');
  assert.equal(f.serving, '1 container (170 g)');
  assert.deepEqual([f.kcal, f.protein, f.carbs, f.fat], [100, 17, 6, 0]);
  assert.equal(f.per100.kcal, 59);
});

test('normalizeUsda without a gram serving returns per 100 g', () => {
  const f = normalizeUsda({ fdcId: 9, description: 'Apples, raw', foodNutrients: [{ nutrient: { id: 1008 }, amount: 52 }, { nutrient: { id: 1005 }, amount: 13.8 }] });
  assert.equal(f.serving, '100 g');
  assert.equal(f.kcal, 52);
  assert.equal(f.carbs, 13.8);
});

test('normalizeBarcode pads UPC-A to EAN-13 and strips junk', () => {
  assert.equal(normalizeBarcode('737628064502'), '0737628064502');
  assert.equal(normalizeBarcode('5000159484695'), '5000159484695');
  assert.equal(normalizeBarcode(' 12 34-56 78 '), '12345678');
  assert.equal(normalizeBarcode('abc'), null);
});
