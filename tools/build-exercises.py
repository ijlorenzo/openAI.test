"""Build data/exercises.json and data/exercise-instructions.json from the
Free Exercise DB (public domain, Unlicense).

Usage:
  npm pack react-muscle-map@0.1.3 --ignore-scripts && tar xzf react-muscle-map-0.1.3.tgz
  python3 -I tools/build-exercises.py package/datasets/exercises
(or point it at a checkout of github.com/yuhonas/free-exercise-db/exercises)
"""
import json, glob, os, re, sys

src = sys.argv[1]
root = os.path.join(os.path.dirname(__file__), '..', 'data')

# Staples that should surface first in the picker, matched by dataset name.
POPULAR = [
    'Barbell Bench Press - Medium Grip', 'Incline Dumbbell Press', 'Dumbbell Bench Press', 'Barbell Incline Bench Press - Medium Grip',
    'Barbell Squat', 'Front Barbell Squat', 'Barbell Deadlift', 'Romanian Deadlift', 'Sumo Deadlift', 'Stiff-Legged Barbell Deadlift',
    'Standing Military Press', 'Dumbbell Shoulder Press', 'Seated Dumbbell Press', 'Arnold Dumbbell Press', 'Push Press',
    'Pullups', 'Chin-Up', 'Wide-Grip Lat Pulldown', 'Close-Grip Front Lat Pulldown', 'Bent Over Barbell Row', 'One-Arm Dumbbell Row',
    'Seated Cable Rows', 'T-Bar Row with Handle', 'Face Pull', 'Barbell Shrug', 'Dumbbell Shrug',
    'Leg Press', 'Barbell Lunge', 'Dumbbell Lunges', 'Split Squat with Dumbbells', 'Barbell Hip Thrust', 'Barbell Glute Bridge', 'Goblet Squat',
    'Leg Extensions', 'Lying Leg Curls', 'Seated Leg Curl', 'Standing Calf Raises', 'Seated Calf Raise', 'Hack Squat', 'Step-up with Knee Raise',
    'Barbell Curl', 'Dumbbell Bicep Curl', 'Hammer Curls', 'Preacher Curl', 'Incline Dumbbell Curl', 'Cable Hammer Curls - Rope Attachment',
    'Triceps Pushdown', 'Triceps Pushdown - Rope Attachment', 'EZ-Bar Skullcrusher', 'Dips - Triceps Version', 'Dips - Chest Version', 'Close-Grip Barbell Bench Press',
    'Standing Dumbbell Triceps Extension', 'Cable Rope Overhead Triceps Extension',
    'Side Lateral Raise', 'Front Dumbbell Raise', 'Reverse Flyes', 'Cable Crossover', 'Dumbbell Flyes', 'Pushups', 'Incline Push-Up',
    'Plank', 'Hanging Leg Raise', 'Ab Roller', 'Cable Crunch', 'Russian Twist', 'Crunches', 'Decline Crunch', 'Air Bike',
    'One-Arm Kettlebell Swings', 'Power Clean', 'Clean and Jerk', 'Snatch', 'Hang Clean', "Farmer's Walk",
    'Good Morning', 'Hyperextensions (Back Extensions)', 'Glute Ham Raise', 'Pull Through', 'Box Squat', 'Rack Pulls',
    'Upright Barbell Row', 'Cable Rear Delt Fly', 'Concentration Curls', 'EZ-Bar Curl', 'Reverse Barbell Curl',
    'Machine Shoulder (Military) Press', 'Smith Machine Bench Press', 'Smith Machine Squat', 'Leverage Chest Press', 'Butterfly',
    'Running, Treadmill', 'Rowing, Stationary', 'Bicycling, Stationary', 'Rope Jumping', 'Elliptical Trainer', 'Stairmaster', 'Walking, Treadmill',
]
POP = {p.lower(): i for i, p in enumerate(POPULAR)}

MUSCLE_GROUP = {
    'chest': 'chest', 'shoulders': 'shoulders', 'triceps': 'arms', 'biceps': 'arms', 'forearms': 'arms',
    'lats': 'back', 'middle back': 'back', 'lower back': 'back', 'traps': 'back', 'neck': 'back',
    'quadriceps': 'legs', 'hamstrings': 'legs', 'glutes': 'legs', 'calves': 'legs', 'adductors': 'legs', 'abductors': 'legs',
    'abdominals': 'core',
}

rows, instr = [], {}
for f in sorted(glob.glob(os.path.join(src, '*.json'))):
    e = json.load(open(f, encoding='utf-8'))
    name = re.sub(r'\s+', ' ', e['name']).strip()
    pop = POP.get(name.lower())
    rows.append([
        e['id'], name, e.get('equipment') or '', e.get('primaryMuscles') or [], e.get('secondaryMuscles') or [],
        e.get('category') or '', e.get('level') or '', e.get('mechanic') or '', e.get('force') or '',
        pop if pop is not None else -1,
    ])
    if e.get('instructions'):
        instr[e['id']] = e['instructions']

missing = [p for p in POPULAR if p.lower() not in {r[1].lower() for r in rows}]
if missing:
    print('WARNING popular names not found:', missing)

with open(os.path.join(root, 'exercises.json'), 'w', encoding='utf-8') as fh:
    json.dump({'source': 'Free Exercise DB (public domain, Unlicense) https://github.com/yuhonas/free-exercise-db',
               'fields': ['id', 'name', 'equipment', 'primary', 'secondary', 'category', 'level', 'mechanic', 'force', 'popular'],
               'groups': MUSCLE_GROUP, 'exercises': rows}, fh, ensure_ascii=False, separators=(',', ':'))
with open(os.path.join(root, 'exercise-instructions.json'), 'w', encoding='utf-8') as fh:
    json.dump(instr, fh, ensure_ascii=False, separators=(',', ':'))
print(f'{len(rows)} exercises, {sum(1 for r in rows if r[9] >= 0)} popular; '
      f'{os.path.getsize(os.path.join(root, "exercises.json"))//1024} KB + {os.path.getsize(os.path.join(root, "exercise-instructions.json"))//1024} KB instructions')
