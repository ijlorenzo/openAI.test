// Bundled food database. Values are per one serving and are typical
// label / USDA figures rounded for everyday logging.
// Fields: id, name, brand (optional), serving (label), kcal, protein, carbs, fat, tags

const F = (id, name, serving, kcal, protein, carbs, fat, tags = '') =>
  ({ id, name, serving, kcal, protein, carbs, fat, tags });

export const FOODS = [
  // Proteins
  F('chicken-breast', 'Chicken breast, cooked', '100 g', 165, 31, 0, 3.6, 'meat poultry'),
  F('chicken-thigh', 'Chicken thigh, cooked, skinless', '100 g', 209, 26, 0, 10.9, 'meat poultry'),
  F('turkey-breast', 'Turkey breast, cooked', '100 g', 135, 30, 0, 1, 'meat poultry'),
  F('ground-turkey-93', 'Ground turkey 93/7, cooked', '100 g', 203, 27, 0, 10, 'meat'),
  F('ground-beef-90', 'Ground beef 90/10, cooked', '100 g', 217, 26, 0, 12, 'meat'),
  F('ground-beef-80', 'Ground beef 80/20, cooked', '100 g', 254, 26, 0, 16, 'meat'),
  F('sirloin', 'Sirloin steak, cooked', '100 g', 206, 29, 0, 9.5, 'meat beef'),
  F('ribeye', 'Ribeye steak, cooked', '100 g', 291, 24, 0, 21, 'meat beef'),
  F('pork-tenderloin', 'Pork tenderloin, cooked', '100 g', 143, 26, 0, 3.5, 'meat'),
  F('pork-chop', 'Pork chop, cooked', '100 g', 231, 26, 0, 14, 'meat'),
  F('bacon', 'Bacon, cooked', '1 slice (8 g)', 43, 3, 0.1, 3.3, 'meat breakfast'),
  F('salmon', 'Salmon, cooked', '100 g', 206, 22, 0, 12, 'fish seafood'),
  F('tuna-can', 'Tuna, canned in water', '1 can (120 g drained)', 130, 29, 0, 1, 'fish seafood'),
  F('cod', 'Cod, cooked', '100 g', 105, 23, 0, 0.9, 'fish seafood'),
  F('tilapia', 'Tilapia, cooked', '100 g', 128, 26, 0, 2.7, 'fish seafood'),
  F('shrimp', 'Shrimp, cooked', '100 g', 99, 24, 0.2, 0.3, 'seafood'),
  F('egg', 'Egg, large', '1 egg (50 g)', 72, 6.3, 0.4, 4.8, 'breakfast'),
  F('egg-white', 'Egg white', '1 large (33 g)', 17, 3.6, 0.2, 0.1, 'breakfast'),
  F('liquid-egg-whites', 'Liquid egg whites', '1/4 cup (61 g)', 30, 6, 1, 0, 'breakfast'),
  F('tofu-firm', 'Tofu, firm', '100 g', 144, 17, 3, 8.7, 'vegan plant'),
  F('tempeh', 'Tempeh', '100 g', 192, 20, 8, 11, 'vegan plant'),
  F('whey', 'Whey protein powder', '1 scoop (31 g)', 120, 24, 3, 1.5, 'supplement shake'),
  F('casein', 'Casein protein powder', '1 scoop (33 g)', 120, 24, 3, 1, 'supplement shake'),
  F('plant-protein', 'Plant protein powder', '1 scoop (35 g)', 130, 21, 6, 2.5, 'supplement shake vegan'),
  F('greek-yogurt-0', 'Greek yogurt, nonfat plain', '170 g (3/4 cup)', 100, 17, 6, 0.7, 'dairy breakfast'),
  F('greek-yogurt-2', 'Greek yogurt, 2% plain', '170 g (3/4 cup)', 130, 17, 6, 3.5, 'dairy breakfast'),
  F('cottage-cheese', 'Cottage cheese, 2%', '1/2 cup (113 g)', 90, 12, 5, 2.5, 'dairy'),
  F('skyr', 'Skyr, plain', '150 g', 95, 16, 6, 0.3, 'dairy breakfast'),
  F('deli-turkey', 'Deli turkey', '2 oz (56 g)', 60, 11, 2, 1, 'meat lunch'),
  F('jerky', 'Beef jerky', '1 oz (28 g)', 116, 9.4, 3, 7, 'snack meat'),
  F('edamame', 'Edamame, shelled', '1 cup (155 g)', 188, 18, 14, 8, 'vegan plant snack'),
  F('lentils', 'Lentils, cooked', '1 cup (198 g)', 230, 18, 40, 0.8, 'vegan plant legume'),
  F('black-beans', 'Black beans, cooked', '1 cup (172 g)', 227, 15, 41, 0.9, 'vegan legume'),
  F('chickpeas', 'Chickpeas, cooked', '1 cup (164 g)', 269, 15, 45, 4.2, 'vegan legume'),

  // Carbs
  F('rice-white', 'White rice, cooked', '1 cup (158 g)', 205, 4.3, 45, 0.4, 'grain'),
  F('rice-brown', 'Brown rice, cooked', '1 cup (195 g)', 216, 5, 45, 1.8, 'grain'),
  F('jasmine-rice-100', 'Jasmine rice, cooked', '100 g', 130, 2.7, 28, 0.3, 'grain'),
  F('oats', 'Rolled oats, dry', '1/2 cup (40 g)', 150, 5, 27, 3, 'grain breakfast'),
  F('quinoa', 'Quinoa, cooked', '1 cup (185 g)', 222, 8, 39, 3.6, 'grain'),
  F('pasta', 'Pasta, cooked', '1 cup (140 g)', 220, 8, 43, 1.3, 'grain'),
  F('pasta-dry', 'Pasta, dry', '2 oz (56 g)', 200, 7, 42, 1, 'grain'),
  F('potato', 'Potato, baked, with skin', '1 medium (173 g)', 161, 4.3, 37, 0.2, 'vegetable starch'),
  F('sweet-potato', 'Sweet potato, baked', '1 medium (114 g)', 103, 2.3, 24, 0.2, 'vegetable starch'),
  F('bread-white', 'White bread', '1 slice (28 g)', 75, 2.5, 14, 1, 'bread'),
  F('bread-whole-wheat', 'Whole wheat bread', '1 slice (32 g)', 81, 4, 14, 1.1, 'bread'),
  F('sourdough', 'Sourdough bread', '1 slice (50 g)', 130, 5, 25, 0.8, 'bread'),
  F('bagel', 'Bagel, plain', '1 bagel (98 g)', 270, 10, 53, 1.5, 'bread breakfast'),
  F('english-muffin', 'English muffin', '1 muffin (57 g)', 130, 5, 25, 1, 'bread breakfast'),
  F('tortilla-flour', 'Flour tortilla', '1 medium (45 g)', 140, 4, 24, 3.5, 'bread'),
  F('tortilla-corn', 'Corn tortilla', '1 tortilla (26 g)', 52, 1.4, 11, 0.7, 'bread'),
  F('pita', 'Pita bread', '1 pita (60 g)', 165, 5.5, 33, 0.7, 'bread'),
  F('rice-cake', 'Rice cake, plain', '1 cake (9 g)', 35, 0.7, 7.3, 0.3, 'snack'),
  F('granola', 'Granola', '1/2 cup (55 g)', 240, 6, 36, 9, 'breakfast'),
  F('cereal-cheerios', 'Cheerios', '1.5 cups (39 g)', 140, 5, 29, 2.5, 'breakfast cereal'),
  F('cream-of-rice', 'Cream of rice, dry', '1/4 cup (45 g)', 160, 3, 36, 0, 'breakfast grain'),
  F('pancake', 'Pancake', '1 medium (4 in)', 93, 2.6, 15, 2.3, 'breakfast'),
  F('waffle', 'Waffle, frozen', '1 waffle (35 g)', 95, 2.2, 15, 3, 'breakfast'),

  // Fruit
  F('banana', 'Banana', '1 medium (118 g)', 105, 1.3, 27, 0.4, 'fruit'),
  F('apple', 'Apple', '1 medium (182 g)', 95, 0.5, 25, 0.3, 'fruit'),
  F('orange', 'Orange', '1 medium (131 g)', 62, 1.2, 15, 0.2, 'fruit'),
  F('blueberries', 'Blueberries', '1 cup (148 g)', 84, 1.1, 21, 0.5, 'fruit'),
  F('strawberries', 'Strawberries', '1 cup (152 g)', 49, 1, 12, 0.5, 'fruit'),
  F('grapes', 'Grapes', '1 cup (151 g)', 104, 1.1, 27, 0.2, 'fruit'),
  F('mango', 'Mango', '1 cup (165 g)', 99, 1.4, 25, 0.6, 'fruit'),
  F('pineapple', 'Pineapple', '1 cup (165 g)', 82, 0.9, 22, 0.2, 'fruit'),
  F('watermelon', 'Watermelon', '1 cup (152 g)', 46, 0.9, 11, 0.2, 'fruit'),
  F('avocado', 'Avocado', '1/2 medium (68 g)', 114, 1.3, 6, 10.5, 'fruit fat'),
  F('raisins', 'Raisins', '1/4 cup (40 g)', 120, 1.2, 32, 0.2, 'fruit snack'),
  F('dates', 'Medjool date', '1 date (24 g)', 66, 0.4, 18, 0, 'fruit snack'),

  // Vegetables
  F('broccoli', 'Broccoli, cooked', '1 cup (156 g)', 55, 3.7, 11, 0.6, 'vegetable'),
  F('spinach', 'Spinach, raw', '2 cups (60 g)', 14, 1.7, 2.2, 0.2, 'vegetable'),
  F('mixed-greens', 'Mixed salad greens', '2 cups (85 g)', 20, 1.5, 3.5, 0.3, 'vegetable salad'),
  F('carrot', 'Carrots, raw', '1 cup (128 g)', 52, 1.2, 12, 0.3, 'vegetable'),
  F('tomato', 'Tomato', '1 medium (123 g)', 22, 1.1, 4.8, 0.2, 'vegetable'),
  F('cucumber', 'Cucumber', '1 cup (104 g)', 16, 0.7, 3.8, 0.1, 'vegetable'),
  F('bell-pepper', 'Bell pepper', '1 medium (119 g)', 31, 1, 7, 0.3, 'vegetable'),
  F('onion', 'Onion', '1/2 cup (80 g)', 32, 0.9, 7.5, 0.1, 'vegetable'),
  F('asparagus', 'Asparagus, cooked', '1 cup (180 g)', 40, 4.3, 7.4, 0.4, 'vegetable'),
  F('green-beans', 'Green beans, cooked', '1 cup (125 g)', 44, 2.4, 10, 0.4, 'vegetable'),
  F('zucchini', 'Zucchini, cooked', '1 cup (180 g)', 27, 2, 4.9, 0.6, 'vegetable'),
  F('mushrooms', 'Mushrooms, raw', '1 cup (70 g)', 15, 2.2, 2.3, 0.2, 'vegetable'),
  F('corn', 'Corn, sweet, cooked', '1 ear (103 g)', 99, 3.5, 22, 1.5, 'vegetable starch'),
  F('peas', 'Green peas, cooked', '1 cup (160 g)', 134, 8.6, 25, 0.4, 'vegetable'),
  F('cauliflower-rice', 'Cauliflower rice', '1 cup (107 g)', 27, 2, 5, 0.3, 'vegetable'),

  // Dairy & fats
  F('milk-whole', 'Milk, whole', '1 cup (244 g)', 149, 8, 12, 8, 'dairy drink'),
  F('milk-2', 'Milk, 2%', '1 cup (244 g)', 122, 8, 12, 4.8, 'dairy drink'),
  F('milk-skim', 'Milk, skim', '1 cup (245 g)', 83, 8.3, 12, 0.2, 'dairy drink'),
  F('almond-milk', 'Almond milk, unsweetened', '1 cup (240 g)', 30, 1, 1, 2.5, 'drink vegan'),
  F('oat-milk', 'Oat milk', '1 cup (240 g)', 120, 3, 16, 5, 'drink vegan'),
  F('cheddar', 'Cheddar cheese', '1 oz (28 g)', 114, 7, 0.4, 9.4, 'dairy cheese'),
  F('mozzarella', 'Mozzarella, part skim', '1 oz (28 g)', 72, 6.9, 0.8, 4.5, 'dairy cheese'),
  F('feta', 'Feta cheese', '1 oz (28 g)', 75, 4, 1.2, 6, 'dairy cheese'),
  F('parmesan', 'Parmesan, grated', '1 tbsp (5 g)', 22, 1.5, 0.2, 1.4, 'dairy cheese'),
  F('cream-cheese', 'Cream cheese', '1 tbsp (14.5 g)', 51, 0.9, 0.8, 5, 'dairy'),
  F('butter', 'Butter', '1 tbsp (14 g)', 102, 0.1, 0, 11.5, 'fat'),
  F('olive-oil', 'Olive oil', '1 tbsp (14 g)', 119, 0, 0, 13.5, 'fat oil'),
  F('coconut-oil', 'Coconut oil', '1 tbsp (14 g)', 121, 0, 0, 13.5, 'fat oil'),
  F('mayo', 'Mayonnaise', '1 tbsp (14 g)', 94, 0.1, 0.1, 10, 'fat condiment'),
  F('peanut-butter', 'Peanut butter', '2 tbsp (32 g)', 190, 7, 7, 16, 'fat nut'),
  F('almond-butter', 'Almond butter', '2 tbsp (32 g)', 196, 6.7, 6, 18, 'fat nut'),
  F('almonds', 'Almonds', '1 oz (28 g, ~23)', 164, 6, 6, 14, 'nut snack'),
  F('walnuts', 'Walnuts', '1 oz (28 g)', 185, 4.3, 3.9, 18.5, 'nut snack'),
  F('cashews', 'Cashews', '1 oz (28 g)', 157, 5.2, 8.6, 12.4, 'nut snack'),
  F('pistachios', 'Pistachios, shelled', '1 oz (28 g)', 159, 5.7, 7.7, 12.8, 'nut snack'),
  F('chia', 'Chia seeds', '1 tbsp (12 g)', 58, 2, 5, 3.7, 'seed'),
  F('flax', 'Ground flaxseed', '1 tbsp (7 g)', 37, 1.3, 2, 3, 'seed'),
  F('hummus', 'Hummus', '2 tbsp (30 g)', 70, 2, 6, 5, 'dip legume'),
  F('guacamole', 'Guacamole', '2 tbsp (30 g)', 50, 0.6, 2.7, 4.5, 'dip'),

  // Condiments & misc
  F('honey', 'Honey', '1 tbsp (21 g)', 64, 0.1, 17, 0, 'sweet'),
  F('maple-syrup', 'Maple syrup', '1 tbsp (20 g)', 52, 0, 13, 0, 'sweet'),
  F('sugar', 'Sugar', '1 tsp (4 g)', 16, 0, 4, 0, 'sweet'),
  F('jam', 'Jam / jelly', '1 tbsp (20 g)', 56, 0.1, 14, 0, 'sweet spread'),
  F('ketchup', 'Ketchup', '1 tbsp (17 g)', 17, 0.2, 4.5, 0, 'condiment'),
  F('bbq-sauce', 'BBQ sauce', '2 tbsp (36 g)', 58, 0.3, 14, 0.2, 'condiment'),
  F('soy-sauce', 'Soy sauce', '1 tbsp (16 g)', 9, 1.3, 0.8, 0, 'condiment'),
  F('salsa', 'Salsa', '2 tbsp (32 g)', 10, 0.5, 2, 0, 'condiment'),
  F('ranch', 'Ranch dressing', '2 tbsp (30 g)', 129, 0.4, 1.8, 13.4, 'condiment dressing'),
  F('balsamic', 'Balsamic vinaigrette', '2 tbsp (30 g)', 90, 0, 4, 8, 'condiment dressing'),
  F('marinara', 'Marinara sauce', '1/2 cup (125 g)', 70, 2, 10, 2.5, 'sauce'),
  F('dark-chocolate', 'Dark chocolate 70%', '1 oz (28 g)', 170, 2.2, 13, 12, 'sweet snack'),
  F('milk-chocolate', 'Milk chocolate', '1 oz (28 g)', 152, 2.2, 17, 8.5, 'sweet snack'),
  F('protein-bar', 'Protein bar', '1 bar (60 g)', 210, 20, 22, 7, 'snack supplement'),
  F('popcorn', 'Popcorn, air popped', '3 cups (24 g)', 93, 3, 19, 1.1, 'snack'),
  F('tortilla-chips', 'Tortilla chips', '1 oz (28 g)', 140, 2, 19, 7, 'snack'),
  F('potato-chips', 'Potato chips', '1 oz (28 g)', 152, 2, 15, 10, 'snack'),
  F('pretzels', 'Pretzels', '1 oz (28 g)', 108, 2.6, 23, 0.8, 'snack'),
  F('crackers', 'Crackers, whole grain', '5 crackers (16 g)', 70, 1.5, 11, 2.5, 'snack'),
  F('ice-cream', 'Ice cream, vanilla', '1/2 cup (66 g)', 137, 2.3, 16, 7, 'sweet dessert'),
  F('cookie', 'Chocolate chip cookie', '1 cookie (30 g)', 148, 1.6, 20, 7, 'sweet dessert'),

  // Drinks
  F('coffee', 'Coffee, black', '1 cup (240 g)', 2, 0.3, 0, 0, 'drink'),
  F('latte', 'Latte, 2% milk', '12 oz', 120, 8, 12, 4.5, 'drink coffee'),
  F('orange-juice', 'Orange juice', '1 cup (248 g)', 112, 1.7, 26, 0.5, 'drink'),
  F('beer', 'Beer, regular', '12 oz (355 ml)', 153, 1.6, 13, 0, 'drink alcohol'),
  F('wine', 'Wine, red', '5 oz (148 ml)', 125, 0.1, 3.8, 0, 'drink alcohol'),
  F('soda', 'Soda, cola', '12 oz (355 ml)', 140, 0, 39, 0, 'drink'),
  F('sports-drink', 'Sports drink', '20 oz (591 ml)', 140, 0, 36, 0, 'drink'),

  // Fast food / meals
  F('cheeseburger', 'Cheeseburger, fast food', '1 burger', 303, 15, 30, 14, 'fast food meal'),
  F('pizza-slice', 'Pizza, cheese', '1 slice (107 g)', 285, 12, 36, 10, 'fast food meal'),
  F('burrito', 'Burrito, chicken', '1 burrito', 970, 50, 110, 35, 'fast food meal'),
  F('burrito-bowl', 'Burrito bowl, chicken', '1 bowl', 690, 45, 70, 25, 'fast food meal'),
  F('sushi-roll', 'Sushi roll, California', '8 pieces', 255, 9, 38, 7, 'meal'),
  F('caesar-salad-chicken', 'Chicken Caesar salad', '1 salad', 470, 37, 15, 29, 'meal salad'),
  F('pbj', 'Peanut butter & jelly sandwich', '1 sandwich', 376, 12, 48, 16, 'meal lunch'),
  F('turkey-sandwich', 'Turkey sandwich', '1 sandwich', 320, 25, 38, 7, 'meal lunch'),
  F('ramen', 'Instant ramen', '1 package (85 g)', 380, 8, 52, 14, 'meal'),
  F('mac-cheese', 'Mac & cheese', '1 cup (200 g)', 310, 12, 42, 10, 'meal'),
  F('chicken-nuggets', 'Chicken nuggets', '6 pieces', 270, 14, 16, 17, 'fast food'),
  F('fries', 'French fries, medium', '1 medium (117 g)', 365, 4, 48, 17, 'fast food'),
];

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function searchFoods(query, extra = []) {
  const q = norm(query.trim());
  const all = [...extra, ...FOODS];
  if (!q) return all;
  const terms = q.split(/\s+/);
  const scored = [];
  for (const f of all) {
    const hay = norm(`${f.name} ${f.brand || ''} ${f.tags || ''}`);
    const name = norm(f.name);
    let score = 0;
    for (const t of terms) {
      if (name.startsWith(t)) score += 3;
      else if (name.split(/[\s,]+/).some((w) => w.startsWith(t))) score += 2;
      else if (hay.includes(t)) score += 1;
      else { score = 0; break; }
    }
    if (score > 0) scored.push({ f, score });
  }
  scored.sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name));
  return scored.map((s) => s.f);
}
