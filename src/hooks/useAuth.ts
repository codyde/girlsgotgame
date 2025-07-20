import { useState, useEffect, useCallback } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'
import toast from 'react-hot-toast'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        fetchOrCreateProfile(session.user.id, session.user.email || '')
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await fetchOrCreateProfile(session.user.id, session.user.email || '')
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchOrCreateProfile = async (userId: string, email: string) => {
    try {
      setLoading(true)
      console.log('🔍 fetchOrCreateProfile: Starting for userId:', userId)
      
      // Try to fetch existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      console.log('🔍 fetchOrCreateProfile: Database response:', { data, error })

      if (!data && !error) {
        console.log('🔍 fetchOrCreateProfile: No profile found, creating new one')
        // Profile doesn't exist, create one
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email,
            name: null,
            role: 'player',
            is_onboarded: false,
            total_points: 0
          })
          .select()
          .maybeSingle()

        if (createError) {
          // Handle duplicate key error (profile already exists from another session)
          if (createError.code === '23505') {
            // Try to fetch again
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle()
            
            setProfile(existingProfile)
          } else {
            throw createError
          }
        } else {
          setProfile(newProfile)
        }
      } else if (error) {
        console.log('🔍 fetchOrCreateProfile: Database error:', error)
        throw error
      } else {
        console.log('🔍 fetchOrCreateProfile: Profile found, setting profile:', data)
        setProfile(data)
      }
    } catch (error: any) {
      console.error('🔴 fetchOrCreateProfile: Error with profile:', error)
      toast.error('Error loading profile')
    } finally {
      console.log('🔍 fetchOrCreateProfile: Setting loading to false')
      setLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!user) throw new Error('No user logged in')

      console.log('🔵 updateProfile called with:', updates)
      console.log('🔵 Current profile before update:', profile)

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .maybeSingle()

      console.log('🔵 Database response:', { data, error })

      if (error) throw error

      console.log('🔵 Setting new profile state:', data)
      console.log('🔵 New profile is_onboarded value:', data?.is_onboarded)
      // Force a new object reference to ensure React detects the change
      setProfile(prevProfile => {
        console.log('🔵 Previous profile in setter:', prevProfile)
        console.log('🔵 New profile in setter:', data)
        const newProfile = { 
          ...data, 
          // Add a timestamp to force a completely new object
          _updated: new Date().getTime() 
        }
        console.log('🔵 Final profile with timestamp:', newProfile)
        return newProfile
      })
      
      console.log('🔵 Profile state updated with functional setter!')
      toast.success('Profile updated successfully!')
    } catch (error: any) {
      console.error('Update profile error:', error)
      toast.error('Failed to update profile')
      throw error
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // State will be cleared by the auth state change listener
      toast.success('Signed out successfully!')
    } catch (error: any) {
      console.error('Sign out error:', error)
      toast.error('Error signing out')
      setLoading(false)
    }
  }

  console.log('🔵 useAuth returning profile:', profile)
  
  return {
    session,
    user,
    profile,
    loading,
    updateProfile,
    signOut,
  }
}