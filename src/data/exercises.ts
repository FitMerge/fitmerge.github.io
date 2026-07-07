import type { Exercise } from '../types'

// Seed exercise library for the workout builder & logger.
export const EXERCISES: Exercise[] = [
  // Chest
  {
    id: 'bench-press',
    name: 'Bench Press',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    instructions: 'Lie on a flat bench, lower the bar to mid-chest, then press up to full elbow extension.',
  },
  {
    id: 'incline-db-press',
    name: 'Incline Dumbbell Press',
    muscleGroup: 'Chest',
    equipment: 'Dumbbell',
    instructions: 'On a 30-45° incline bench, press dumbbells from shoulder height straight up over the chest.',
  },
  {
    id: 'push-up',
    name: 'Push-Up',
    muscleGroup: 'Chest',
    equipment: 'Bodyweight',
    instructions: 'Keep a straight line from head to heels, lower your chest to the floor, then push back up.',
  },
  {
    id: 'cable-fly',
    name: 'Cable Fly',
    muscleGroup: 'Chest',
    equipment: 'Cable',
    instructions: 'With a slight elbow bend, sweep both handles in a wide arc until they meet in front of your chest.',
  },
  {
    id: 'chest-dip',
    name: 'Chest Dip',
    muscleGroup: 'Chest',
    equipment: 'Bodyweight',
    instructions: 'Lean forward on parallel bars and lower until your shoulders dip below your elbows, then press up.',
  },

  // Back
  {
    id: 'pull-up',
    name: 'Pull-Up',
    muscleGroup: 'Back',
    equipment: 'Bodyweight',
    instructions: 'Hang from a bar with an overhand grip and pull your chin above the bar, then lower with control.',
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    muscleGroup: 'Back',
    equipment: 'Machine',
    instructions: 'Pull the bar down to your upper chest while keeping your torso upright, then let it rise slowly.',
  },
  {
    id: 'barbell-row',
    name: 'Barbell Row',
    muscleGroup: 'Back',
    equipment: 'Barbell',
    instructions: 'Hinge at the hips with a flat back and row the bar into your lower ribcage.',
  },
  {
    id: 'seated-cable-row',
    name: 'Seated Cable Row',
    muscleGroup: 'Back',
    equipment: 'Cable',
    instructions: 'Sit tall and pull the handle to your torso, squeezing your shoulder blades together.',
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    muscleGroup: 'Back',
    equipment: 'Barbell',
    instructions: 'Grip the bar outside your legs, drive through the floor, and stand tall keeping the bar close.',
  },
  {
    id: 'single-arm-db-row',
    name: 'Single-Arm Dumbbell Row',
    muscleGroup: 'Back',
    equipment: 'Dumbbell',
    instructions: 'Brace one hand on a bench and row the dumbbell up toward your hip, keeping your torso still.',
  },

  // Shoulders
  {
    id: 'overhead-press',
    name: 'Overhead Press',
    muscleGroup: 'Shoulders',
    equipment: 'Barbell',
    instructions: 'Press the bar from shoulder height straight overhead, keeping your core braced.',
  },
  {
    id: 'lateral-raise',
    name: 'Lateral Raise',
    muscleGroup: 'Shoulders',
    equipment: 'Dumbbell',
    instructions: 'Raise dumbbells out to the sides to shoulder height with a slight elbow bend, then lower slowly.',
  },
  {
    id: 'rear-delt-fly',
    name: 'Rear Delt Fly',
    muscleGroup: 'Shoulders',
    equipment: 'Dumbbell',
    instructions: 'Hinge forward and raise dumbbells out to the sides, squeezing your rear shoulders at the top.',
  },
  {
    id: 'face-pull',
    name: 'Face Pull',
    muscleGroup: 'Shoulders',
    equipment: 'Cable',
    instructions: 'Pull the rope toward your face, flaring your elbows out wide and squeezing your upper back.',
  },
  {
    id: 'arnold-press',
    name: 'Arnold Press',
    muscleGroup: 'Shoulders',
    equipment: 'Dumbbell',
    instructions: 'Start with palms facing you, rotate outward as you press the dumbbells overhead.',
  },

  // Biceps
  {
    id: 'barbell-curl',
    name: 'Barbell Curl',
    muscleGroup: 'Biceps',
    equipment: 'Barbell',
    instructions: 'Keeping elbows pinned to your sides, curl the bar up to shoulder height and lower slowly.',
  },
  {
    id: 'dumbbell-curl',
    name: 'Dumbbell Curl',
    muscleGroup: 'Biceps',
    equipment: 'Dumbbell',
    instructions: 'Curl each dumbbell up while keeping your elbow still, alternating or together.',
  },
  {
    id: 'hammer-curl',
    name: 'Hammer Curl',
    muscleGroup: 'Biceps',
    equipment: 'Dumbbell',
    instructions: 'Curl dumbbells with a neutral palms-facing-in grip to emphasize the forearm and brachialis.',
  },
  {
    id: 'preacher-curl',
    name: 'Preacher Curl',
    muscleGroup: 'Biceps',
    equipment: 'Machine',
    instructions: 'Rest your arms on the preacher pad and curl the weight up without letting elbows lift off.',
  },

  // Triceps
  {
    id: 'triceps-pushdown',
    name: 'Triceps Pushdown',
    muscleGroup: 'Triceps',
    equipment: 'Cable',
    instructions: 'Keep elbows tucked and push the bar or rope down until your arms are fully extended.',
  },
  {
    id: 'skull-crusher',
    name: 'Skull Crusher',
    muscleGroup: 'Triceps',
    equipment: 'Barbell',
    instructions: 'Lying on a bench, lower the bar toward your forehead by bending only at the elbows, then extend.',
  },
  {
    id: 'triceps-dip',
    name: 'Triceps Dip',
    muscleGroup: 'Triceps',
    equipment: 'Bodyweight',
    instructions: 'Keeping your torso upright, lower on parallel bars or a bench then press back up through the triceps.',
  },
  {
    id: 'overhead-triceps-extension',
    name: 'Overhead Triceps Extension',
    muscleGroup: 'Triceps',
    equipment: 'Dumbbell',
    instructions: 'Hold a dumbbell overhead with both hands and lower it behind your head, then extend back up.',
  },

  // Legs
  {
    id: 'squat',
    name: 'Squat',
    muscleGroup: 'Legs',
    equipment: 'Barbell',
    instructions: 'Bar on your upper back, squat down until hips drop below knee level, then drive back up.',
  },
  {
    id: 'front-squat',
    name: 'Front Squat',
    muscleGroup: 'Legs',
    equipment: 'Barbell',
    instructions: 'Rest the bar on your front shoulders and squat down keeping your torso upright.',
  },
  {
    id: 'leg-press',
    name: 'Leg Press',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    instructions: 'Push the platform away by extending your legs, then lower with control under a stable knee track.',
  },
  {
    id: 'lunge',
    name: 'Lunge',
    muscleGroup: 'Legs',
    equipment: 'Dumbbell',
    instructions: 'Step forward and lower your back knee toward the floor, then push back to standing.',
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    muscleGroup: 'Legs',
    equipment: 'Barbell',
    instructions: 'Hinge at the hips with soft knees, lowering the bar along your legs until you feel a hamstring stretch.',
  },
  {
    id: 'leg-curl',
    name: 'Leg Curl',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    instructions: 'Curl the pad toward your glutes by flexing at the knee, then lower slowly.',
  },
  {
    id: 'leg-extension',
    name: 'Leg Extension',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    instructions: 'Extend your knees to lift the pad until your legs are straight, then lower under control.',
  },
  {
    id: 'calf-raise',
    name: 'Calf Raise',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    instructions: 'Rise up onto your toes as high as possible, pause, then lower your heels below the platform.',
  },

  // Glutes
  {
    id: 'hip-thrust',
    name: 'Hip Thrust',
    muscleGroup: 'Glutes',
    equipment: 'Barbell',
    instructions: 'With shoulders on a bench and a bar over your hips, drive through your heels to full hip extension.',
  },
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    muscleGroup: 'Glutes',
    equipment: 'Bodyweight',
    instructions: 'Lying on your back with knees bent, squeeze your glutes to lift your hips off the floor.',
  },
  {
    id: 'cable-kickback',
    name: 'Cable Kickback',
    muscleGroup: 'Glutes',
    equipment: 'Cable',
    instructions: 'With an ankle cuff attached, kick your leg back and up, squeezing the glute at the top.',
  },
  {
    id: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    muscleGroup: 'Glutes',
    equipment: 'Dumbbell',
    instructions: 'With your rear foot elevated behind you, lower your back knee toward the floor and drive back up.',
  },

  // Core
  {
    id: 'plank',
    name: 'Plank',
    muscleGroup: 'Core',
    equipment: 'Bodyweight',
    instructions: 'Hold a straight line from head to heels on your forearms and toes, bracing your core.',
  },
  {
    id: 'crunch',
    name: 'Crunch',
    muscleGroup: 'Core',
    equipment: 'Bodyweight',
    instructions: 'Curl your shoulders off the floor toward your hips, keeping your lower back down.',
  },
  {
    id: 'hanging-leg-raise',
    name: 'Hanging Leg Raise',
    muscleGroup: 'Core',
    equipment: 'Bodyweight',
    instructions: 'Hang from a bar and raise your legs to hip height or higher without swinging.',
  },
  {
    id: 'russian-twist',
    name: 'Russian Twist',
    muscleGroup: 'Core',
    equipment: 'Kettlebell',
    instructions: 'Sitting with feet lifted, rotate a weight from side to side while keeping your chest up.',
  },
  {
    id: 'cable-woodchop',
    name: 'Cable Woodchop',
    muscleGroup: 'Core',
    equipment: 'Cable',
    instructions: 'Rotate the cable diagonally from high to low (or low to high) across your body, pivoting your hips.',
  },

  // Cardio
  {
    id: 'running',
    name: 'Running',
    muscleGroup: 'Cardio',
    equipment: 'Other',
    instructions: 'Maintain a steady pace and posture, landing lightly under your hips.',
  },
  {
    id: 'cycling',
    name: 'Cycling',
    muscleGroup: 'Cardio',
    equipment: 'Other',
    instructions: 'Pedal at a controlled cadence with a slight bend in your knee at full extension.',
  },
  {
    id: 'rowing-machine',
    name: 'Rowing Machine',
    muscleGroup: 'Cardio',
    equipment: 'Machine',
    instructions: 'Drive with your legs, then lean back and pull the handle to your ribs before reversing the sequence.',
  },
  {
    id: 'jump-rope',
    name: 'Jump Rope',
    muscleGroup: 'Cardio',
    equipment: 'Other',
    instructions: 'Jump with small, quick hops on the balls of your feet as the rope passes under you.',
  },
  {
    id: 'burpee',
    name: 'Burpee',
    muscleGroup: 'Cardio',
    equipment: 'Bodyweight',
    instructions: 'Drop into a squat, kick back to a plank, do a push-up, then jump feet in and leap up.',
  },
]

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id)
}

export const MUSCLE_GROUPS: string[] = Array.from(new Set(EXERCISES.map((e) => e.muscleGroup))).sort()
