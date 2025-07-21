export interface User {
  id: string
  email: string
  name: string | null
  emailVerified: boolean
  image: string | null
  avatarUrl: string | null
  totalPoints: number
  role: 'parent' | 'player'
  childId: string | null
  isOnboarded: boolean
  jerseyNumber: number | null
  createdAt: string
  updatedAt: string
}

// Keep Profile as alias for backwards compatibility during migration
export type Profile = User

export interface Workout {
  id: string
  user_id: string
  exercise_type: 'dribbling' | 'shooting' | 'conditioning'
  points_earned: number
  duration_minutes: number
  notes: string | null
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  content: string
  image_url: string | null
  workout_id: string | null
  created_at: string
  user?: User
  workouts?: Workout
}

export interface ExerciseTemplate {
  name: string
  type: 'dribbling' | 'shooting' | 'conditioning'
  description: string
  basePoints: number
  icon: string
}