export interface Profile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  total_points: number
  role: 'parent' | 'player'
  child_id: string | null
  is_onboarded: boolean
  jersey_number: number | null
  created_at: string
  updated_at: string
}

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
  profiles?: Profile
  workouts?: Workout
}

export interface ExerciseTemplate {
  name: string
  type: 'dribbling' | 'shooting' | 'conditioning'
  description: string
  basePoints: number
  icon: string
}