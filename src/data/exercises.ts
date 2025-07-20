import { ExerciseTemplate } from '../types'

export const exerciseTemplates: ExerciseTemplate[] = [
  // Dribbling exercises
  {
    name: 'Stationary Dribbling',
    type: 'dribbling',
    description: 'Basic ball control with both hands',
    basePoints: 10,
    icon: '⚡'
  },
  {
    name: 'Cone Weaving',
    type: 'dribbling',
    description: 'Dribble through cones with alternating hands',
    basePoints: 15,
    icon: '🏆'
  },
  {
    name: 'Figure 8 Dribbling',
    type: 'dribbling',
    description: 'Dribble in figure 8 pattern around legs',
    basePoints: 20,
    icon: '💫'
  },
  {
    name: 'Speed Dribbling',
    type: 'dribbling',
    description: 'Full court dribbling at maximum speed',
    basePoints: 25,
    icon: '🔥'
  },

  // Shooting exercises
  {
    name: 'Free Throws',
    type: 'shooting',
    description: 'Practice shooting from the free throw line',
    basePoints: 15,
    icon: '🎯'
  },
  {
    name: 'Spot Shooting',
    type: 'shooting',
    description: 'Shoot from 5 different spots around the court',
    basePoints: 20,
    icon: '🏀'
  },
  {
    name: 'Layup Lines',
    type: 'shooting',
    description: 'Continuous layups from both sides',
    basePoints: 12,
    icon: '⬆️'
  },
  {
    name: '3-Point Practice',
    type: 'shooting',
    description: 'Shoot from beyond the 3-point line',
    basePoints: 30,
    icon: '🌟'
  },

  // Conditioning exercises
  {
    name: 'Suicides',
    type: 'conditioning',
    description: 'Sprint to each line and back',
    basePoints: 25,
    icon: '🏃‍♀️'
  },
  {
    name: 'Defensive Slides',
    type: 'conditioning',
    description: 'Lateral movement drills',
    basePoints: 20,
    icon: '🛡️'
  },
  {
    name: 'Jump Training',
    type: 'conditioning',
    description: 'Vertical jump and plyometric exercises',
    basePoints: 30,
    icon: '🔋'
  },
  {
    name: 'Endurance Run',
    type: 'conditioning',
    description: 'Long distance running for stamina',
    basePoints: 35,
    icon: '💪'
  }
]