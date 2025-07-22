import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { api } from '../lib/api'
import { User } from '../types'
import { useSession } from './SessionContext'
import toast from 'react-hot-toast'

interface AuthUser {
  id: string
  email: string
  name?: string
}

interface Session {
  user: AuthUser
}

interface AuthContextType {
  session: Session | null
  user: AuthUser | null
  profile: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
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
  }, [fetchProfile, setGlobalSession])

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

      // Update with server response
      setProfile(data)
      toast.success('Profile updated!')
    } catch (error: any) {
      console.error('Update profile error:', error)
      toast.error(error.message || 'Error updating profile')
      
      // Revert optimistic update by refetching
      if (user) {
        await fetchProfile(user.id, user.email)
      }
    }
  }

  const signInWithGoogle = async () => {
    try {
      // Better Auth Google OAuth redirect
      window.location.href = '/api/auth/sign-in/google'
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      toast.error(error.message || 'Sign in failed')
    }
  }

  const signOut = async () => {
    try {
      // Better Auth sign out
      await api.signOut()
      
      setSession(null)
      setUser(null)
      setProfile(null)
      setGlobalSession(null)
      
      // Force page refresh to return to login screen
      setTimeout(() => {
        window.location.reload()
      }, 100)
    } catch (error: any) {
      console.error('Sign out error:', error)
      toast.error('Error signing out')
    }
  }

  const value = {
    session,
    user,
    profile,
    loading,
    signInWithGoogle,
    signOut,
    updateProfile
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}