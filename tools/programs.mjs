// Program templates. Exercises are referenced by library name (or x- id) and
// resolved to ids by tools/build-programs.mjs. Set/rep schemes follow the
// public descriptions of each program; credits link to the originals.
const inc = (lb, kg) => ({ lb, kg });
const UP = inc(5, 2.5), LOW = inc(10, 5);
const ex = (name, sets, reps, restSec = 90, extra = {}) => ({ name, sets, reps, restSec, ...extra });

export default [
  {
    id: 'ss-lp', name: 'Novice Linear Progression', short: 'Novice LP', credit: 'Modeled on Starting Strength (Mark Rippetoe)', url: 'https://startingstrength.com',
    level: 'beginner', daysPerWeek: 3, focus: ['strength', 'functional'],
    summary: 'Three full-body sessions a week alternating A and B. Squat every session, press and bench alternate, one heavy set of deadlift. The simplest proven way to get strong fast.',
    progression: 'Add weight every session: about 5 lb / 2.5 kg on presses, 10 lb / 5 kg on squat and deadlift early on, then 5 lb. When you miss reps three sessions in a row, deload 10% and build back.',
    days: [
      { name: 'Workout A', exercises: [ex('Barbell Squat', 3, '5', 180, { progress: LOW }), ex('Standing Military Press', 3, '5', 180, { progress: UP }), ex('Barbell Deadlift', 1, '5', 240, { progress: LOW })] },
      { name: 'Workout B', exercises: [ex('Barbell Squat', 3, '5', 180, { progress: LOW }), ex('Barbell Bench Press - Medium Grip', 3, '5', 180, { progress: UP }), ex('Power Clean', 5, '3', 180, { progress: UP })] },
    ],
  },
  {
    id: 'sl-5x5', name: 'StrongLifts 5×5', short: '5×5', credit: 'Mehdi, StrongLifts', url: 'https://stronglifts.com',
    level: 'beginner', daysPerWeek: 3, focus: ['strength'],
    summary: 'Two alternating full-body workouts, three days a week, five sets of five on the big barbell lifts. Rows and the overhead press make it a touch more upper-body focused than Starting Strength.',
    progression: 'Add 5 lb / 2.5 kg every workout (10 lb / 5 kg on deadlift). Fail a weight three times, deload 10% on that lift.',
    days: [
      { name: 'Workout A', exercises: [ex('Barbell Squat', 5, '5', 180, { progress: UP }), ex('Barbell Bench Press - Medium Grip', 5, '5', 180, { progress: UP }), ex('Bent Over Barbell Row', 5, '5', 180, { progress: UP })] },
      { name: 'Workout B', exercises: [ex('Barbell Squat', 5, '5', 180, { progress: UP }), ex('Standing Military Press', 5, '5', 180, { progress: UP }), ex('Barbell Deadlift', 1, '5', 240, { progress: LOW })] },
    ],
  },
  {
    id: 'gzclp', name: 'GZCLP', short: 'GZCLP', credit: 'Cody Lefever (GZCL method)', url: 'https://www.gzcl.com',
    level: 'beginner', daysPerWeek: 3, focus: ['strength', 'upper'],
    summary: 'Linear progression with three tiers per day: a heavy T1 lift for 5×3 with an AMRAP last set, a moderate T2 for 3×10, and a light T3 for 3×15+. Four workouts rotate, so you run it three or four days a week.',
    progression: 'T1 and T2: add 5 lb / 2.5 kg upper, 10 lb / 5 kg lower each time you complete all sets. When you fail T1 5×3, move to 6×2, then 10×1, then reset. T3: add weight once the last set hits 25 reps.',
    days: [
      { name: 'A1', exercises: [ex('Barbell Squat', 5, '3 (last set AMRAP)', 180, { progress: LOW }), ex('Barbell Bench Press - Medium Grip', 3, '10', 120, { progress: UP }), ex('Wide-Grip Lat Pulldown', 3, '15 (last set AMRAP)', 60)] },
      { name: 'B1', exercises: [ex('Standing Military Press', 5, '3 (last set AMRAP)', 180, { progress: UP }), ex('Barbell Deadlift', 3, '10', 120, { progress: LOW }), ex('One-Arm Dumbbell Row', 3, '15 (last set AMRAP)', 60)] },
      { name: 'A2', exercises: [ex('Barbell Bench Press - Medium Grip', 5, '3 (last set AMRAP)', 180, { progress: UP }), ex('Barbell Squat', 3, '10', 120, { progress: LOW }), ex('Wide-Grip Lat Pulldown', 3, '15 (last set AMRAP)', 60)] },
      { name: 'B2', exercises: [ex('Barbell Deadlift', 5, '3 (last set AMRAP)', 180, { progress: LOW }), ex('Standing Military Press', 3, '10', 120, { progress: UP }), ex('One-Arm Dumbbell Row', 3, '15 (last set AMRAP)', 60)] },
    ],
  },
  {
    id: 'reddit-ppl', name: 'Push / Pull / Legs', short: 'PPL', credit: 'Metallicadpa, r/Fitness beginner PPL', url: 'https://thefitness.wiki/routines/metallicadpa-ppl/',
    level: 'beginner', daysPerWeek: 6, focus: ['upper', 'hypertrophy'],
    summary: 'Six days a week, each muscle twice. One heavy compound with an AMRAP last set, then accessories for 8–12 and 15–20 reps. The classic upper-body builder. Run 3 days a week if 6 is too much.',
    progression: 'Add 5 lb / 2.5 kg to the main lift every session (10 lb / 5 kg on deadlift) as long as the AMRAP set hits 5+. Accessories: add weight when you reach the top of the rep range on every set.',
    days: [
      { name: 'Pull A', exercises: [ex('Barbell Deadlift', 1, '5 (AMRAP)', 240, { progress: LOW }), ex('Wide-Grip Lat Pulldown', 3, '8-12', 90), ex('Seated Cable Rows', 3, '8-12', 90), ex('Face Pull', 5, '15-20', 60), ex('Hammer Curls', 4, '8-12', 60), ex('Dumbbell Bicep Curl', 4, '8-12', 60)] },
      { name: 'Push A', exercises: [ex('Barbell Bench Press - Medium Grip', 5, '5 (last set AMRAP)', 180, { progress: UP }), ex('Standing Military Press', 3, '8-12', 120), ex('Incline Dumbbell Press', 3, '8-12', 90), ex('Triceps Pushdown - Rope Attachment', 3, '8-12', 60), ex('Cable Rope Overhead Triceps Extension', 3, '8-12', 60), ex('Side Lateral Raise', 3, '15-20', 60)] },
      { name: 'Legs', exercises: [ex('Barbell Squat', 3, '5 (last set AMRAP)', 180, { progress: UP }), ex('Romanian Deadlift', 3, '8-12', 120), ex('Leg Press', 3, '8-12', 90), ex('Seated Leg Curl', 3, '8-12', 60), ex('Standing Calf Raises', 5, '8-12', 60)] },
      { name: 'Pull B', exercises: [ex('Bent Over Barbell Row', 5, '5 (last set AMRAP)', 180, { progress: UP }), ex('Wide-Grip Lat Pulldown', 3, '8-12', 90), ex('Seated Cable Rows', 3, '8-12', 90), ex('Face Pull', 5, '15-20', 60), ex('Hammer Curls', 4, '8-12', 60), ex('Dumbbell Bicep Curl', 4, '8-12', 60)] },
      { name: 'Push B', exercises: [ex('Standing Military Press', 5, '5 (last set AMRAP)', 180, { progress: UP }), ex('Barbell Bench Press - Medium Grip', 3, '8-12', 120), ex('Incline Dumbbell Press', 3, '8-12', 90), ex('Triceps Pushdown - Rope Attachment', 3, '8-12', 60), ex('Cable Rope Overhead Triceps Extension', 3, '8-12', 60), ex('Side Lateral Raise', 3, '15-20', 60)] },
    ],
  },
  {
    id: 'upper-lower', name: 'Upper / Lower', short: 'U/L', credit: 'Common 4-day template (PHUL-style power + hypertrophy days)',
    level: 'intermediate', daysPerWeek: 4, focus: ['upper', 'strength', 'hypertrophy'],
    summary: 'Two upper and two lower days a week: one heavy, one higher-rep each. More recovery than PPL, more upper-body volume than a full-body program.',
    progression: 'Power days: add weight when you get all sets at the target reps. Hypertrophy days: work in the rep range and add weight at the top of it.',
    days: [
      { name: 'Upper Power', exercises: [ex('Barbell Bench Press - Medium Grip', 3, '5', 180, { progress: UP }), ex('Bent Over Barbell Row', 3, '5', 180, { progress: UP }), ex('Standing Military Press', 3, '8', 120), ex('Pullups', 3, '8', 120), ex('Barbell Curl', 2, '10', 60), ex('EZ-Bar Skullcrusher', 2, '10', 60)] },
      { name: 'Lower Power', exercises: [ex('Barbell Squat', 3, '5', 180, { progress: LOW }), ex('Romanian Deadlift', 3, '8', 150, { progress: UP }), ex('Leg Press', 3, '10', 90), ex('Standing Calf Raises', 4, '12', 60), ex('Hanging Leg Raise', 3, '12', 60)] },
      { name: 'Upper Hypertrophy', exercises: [ex('Incline Dumbbell Press', 3, '10', 90), ex('Seated Cable Rows', 3, '10', 90), ex('Side Lateral Raise', 3, '15', 60), ex('Face Pull', 3, '15', 60), ex('Hammer Curls', 3, '12', 60), ex('Triceps Pushdown', 3, '12', 60), ex('Dips - Chest Version', 3, 'AMRAP', 90)] },
      { name: 'Lower Hypertrophy', exercises: [ex('Front Barbell Squat', 3, '8', 150), ex('Barbell Hip Thrust', 3, '10', 120), ex('Dumbbell Lunges', 3, '10 / leg', 90), ex('Lying Leg Curls', 3, '12', 60), ex('Seated Calf Raise', 4, '15', 60)] },
    ],
  },
  {
    id: 'bwf-rr', name: 'Bodyweight Recommended Routine', short: 'RR', credit: 'r/bodyweightfitness community', url: 'https://www.reddit.com/r/bodyweightfitness/wiki/kb/recommended_routine/',
    level: 'beginner', daysPerWeek: 3, focus: ['functional', 'bodyweight', 'balance', 'upper'],
    summary: 'Full-body calisthenics three times a week: a pull, a push, a squat and a hinge pattern, each paired, plus a core triplet. Progress by moving to a harder variation, not by adding plates. Great for balance and control.',
    progression: 'Work 3 sets of 5–8. When you hit 3×8 cleanly, move to the next harder variation (for example push-up → diamond push-up → pseudo-planche push-up). Holds: add 5–10 seconds.',
    days: [
      { name: 'Full Body', exercises: [ex('x-dead-hang', 1, '30 s', 30), ex('x-deep-squat-hold', 1, '45 s', 30), ex('x-wall-slides', 1, '10', 30), ex('Pullups', 3, '5-8', 120), ex('Dips - Chest Version', 3, '5-8', 120), ex('Inverted Row', 3, '5-8', 120), ex('Pushups', 3, '5-8', 120), ex('x-pistol-squat', 3, '5-8 / leg', 120), ex('x-nordic-curl', 3, '5-8', 120), ex('Hanging Leg Raise', 3, '8-12', 60), ex('x-copenhagen-plank', 3, '30 s / side', 60), ex('x-hollow-hold', 3, '30 s', 60)] },
    ],
  },
  {
    id: 'simple-sinister', name: 'Simple & Sinister', short: 'S&S', credit: 'Pavel Tsatsouline, StrongFirst', url: 'https://www.strongfirst.com/sinister/',
    level: 'beginner', daysPerWeek: 5, focus: ['functional', 'kettlebell', 'balance'],
    summary: 'The minimalist kettlebell practice: 100 one-arm swings in sets of 10 and 10 Turkish get-ups, most days of the week. Builds a strong hinge, grip, shoulders and whole-body control in about 30 minutes.',
    progression: 'Stay with a bell until the full session feels easy within 5 minutes for swings and 10 for get-ups, then move up one bell size on one movement at a time. Never grind.',
    days: [
      { name: 'Daily Practice', exercises: [ex('Goblet Squat', 3, '5', 45), ex('Butt Lift (Bridge)', 3, '5', 45), ex('One-Arm Kettlebell Swings', 10, '10 (alternate hands)', 30, { progress: inc(8, 4) }), ex('Kettlebell Turkish Get-Up (Lunge style)', 10, '1 (alternate sides)', 45, { progress: inc(8, 4) })] },
    ],
  },
  {
    id: 'daily-mobility', name: 'Daily Mobility', short: 'Mobility', credit: 'Inspired by Joe DeFranco’s Limber 11 and Agile 8',
    level: 'beginner', daysPerWeek: 7, focus: ['mobility', 'balance'],
    summary: 'A 15-minute hip, spine and shoulder routine to do most days or before lifting. Hinge, squat and overhead positions all open up, and the holds double as a progress log.',
    progression: 'Add 10–15 seconds to holds and a rep or two to the movement drills as positions get easier. Depth and comfort are the goal, not load.',
    days: [
      { name: 'Mobility 15', exercises: [ex('x-cat-cow', 2, '10', 20), ex('World\'s Greatest Stretch', 2, '5 / side', 20), ex('x-90-90', 2, '8 / side', 20), ex('x-couch-stretch', 2, '45 s / side', 20), ex('x-deep-squat-hold', 2, '45 s', 20), ex('x-frog-stretch', 2, '45 s', 20), ex('x-open-book', 2, '8 / side', 20), ex('x-pigeon-pose', 2, '45 s / side', 20), ex('x-cossack-squat', 2, '8 / side', 20), ex('x-dead-hang', 2, '30 s', 30)] },
    ],
  },
  {
    id: 'upper-functional', name: 'Upper-Focus Functional', short: 'UFF', credit: 'Macro Log template built around pressing, pulling, carries and single-leg balance',
    level: 'intermediate', daysPerWeek: 3, focus: ['functional', 'upper', 'balance'],
    summary: 'Three days built around one heavy upper-body lift each, with get-ups, carries, single-leg work and holds for balance and core. Strength you can feel outside the gym.',
    progression: 'Add 5 lb / 2.5 kg to the main press or pull when all sets hit the target. For single-leg and balance work, add reps or hold time first, then load.',
    days: [
      { name: 'Day A · Press & balance', exercises: [ex('Standing Military Press', 4, '5', 180, { progress: UP }), ex('Kettlebell Turkish Get-Up (Lunge style)', 4, '1 / side', 90), ex('Dips - Chest Version', 3, '8', 120), ex('x-single-leg-rdl', 3, '8 / leg', 90), ex('Side Lateral Raise', 3, '15', 60), ex('x-copenhagen-plank', 3, '30 s / side', 60)] },
      { name: 'Day B · Pull & hinge', exercises: [ex('Pullups', 4, '6', 150), ex('Barbell Deadlift', 3, '5', 240, { progress: LOW }), ex('One-Arm Dumbbell Row', 3, '10', 90), ex('Face Pull', 3, '15', 60), ex("Farmer's Walk", 3, '40 s', 90, { progress: inc(10, 5) }), ex('x-hollow-hold', 3, '30 s', 60)] },
      { name: 'Day C · Bench & legs', exercises: [ex('Barbell Bench Press - Medium Grip', 4, '5', 180, { progress: UP }), ex('Goblet Squat', 3, '10', 120), ex('x-pistol-squat', 3, '5 / leg', 120), ex('Chin-Up', 3, '8', 120), ex('x-hip-airplane', 3, '6 / side', 60), ex('x-wall-handstand', 3, '20 s', 90)] },
    ],
  },
  {
    id: 'yoga-balance', name: 'Yoga & Balance Progress', short: 'Yoga', credit: 'Macro Log template',
    level: 'beginner', daysPerWeek: 2, focus: ['yoga', 'balance', 'mobility'],
    summary: 'A check-in practice for poses you want to progress. Log how long you hold each one; the exercise page charts your best hold over time, so crow, headstand and handstand become measurable.',
    progression: 'Chase longer, calmer holds. Add 5 seconds when a hold feels steady; for inversions, go from wall-assisted to free-standing before adding time.',
    days: [
      { name: 'Balance & inversions', exercises: [ex('x-tree-pose', 2, '30 s / side', 15), ex('x-warrior-3', 2, '20 s / side', 15), ex('x-half-moon', 2, '20 s / side', 15), ex('x-crow-pose', 3, '10 s', 45), ex('x-headstand', 3, '20 s', 60), ex('x-wall-handstand', 3, '20 s', 60), ex('x-boat-pose', 3, '30 s', 30)] },
      { name: 'Flexibility & backbends', exercises: [ex('x-downward-dog', 2, '45 s', 15), ex('x-chair-pose', 2, '45 s', 20), ex('x-wheel-pose', 3, '15 s', 45), ex('x-bridge-pose', 2, '30 s', 20), ex('x-pigeon-pose', 2, '60 s / side', 15), ex('x-forward-fold', 2, '45 s', 15), ex('Plank', 2, '60 s', 30)] },
    ],
  },
  {
    id: 'zone2-base', name: 'Zone 2 Base', short: 'Zone 2', credit: 'Macro Log template',
    level: 'beginner', daysPerWeek: 3, focus: ['cardio'],
    summary: 'Three easy aerobic sessions a week at a pace where you can still talk. The cheapest investment in recovery, heart health and work capacity for lifting.',
    progression: 'Add 5 minutes to one session a week until you reach 45–60 minutes, then nudge the pace.',
    days: [
      { name: 'Easy run', exercises: [ex('x-run', 1, '30 min', 0)] },
      { name: 'Bike or row', exercises: [ex('Bicycling, Stationary', 1, '40 min', 0)] },
      { name: 'Long walk or hike', exercises: [ex('x-hike', 1, '60 min', 0)] },
    ],
  },
];
