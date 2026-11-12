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

# Extra movements the dataset lacks: functional, balance, mobility, yoga, cardio.
# [id, name, equipment, primary, secondary, category, level, mechanic, force, mode]
X = lambda id, name, eq, prim, sec, cat, mode, level='beginner', mech='compound', force='static': [id, name, eq, prim, sec, cat, level, mech, force, -1, mode]
EXTRAS = [
    X('x-cossack-squat', 'Cossack Squat', 'body only', ['adductors', 'quadriceps'], ['glutes', 'hamstrings'], 'mobility', 'strength', force='push'),
    X('x-90-90', '90/90 Hip Switch', 'body only', ['abductors', 'adductors'], ['glutes'], 'mobility', 'strength'),
    X('x-couch-stretch', 'Couch Stretch', 'body only', ['quadriceps'], ['abductors'], 'mobility', 'timed', mech='isolation'),
    X('x-dead-hang', 'Dead Hang', 'body only', ['forearms', 'lats'], ['shoulders'], 'mobility', 'timed'),
    X('x-copenhagen-plank', 'Copenhagen Plank', 'body only', ['adductors', 'abdominals'], [], 'strength', 'timed'),
    X('x-hip-airplane', 'Hip Airplane', 'body only', ['glutes'], ['hamstrings', 'abductors'], 'balance', 'strength', force='pull'),
    X('x-single-leg-rdl', 'Single-Leg Romanian Deadlift', 'dumbbell', ['hamstrings', 'glutes'], ['lower back'], 'strength', 'strength', force='pull'),
    X('x-pistol-squat', 'Pistol Squat', 'body only', ['quadriceps', 'glutes'], ['hamstrings', 'calves'], 'strength', 'strength', level='intermediate', force='push'),
    X('x-deep-squat-hold', 'Deep Squat Hold', 'body only', ['adductors', 'quadriceps'], ['glutes'], 'mobility', 'timed'),
    X('x-open-book', 'Thoracic Open Book', 'body only', ['middle back'], ['shoulders'], 'mobility', 'strength', mech='isolation'),
    X('x-wall-slides', 'Wall Slides', 'body only', ['shoulders', 'middle back'], ['traps'], 'mobility', 'strength', mech='isolation'),
    X('x-bear-crawl', 'Bear Crawl', 'body only', ['abdominals', 'shoulders'], ['quadriceps', 'triceps'], 'strength', 'timed'),
    X('x-suitcase-carry', 'Suitcase Carry', 'dumbbell', ['abdominals', 'forearms'], ['traps', 'glutes'], 'strength', 'timed'),
    X('x-jefferson-curl', 'Jefferson Curl', 'barbell', ['hamstrings', 'lower back'], [], 'mobility', 'strength', force='pull', mech='isolation'),
    X('x-nordic-curl', 'Nordic Hamstring Curl', 'body only', ['hamstrings'], ['glutes', 'calves'], 'strength', 'strength', level='intermediate', force='pull', mech='isolation'),
    X('x-hollow-hold', 'Hollow Body Hold', 'body only', ['abdominals'], [], 'strength', 'timed'),
    X('x-l-sit', 'L-Sit', 'body only', ['abdominals'], ['triceps', 'quadriceps'], 'strength', 'timed', level='intermediate'),
    X('x-handstand-hold', 'Handstand Hold', 'body only', ['shoulders'], ['triceps', 'abdominals', 'forearms'], 'balance', 'timed', level='expert'),
    X('x-wall-handstand', 'Wall Handstand Hold', 'body only', ['shoulders'], ['triceps', 'abdominals'], 'balance', 'timed', level='intermediate'),
    X('x-crow-pose', 'Crow Pose', 'body only', ['abdominals', 'shoulders'], ['forearms', 'triceps'], 'yoga', 'timed', level='intermediate'),
    X('x-headstand', 'Headstand', 'body only', ['shoulders', 'abdominals'], ['neck', 'traps'], 'yoga', 'timed', level='intermediate'),
    X('x-wheel-pose', 'Wheel Pose', 'body only', ['lower back', 'shoulders'], ['glutes', 'quadriceps'], 'yoga', 'timed', level='intermediate'),
    X('x-forward-fold', 'Standing Forward Fold', 'body only', ['hamstrings'], ['lower back', 'calves'], 'yoga', 'timed', mech='isolation'),
    X('x-pigeon-pose', 'Pigeon Pose', 'body only', ['glutes'], ['abductors'], 'yoga', 'timed', mech='isolation'),
    X('x-tree-pose', 'Tree Pose', 'body only', ['calves', 'glutes'], ['abdominals'], 'yoga', 'timed'),
    X('x-warrior-3', 'Warrior III', 'body only', ['glutes', 'hamstrings'], ['abdominals', 'lower back'], 'yoga', 'timed'),
    X('x-half-moon', 'Half Moon Pose', 'body only', ['glutes', 'abductors'], ['abdominals'], 'yoga', 'timed', level='intermediate'),
    X('x-boat-pose', 'Boat Pose', 'body only', ['abdominals'], ['quadriceps'], 'yoga', 'timed'),
    X('x-chair-pose', 'Chair Pose', 'body only', ['quadriceps', 'glutes'], ['shoulders'], 'yoga', 'timed'),
    X('x-downward-dog', 'Downward Dog', 'body only', ['hamstrings', 'shoulders'], ['calves'], 'yoga', 'timed'),
    X('x-bridge-pose', 'Bridge Pose', 'body only', ['glutes'], ['lower back', 'hamstrings'], 'yoga', 'timed'),
    X('x-cat-cow', 'Cat-Cow', 'body only', ['lower back'], ['abdominals'], 'mobility', 'strength', mech='isolation'),
    X('x-frog-stretch', 'Frog Stretch', 'body only', ['adductors'], [], 'mobility', 'timed', mech='isolation'),
    X('x-plank-shoulder-taps', 'Plank Shoulder Taps', 'body only', ['abdominals', 'shoulders'], [], 'strength', 'strength'),
    # cardio
    X('x-run', 'Running (outdoor)', 'body only', ['quadriceps', 'hamstrings'], ['calves', 'glutes'], 'cardio', 'cardio'),
    X('x-walk', 'Walking', 'body only', ['quadriceps'], ['calves', 'glutes'], 'cardio', 'cardio'),
    X('x-hike', 'Hiking', 'body only', ['quadriceps', 'glutes'], ['calves', 'hamstrings'], 'cardio', 'cardio'),
    X('x-cycle', 'Cycling (outdoor)', 'other', ['quadriceps'], ['hamstrings', 'calves'], 'cardio', 'cardio'),
    X('x-swim', 'Swimming', 'body only', ['lats', 'shoulders'], ['chest', 'triceps', 'quadriceps'], 'cardio', 'cardio'),
    X('x-hiit', 'HIIT / Intervals', 'body only', ['quadriceps'], ['abdominals', 'shoulders'], 'cardio', 'cardio', level='intermediate'),
    X('x-row-erg', 'Rowing (erg)', 'machine', ['lats', 'quadriceps'], ['middle back', 'hamstrings', 'biceps'], 'cardio', 'cardio'),
    # yoga / mobility sessions (logged as a whole practice)
    X('x-yoga-vinyasa', 'Vinyasa Flow', 'body only', ['abdominals'], ['shoulders', 'hamstrings'], 'yoga', 'session'),
    X('x-yoga-hatha', 'Hatha Yoga', 'body only', ['abdominals'], ['hamstrings'], 'yoga', 'session'),
    X('x-yoga-yin', 'Yin Yoga', 'body only', ['hamstrings'], ['adductors', 'glutes'], 'yoga', 'session'),
    X('x-yoga-power', 'Power Yoga', 'body only', ['abdominals', 'shoulders'], ['quadriceps'], 'yoga', 'session', level='intermediate'),
    X('x-yoga-restorative', 'Restorative Yoga', 'body only', ['lower back'], [], 'yoga', 'session'),
    X('x-yoga-ashtanga', 'Ashtanga Yoga', 'body only', ['abdominals', 'shoulders'], ['hamstrings'], 'yoga', 'session', level='intermediate'),
    X('x-mobility-flow', 'Mobility Flow', 'body only', ['adductors'], ['shoulders', 'lower back'], 'mobility', 'session'),
    X('x-pilates', 'Pilates', 'body only', ['abdominals'], ['glutes', 'lower back'], 'yoga', 'session'),
]
TIMED_RE = re.compile(r"\bplank\b|side bridge|\bhold\b|farmer'?s walk|carry|\bwalk\b(?!ing)", re.I)

def mode_for(name, category):
    if category == 'cardio':
        return 'cardio'
    if category == 'stretching':
        return 'timed'
    if TIMED_RE.search(name):
        return 'timed'
    return 'strength'

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
        pop if pop is not None else -1, mode_for(name, e.get('category') or ''),
    ])
    if e.get('instructions'):
        instr[e['id']] = e['instructions']

rows.extend(EXTRAS)
missing = [p for p in POPULAR if p.lower() not in {r[1].lower() for r in rows}]
if missing:
    print('WARNING popular names not found:', missing)

with open(os.path.join(root, 'exercises.json'), 'w', encoding='utf-8') as fh:
    json.dump({'source': 'Free Exercise DB (public domain, Unlicense) https://github.com/yuhonas/free-exercise-db',
               'fields': ['id', 'name', 'equipment', 'primary', 'secondary', 'category', 'level', 'mechanic', 'force', 'popular', 'mode'],
               'groups': MUSCLE_GROUP, 'exercises': rows}, fh, ensure_ascii=False, separators=(',', ':'))
with open(os.path.join(root, 'exercise-instructions.json'), 'w', encoding='utf-8') as fh:
    json.dump(instr, fh, ensure_ascii=False, separators=(',', ':'))
print(f'{len(rows)} exercises, {sum(1 for r in rows if r[9] >= 0)} popular; '
      f'{os.path.getsize(os.path.join(root, "exercises.json"))//1024} KB + {os.path.getsize(os.path.join(root, "exercise-instructions.json"))//1024} KB instructions')
