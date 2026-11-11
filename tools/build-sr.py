"""Build data/foods-sr.json from USDA SR28 (public domain).

Usage:
  npm pack fda-nutrient-database@1.0.2 --ignore-scripts && tar xzf fda-nutrient-database-1.0.2.tgz
  python3 -I tools/build-sr.py package/data

The ABBREV.txt file holds per-100 g nutrients plus up to two household
measures; FOOD_DES.txt holds the long description and food group.
"""
import json, re, sys, os

src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), '..', 'data', 'foods-sr.json')

GROUPS = {
    '0100': 'dairy', '0200': 'spice', '0300': 'baby', '0400': 'fat oil', '0500': 'poultry',
    '0600': 'soup sauce', '0700': 'sausage deli', '0800': 'cereal breakfast', '0900': 'fruit',
    '1000': 'pork', '1100': 'vegetable', '1200': 'nut seed', '1300': 'beef', '1400': 'drink',
    '1500': 'fish seafood', '1600': 'legume', '1700': 'lamb game', '1800': 'baked bread',
    '1900': 'sweet dessert', '2000': 'grain pasta', '2100': 'fast food', '2200': 'meal',
    '2500': 'snack', '3500': 'native', '3600': 'restaurant',
}
SKIP_GROUPS = {'0300', '3500'}
SKIP_RE = re.compile(r'USDA Commodity|Infant formula|Babyfood|Formulated bar|Beverages, Protein powder', re.I)

def parse_line(line):
    parts = line.rstrip('\r\n').split('^')
    return [p.strip('~') for p in parts]

desc = {}
with open(os.path.join(src, 'FOOD_DES.txt'), encoding='latin-1') as fh:
    for line in fh:
        p = parse_line(line)
        desc[p[0]] = (p[1], p[2])  # group, long description

def num(s):
    try:
        return float(s)
    except ValueError:
        return None

def tidy_measure(d):
    d = d.strip()
    d = re.sub(r'\s+', ' ', d)
    d = d.replace(' fl oz', ' fl oz')
    return d

foods = []
kept = skipped = 0
with open(os.path.join(src, 'ABBREV.txt'), encoding='latin-1') as fh:
    for line in fh:
        p = parse_line(line)
        ndb = p[0]
        group, name = desc.get(ndb, ('', p[1].title()))
        if group in SKIP_GROUPS or SKIP_RE.search(name):
            skipped += 1
            continue
        kcal, protein, fat, carbs = num(p[3]), num(p[4]), num(p[5]), num(p[7])
        if kcal is None and protein is None and fat is None and carbs is None:
            skipped += 1
            continue
        g1, d1 = num(p[-5]), tidy_measure(p[-4])
        g2, d2 = num(p[-3]), tidy_measure(p[-2])
        serving = None
        for g, d in ((g1, d1), (g2, d2)):
            if g and d and 0 < g <= 2000 and 'serving' not in d.lower():
                serving = (d, round(g))
                break
        if serving is None and g1 and d1:
            serving = (d1, round(g1))
        row = [ndb, name, group, round(kcal or 0), round(protein or 0, 1), round(carbs or 0, 1), round(fat or 0, 1)]
        if serving:
            row += [serving[0], serving[1]]
        foods.append(row)
        kept += 1

with open(out, 'w', encoding='utf-8') as fh:
    json.dump({'source': 'USDA National Nutrient Database for Standard Reference, Release 28 (public domain)', 'groups': GROUPS, 'foods': foods}, fh, ensure_ascii=False, separators=(',', ':'))

print(f'kept {kept}, skipped {skipped}, wrote {out} ({os.path.getsize(out)//1024} KB)')
