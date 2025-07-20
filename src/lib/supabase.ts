import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          total_points: number
          role: string
          child_id: string | null
          is_onboarded: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar_url?: string | null
          total_points?: number
          role?: string
          child_id?: string | null
          is_onboarded?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          total_points?: number
          role?: string
          child_id?: string | null
          is_onboarded?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          exercise_type: string
          points_earned: number
          duration_minutes: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exercise_type: string
          points_earned: number
          duration_minutes: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exercise_type?: string
          points_earned?: number
          duration_minutes?: number
          notes?: string | null
          created_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          user_id: string
          content: string
          image_url: string | null
          workout_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content: string
          image_url?: string | null
          workout_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          image_url?: string | null
          workout_id?: string | null
          created_at?: string
        }
      }
      likes: {
        Row: {
          id: string
          post_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          created_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          post_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
      }
    }
  }
}