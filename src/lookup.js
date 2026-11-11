// Online food lookup: Open Food Facts (no key) with optional USDA FoodData
// Central fallback (user-supplied key). Normalizers are pure and tested.

const OFF = 'https://world.openfoodfacts.org';
const USDA = 'https://api.nal.usda.gov/fdc/v1';
// Browsers cannot set User-Agent, so identify the app via query params as
// Open Food Facts recommends for web apps.
const APP = 'app_name=macro-log&app_version=1.0';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const r1 = (n) => Math.round(n * 10) / 10;
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Normalize an Open Food Facts product into our food shape. Returns null if unusable. */
export function normalizeOff(p) {
  if (!p || !p.nutriments) return null;
  const n = p.nutriments;
  let kcal100 = num(n['energy-kcal_100g']);
  if (kcal100 == null && num(n.energy_100g) != null) kcal100 = num(n.energy_100g) / 4.184;
  const p100 = num(n.proteins_100g), c100 = num(n.carbohydrates_100g), f100 = num(n.fat_100g);
  if (kcal100 == null && p100 == null && c100 == null && f100 == null) return null;
  const per100 = { serving: '100 g', kcal: Math.round(kcal100 ?? ((p100 || 0) * 4 + (c100 || 0) * 4 + (f100 || 0) * 9)), protein: r1(p100 || 0), carbs: r1(c100 || 0), fat: r1(f100 || 0) };

  const name = clean(p.product_name || p.product_name_en || p.generic_name) || 'Unnamed product';
  const brand = clean((p.brands || '').split(',')[0]);
  const code = String(p.code || '');
  const base = { id: `off-${code}`, source: 'off', barcode: code, name, brand };

  const sq = num(p.serving_quantity);
  const servingLabel = clean(p.serving_size);
  if (servingLabel && (sq > 0 || num(n['energy-kcal_serving']) != null)) {
    const scale = sq > 0 ? sq / 100 : null;
    const pick = (k, v100) => {
      const s = num(n[`${k}_serving`]);
      if (s != null) return s;
      return scale != null && v100 != null ? v100 * scale : 0;
    };
    const kcalS = num(n['energy-kcal_serving']) ?? (scale != null && kcal100 != null ? kcal100 * scale : null) ?? (num(n.energy_serving) != null ? num(n.energy_serving) / 4.184 : null);
    const serving = { serving: servingLabel, kcal: Math.round(kcalS ?? (pick('proteins', p100) * 4 + pick('carbohydrates', c100) * 4 + pick('fat', f100) * 9)), protein: r1(pick('proteins', p100)), carbs: r1(pick('carbohydrates', c100)), fat: r1(pick('fat', f100)) };
    return { ...base, ...serving, per100 };
  }
  return { ...base, ...per100 };
}

/** Normalize a USDA FoodData Central search hit (Branded, Foundation or SR Legacy). */
export function normalizeUsda(f) {
  if (!f || !Array.isArray(f.foodNutrients)) return null;
  const byId = {};
  for (const nn of f.foodNutrients) {
    const id = nn.nutrientId ?? nn.nutrient?.id;
    const val = nn.value ?? nn.amount;
    if (id != null && val != null && byId[id] == null) byId[id] = Number(val);
  }
  // 1008 Energy kcal, 2047/2048 energy (Atwater), 1003 protein, 1005 carbs, 1004 fat. Values per 100 g.
  const kcal100 = byId[1008] ?? byId[2048] ?? byId[2047];
  const p100 = byId[1003] ?? 0, c100 = byId[1005] ?? 0, f100 = byId[1004] ?? 0;
  if (kcal100 == null && !p100 && !c100 && !f100) return null;
  const per100 = { serving: '100 g', kcal: Math.round(kcal100 ?? (p100 * 4 + c100 * 4 + f100 * 9)), protein: r1(p100), carbs: r1(c100), fat: r1(f100) };
  const name = titleCase(clean(f.description));
  const brand = clean(f.brandName || f.brandOwner);
  const base = { id: `usda-${f.fdcId}`, source: 'usda', barcode: f.gtinUpc ? String(f.gtinUpc).replace(/^0+/, '') : undefined, name, brand };
  const ss = num(f.servingSize);
  const unit = String(f.servingSizeUnit || '').toLowerCase();
  if (ss > 0 && (unit === 'g' || unit === 'grm' || unit === 'ml' || unit === 'mlt')) {
    const scale = ss / 100;
    const house = clean(f.householdServingFullText);
    const label = house ? `${house} (${ss} ${unit.startsWith('g') ? 'g' : 'ml'})` : `${ss} ${unit.startsWith('g') ? 'g' : 'ml'}`;
    return { ...base, serving: label, kcal: Math.round(per100.kcal * scale), protein: r1(p100 * scale), carbs: r1(c100 * scale), fat: r1(f100 * scale), per100 };
  }
  return { ...base, ...per100 };
}

function titleCase(s) {
  if (!s) return s;
  if (s !== s.toUpperCase()) return s; // already mixed case
  return s.toLowerCase().replace(/(^|[\s(\-/])([a-z])/g, (m, a, b) => a + b.toUpperCase());
}

/** Normalize a scanned/typed barcode: digits only; UPC-A (12) → EAN-13 by zero padding for OFF. */
export function normalizeBarcode(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 12) return '0' + d;
  return d;
}

async function getJSON(url, { timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    try {
      res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('The food database took too long to answer. Try again.');
      throw new Error('Could not reach the food database. Check your connection and try again.');
    }
    if (res.status === 429 || res.status === 503) throw new Error('The food database is busy. Try again in a minute.');
    if (!res.ok && res.status !== 404) throw new Error(`Lookup failed (${res.status})`);
    const text = await res.text();
    try { return JSON.parse(text); } catch { throw new Error('The food database is busy. Try again in a minute.'); }
  } finally {
    clearTimeout(t);
  }
}

const OFF_FIELDS = 'code,product_name,product_name_en,generic_name,brands,serving_size,serving_quantity,nutriments';

export async function offProduct(barcode) {
  const d = await getJSON(`${OFF}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}&${APP}`);
  if (!d || d.status !== 1 || !d.product) return null;
  return normalizeOff(d.product);
}

export async function offSearch(query, { pageSize = 15 } = {}) {
  const d = await getJSON(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${pageSize}&fields=${OFF_FIELDS}&${APP}`);
  return (d?.products || []).map(normalizeOff).filter(Boolean);
}

export async function usdaByUpc(upc, key) {
  if (!key) return null;
  const q = String(upc).replace(/^0+/, '');
  const d = await getJSON(`${USDA}/foods/search?query=${encodeURIComponent(q)}&dataType=Branded&pageSize=5&api_key=${encodeURIComponent(key)}`);
  if (d?.error) throw new Error(d.error.message || 'USDA lookup failed');
  const hit = (d?.foods || []).find((f) => String(f.gtinUpc || '').replace(/^0+/, '') === q);
  return hit ? normalizeUsda(hit) : null;
}

export async function usdaSearch(query, key, { pageSize = 15 } = {}) {
  if (!key) return [];
  const d = await getJSON(`${USDA}/foods/search?query=${encodeURIComponent(query)}&dataType=Branded,Foundation,SR%20Legacy&pageSize=${pageSize}&api_key=${encodeURIComponent(key)}`);
  if (d?.error) throw new Error(d.error.message || 'USDA search failed');
  return (d?.foods || []).map(normalizeUsda).filter(Boolean);
}

/** Look a barcode up in Open Food Facts, then USDA if a key is configured. */
export async function lookupBarcode(raw, { usdaKey } = {}) {
  const code = normalizeBarcode(raw);
  if (!code) return { code: null, food: null };
  let food = null, error = null;
  try { food = await offProduct(code); } catch (e) { error = e; }
  if (!food && usdaKey) {
    try { food = await usdaByUpc(code, usdaKey); error = null; } catch (e) { error = error || e; }
  }
  if (!food && error) throw error;
  return { code, food };
}

/** Search both sources and merge, Open Food Facts first. */
export async function searchOnline(query, { usdaKey } = {}) {
  const [off, usda] = await Promise.allSettled([offSearch(query), usdaSearch(query, usdaKey)]);
  const out = [];
  if (off.status === 'fulfilled') out.push(...off.value);
  if (usda.status === 'fulfilled') out.push(...usda.value);
  if (!out.length) {
    const err = off.status === 'rejected' ? off.reason : usda.status === 'rejected' ? usda.reason : null;
    if (err) throw err;
  }
  return out;
}
