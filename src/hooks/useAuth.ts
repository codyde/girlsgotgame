import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'
import toast from 'react-hot-toast'

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const initializationRef = useRef(false)
  const profileFetchRef = useRef<string | null>(null)

  useEffect(() => {
    // Prevent multiple initializations
    if (initializationRef.current) return
    initializationRef.current = true

    let mounted = true
    
    const initializeAuth = async () => {
      try {
        console.log('🔐 Initializing auth...')
        
        // Check for magic link in URL first (iOS compatibility)
        const urlParams = new URLSearchParams(window.location.search)
        const accessToken = urlParams.get('access_token')
        const refreshToken = urlParams.get('refresh_token')
        
        if (accessToken && refreshToken) {
          console.log('🔗 Magic link detected, setting session...')
          
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          
          if (error) {
            console.error('❌ Error setting session from URL:', error)
          } else if (data.session?.user) {
            console.log('✅ Session set from magic link')
            setUser(data.session.user)
            await fetchProfile(data.session.user.id)
            
            // Clean URL without causing reload
            const cleanUrl = window.location.origin + window.location.pathname
            window.history.replaceState({}, document.title, cleanUrl)
            
            if (mounted) setLoading(false)
            return
          }
        }
        
        // Fallback to regular session check
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.error('❌ Session error:', error)
        }
        
        if (!mounted) return
        
        if (data.session?.user) {
          console.log('✅ Found existing session')
          setUser(data.session.user)
          await fetchProfile(data.session.user.id)
        } else {
          console.log('❌ No session found')
          setLoading(false)
        }
      } catch (error) {
        console.error('❌ Auth initialization failed:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }
    
    initializeAuth()

    // Listen for auth changes with simplified logic
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`🔄 Auth event: ${event}`, session?.user?.id ? 'with user' : 'no user')
        
        if (!mounted) return
        
        switch (event) {
          case 'SIGNED_IN':
            if (session?.user) {
              setUser(session.user)
              await fetchProfile(session.user.id)
              toast.success('Welcome back!')
            }
            break
            
          case 'SIGNED_OUT':
            setUser(null)
            setProfile(null)
            setLoading(false)
            profileFetchRef.current = null
            break
            
          case 'TOKEN_REFRESHED':
            if (session?.user) {
              setUser(session.user)
              // Don't refetch profile on token refresh
            }
            break
            
          default:
            // Handle other events
            if (session?.user) {
              setUser(session.user)
            } else {
              setUser(null)
              setProfile(null)
              setLoading(false)
              profileFetchRef.current = null
            }
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchProfile = async (userId: string) => {
    // Prevent duplicate profile fetches
    if (profileFetchRef.current === userId) {
      console.log('🔄 Profile fetch already in progress for user:', userId)
      return
    }
    
    profileFetchRef.current = userId
    
    try {
      console.log('👤 Fetching profile for user:', userId)
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (!data) {
        console.log('🆕 Creating new profile')
        const { data: userData } = await supabase.auth.getUser()
        const email = userData.user?.email || ''
        
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email,
            name: null,
            role: 'player',
            is_onboarded: false
          })
          .select()
          .single()

        if (createError) throw createError
        
        console.log('✅ Profile created')
        setProfile(newProfile)
      } else {
        console.log('✅ Profile loaded')
        setProfile(data)
      }
    } catch (error: any) {
      console.error('❌ Profile error:', error)
      toast.error('Error loading profile. Please refresh the page.')
    } finally {
      setLoading(false)
      profileFetchRef.current = null
    }
  }

  const signInWithEmail = async (email: string) => {
    try {
      setLoading(true)
      console.log('📧 Sending magic link to:', email)
      
      // Get the current URL without any existing auth tokens
      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.delete('access_token')
      currentUrl.searchParams.delete('refresh_token')
      currentUrl.searchParams.delete('expires_in')
      currentUrl.searchParams.delete('token_type')
      const redirectUrl = currentUrl.toString()
      
      console.log('🔗 Redirect URL:', redirectUrl)
      
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectUrl,
        }
      })

      if (error) throw error

      toast.success('Check your email for the login link!', {
        duration: 5000,
        icon: '📧'
      })
    } catch (error: any) {
      console.error('❌ Sign in error:', error)
      toast.error(error.message || 'Failed to send login link')
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      console.log('🚪 Signing out...')
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Clear state immediately
      setUser(null)
      setProfile(null)
      setLoading(false)
      profileFetchRef.current = null
      
      toast.success('Signed out successfully!')
    } catch (error: any) {
      console.error('❌ Sign out error:', error)
      toast.error('Error signing out')
    }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!user) throw new Error('No user logged in')

      console.log('📝 Updating profile:', updates)

      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      toast.success('Profile updated successfully!')
    } catch (error: any) {
      console.error('❌ Profile update error:', error)
      toast.error(error.message || 'Failed to update profile')
      throw error
    }
  }

  return {
    user,
    profile,
    loading,
    signInWithEmail,
    signOut,
    updateProfile,
  }
}