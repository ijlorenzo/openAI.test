// Forgiving food search: accent/case folding, plural → singular stemming,
// synonyms, prefix matching on any word, and typo tolerance (one edit) when
// a term has no exact or prefix match.

const ALIASES = {
  pb: 'peanut butter', yoghurt: 'yogurt', yogourt: 'yogurt', oatmeal: 'oats', porridge: 'oats',
  soda: 'cola', pop: 'cola', fries: 'french fries', chips: 'chips', avo: 'avocado', gherkin: 'pickle',
  gherkins: 'pickle', courgette: 'zucchini', aubergine: 'eggplant', capsicum: 'bell pepper',
  prawn: 'shrimp', prawns: 'shrimp', mince: 'ground', hamburger: 'cheeseburger', rotisserie: 'roasted',
  bbq: 'barbecue', mayo: 'mayonnaise', oj: 'orange juice', choc: 'chocolate', veg: 'vegetable',
  veggies: 'vegetable', taters: 'potato', spuds: 'potato', garbanzo: 'chickpea', garbanzos: 'chickpea',
  cilantro: 'coriander', scallion: 'onion', scallions: 'onion', 'spring onion': 'onion',
  kimchee: 'kimchi', gimchi: 'kimchi', sauerkraut: 'sauerkraut', kraut: 'sauerkraut',
  mozz: 'mozzarella', parm: 'parmesan', ww: 'whole wheat', 'sweet potatoes': 'sweet potato',
};

export const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Light English singularizer for food words. */
export function stem(w) {
  if (w.length <= 3) return w;
  if (/(ss|us|is)$/.test(w)) return w;
  if (/ies$/.test(w)) return w.slice(0, -3) + 'y';          // berries → berry
  if (/(ches|shes|xes|sses|zes)$/.test(w)) return w.slice(0, -2); // peaches → peach
  if (/oes$/.test(w) && w.length > 4) return w.slice(0, -2);  // tomatoes → tomato
  if (/ves$/.test(w)) return w.slice(0, -3) + 'f';           // loaves → loaf (halves → half)
  if (/s$/.test(w)) return w.slice(0, -1);                   // eggs → egg
  return w;
}

export const tokenize = (s) => fold(s).replace(/[^a-z0-9%]+/g, ' ').trim().split(/\s+/).filter(Boolean);

function expandAliases(q) {
  let s = ' ' + fold(q).replace(/[^a-z0-9%\s]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  // multi-word aliases first
  for (const [k, v] of Object.entries(ALIASES)) {
    if (k.includes(' ')) s = s.replace(' ' + k + ' ', ' ' + v + ' ');
  }
  const words = s.trim().split(' ').filter(Boolean).map((w) => (ALIASES[w] && !ALIASES[w].includes(' ') ? ALIASES[w] : (ALIASES[w] || w)));
  return words.join(' ').split(' ').filter(Boolean);
}

/** Damerau–Levenshtein distance capped at 2 (early exit). */
export function editDistance(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const m = a.length, n = b.length;
  let prev2 = null, prev = Array.from({ length: n + 1 }, (_, j) => j), cur;
  for (let i = 1; i <= m; i++) {
    cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + cost);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > 2) return 3;
    prev2 = prev; prev = cur;
  }
  return prev[n];
}

/** Pre-compute the searchable form of a food once. */
export function indexFood(f) {
  const nameWords = tokenize(f.name);
  const extraWords = tokenize(`${f.brand || ''} ${f.tags || ''}`);
  return {
    f,
    nameWords,
    nameStems: nameWords.map(stem),
    firstStem: nameWords.length ? stem(nameWords[0]) : '',
    extraStems: extraWords.map(stem),
    len: nameWords.length,
  };
}

/**
 * Score one indexed food against query terms. Returns 0 when any term fails.
 * Higher is better: first-word match > any name word > tags/brand > typo match.
 */
function scoreEntry(e, terms) {
  let score = 0;
  for (const t of terms) {
    const ts = stem(t);
    let best = 0;
    if (e.firstStem === ts) best = 7;
    else if (e.f.curated && e.nameStems.some((w) => w === ts)) best = 7; // curated names are short: any exact word is the head
    else if (e.firstStem.startsWith(ts) || e.nameWords[0]?.startsWith(t)) best = 6;
    else if (e.nameStems.some((w) => w === ts)) best = 5;
    else if (e.nameStems.some((w) => w.startsWith(ts)) || e.nameWords.some((w) => w.startsWith(t))) best = 4;
    else if (e.extraStems.some((w) => w === ts || w.startsWith(ts))) best = 3;
    else if (ts.length >= 4) {
      // typo tolerance: one edit against any name word (two for long words)
      const allow = ts.length >= 8 ? 2 : 1;
      for (let i = 0; i < e.nameStems.length; i++) {
        const w = e.nameStems[i];
        if (Math.abs(w.length - ts.length) <= allow && editDistance(w, ts) <= allow) { best = i === 0 ? 3 : 2; break; }
      }
    }
    if (!best) return 0;
    score += best;
  }
  return score;
}

/** Search indexed foods. `index` is an array from indexFood. */
export function search(index, query, limit = 60) {
  const terms = expandAliases(query);
  if (!terms.length) return index.map((e) => e.f).slice(0, limit);
  const out = [];
  for (let i = 0; i < index.length; i++) {
    const e = index[i];
    const s = scoreEntry(e, terms);
    if (s > 0) out.push({ e, s, i, c: e.f.curated ? 1 : 0 });
  }
  // Match quality first; then curated (custom + everyday list) over USDA;
  // curated ties keep list order (staples first); USDA ties prefer shorter names.
  out.sort((a, b) => b.s - a.s || b.c - a.c || (a.c ? a.i - b.i : (a.e.len - b.e.len || a.i - b.i)));
  return out.slice(0, limit).map((x) => x.e.f);
}
