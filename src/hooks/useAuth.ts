import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import { User } from '../types'
import { useSession } from '../contexts/SessionContext'
import toast from 'react-hot-toast'

interface AuthUser {
  id: string
  email: string
  name?: string
}

interface Session {
  user: AuthUser
}

export function useAuth() {
  const { setSession: setGlobalSession } = useSession()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchingProfile = useRef(false)
  const checkingSession = useRef(false)
  const initialized = useRef(false)

  const fetchProfile = useCallback(async (userId: string, email: string) => {
    if (fetchingProfile.current) return // Prevent multiple simultaneous calls
    
    try {
      fetchingProfile.current = true
      setLoading(true)
      
      // Fetch user profile from the unified user table
      const { data, error } = await api.getProfile()

      if (error) {
        // Only show errors that aren't expected auth failures
        if (!error.includes('401') && !error.includes('Unauthorized') && !error.includes('Not authenticated')) {
          console.error('Error loading profile:', error)
          toast.error('Error loading profile')
        }
      } else {
        setProfile(data)
      }
    } catch (error: any) {
      // Only log and show unexpected errors
      if (!error.message?.includes('401') && !error.message?.includes('Unauthorized') && !error.message?.includes('Not authenticated')) {
        console.error('Error loading profile:', error)
        toast.error('Error loading profile')
      }
    } finally {
      setLoading(false)
      fetchingProfile.current = false
    }
  }, [])

  const checkSession = useCallback(async () => {
    if (checkingSession.current) return // Prevent multiple simultaneous calls
    
    try {
      checkingSession.current = true
      const { data: sessionData, error } = await api.getCurrentSession()
      
      if (error || !sessionData) {
        // Only log non-auth errors (401, Unauthorized, Not authenticated are expected when not logged in)
        if (error && !error.includes('401') && !error.includes('Unauthorized') && !error.includes('Not authenticated')) {
          console.error('Session check error:', error)
        }
        setSession(null)
        setUser(null)
        setProfile(null)
        setGlobalSession(null)
        setLoading(false)
        return
      }

      const userSession = {
        user: {
          id: sessionData.user.id,
          email: sessionData.user.email,
          name: sessionData.user.name
        }
      }

      setSession(userSession)
      setUser(userSession.user)
      
      // Update global session context for UploadThing
      setGlobalSession({
        userId: userSession.user.id,
        email: userSession.user.email,
        name: userSession.user.name
      })

      // Fetch profile
      await fetchProfile(userSession.user.id, userSession.user.email)
    } catch (error) {
      // Only log unexpected errors (not auth-related ones)
      console.error('Unexpected session check error:', error)
      setSession(null)
      setUser(null)
      setProfile(null)
      setGlobalSession(null)
      setLoading(false)
    } finally {
      checkingSession.current = false
    }
  }, [fetchProfile])

  useEffect(() => {
    if (initialized.current) return // Only initialize once
    initialized.current = true
    
    // Check for auth redirect callback
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('callback') === 'auth') {
      // Remove callback param from URL
      window.history.replaceState({}, document.title, window.location.pathname)
      // If we have auth callback, check session immediately
      checkSession()
    } else {
      // Delay initial auth check slightly to avoid immediate 401 noise on fresh page load
      setTimeout(checkSession, 100)
    }

    // Disable periodic session check to prevent unwanted refreshes
    // const interval = setInterval(checkSession, 60000) // Check every minute
    // return () => clearInterval(interval)
  }, [checkSession])

  const updateProfile = async (updates: Partial<User>) => {
    try {
      if (!user) throw new Error('No user logged in')

      // Optimistic update: immediately update UI  
      setProfile(prevProfile => {
        if (!prevProfile) return prevProfile
        return {
          ...prevProfile,
          ...updates,
          updatedAt: new Date().toISOString(),
          _updated: new Date().getTime()
        }
      })

      const { data, error } = await api.updateProfile(updates)

      if (error) throw new Error(error)

      // Update with the real data from the API
      setProfile(() => {
        const newProfile = { 
          ...data, 
          _updated: new Date().getTime() 
        }
        return newProfile
      })
      
      toast.success('Profile updated successfully!')
    } catch (error: any) {
      console.error('Update profile error:', error)
      
      // Revert optimistic update on error - refetch profile
      await fetchProfile(user.id, user.email)
      
      toast.error('Failed to update profile')
      throw error
    }
  }

  const signOut = async () => {
    try {
      const { error } = await api.signOut()
      if (error) throw new Error(error)
      
      toast.success('Signed out successfully!')
    } catch (error: any) {
      console.error('Sign out error:', error)
      toast.error('Error signing out')
    } finally {
      // Force page refresh to return to login screen
      setTimeout(() => {
        window.location.reload()
      }, 100) // Brief delay to show the toast message
    }
  }

  const signInWithGoogle = async () => {
    try {
      // POST request to Better Auth social sign-in endpoint
      const baseUrl = import.meta.env.VITE_API_URL || 
        (import.meta.env.PROD ? 'https://api.girlsgotgame.app' : 'http://localhost:3001');
      const response = await fetch(`${baseUrl}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          provider: 'google',
          callbackURL: window.location.origin + '?callback=auth'
        })
      });

      const data = await response.json();
      
      if (data.url) {
        // Redirect to Google OAuth
        window.location.href = data.url;
      } else {
        throw new Error('No redirect URL received');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      toast.error('Error starting Google sign-in');
    }
  }
  
  return {
    session,
    user,
    profile,
    loading,
    updateProfile,
    signOut,
    signInWithGoogle,
  }
}