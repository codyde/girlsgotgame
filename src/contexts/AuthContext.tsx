import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { api } from '../lib/api'
import { appLogger } from '../utils/logger'
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
        setProfile(data as User)
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
      console.log('🔄 Checking session...');
      const { data: sessionData, error } = await api.getCurrentSession()
      
      if (error || !sessionData) {
        console.log('❌ Session check failed:', error);
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

      console.log('✅ Session found:', sessionData);

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
      
      // Clean up invite URL parameters after successful authentication
      const currentUrl = new URL(window.location.href)
      if (currentUrl.searchParams.has('invite')) {
        console.log('🧹 Cleaning up invite parameter from URL after successful authentication')
        currentUrl.searchParams.delete('invite')
        // Use pathname + search, or just pathname if no search params remain
        const cleanUrl = currentUrl.search ? currentUrl.pathname + currentUrl.search : currentUrl.pathname
        window.history.replaceState({}, document.title, cleanUrl)
      }
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
    console.log('🔍 URL Params on page load:', window.location.href);
    console.log('🔍 Auth callback param:', urlParams.get('callback'));
    console.log('🔍 Signup param:', urlParams.get('signup'));
    
    if (urlParams.get('callback') === 'auth') {
      console.log('✅ Auth callback detected, checking session immediately');
      
      // Check if this is a signup flow (from invite link)
      const isSignup = urlParams.get('signup') === 'true'
      
      // Remove callback and signup params from URL but preserve other params
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('callback')
      newUrl.searchParams.delete('signup')
      window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search)
      
      // If we have auth callback, check session immediately
      checkSession().then(() => {
        // After session is established, process any pending invite code
        if (isSignup) {
          const pendingInviteCodeId = sessionStorage.getItem('pendingInviteCodeId')
          if (pendingInviteCodeId) {
            appLogger.invite.callbackReceived(pendingInviteCodeId, user?.id)
            appLogger.invite.usageStart(pendingInviteCodeId, user?.id || 'unknown')
            console.log('🎫 Processing pending invite code:', pendingInviteCodeId)
            
            api.useInviteCode(pendingInviteCodeId).then(async ({ data, error }) => {
              if (error) {
                appLogger.invite.usageError(pendingInviteCodeId, user?.id || 'unknown', error)
                console.error('❌ Failed to use invite code:', error)
              } else {
                appLogger.invite.usageSuccess(pendingInviteCodeId, user?.id || 'unknown')
                if (user?.id && user?.email) {
                  appLogger.invite.signupComplete(pendingInviteCodeId, user.id, user.email)
                }
                console.log('✅ Invite code used successfully')
                
                // Use the updated profile data returned from the API instead of refetching
                if (data?.updatedProfile) {
                  console.log('✨ Using updated profile data from invite response (no extra fetch needed)')
                  setProfile(data.updatedProfile as User)
                } else {
                  // Fallback to refetch if no updated profile returned
                  console.log('🔄 No updated profile in response, falling back to refresh...')
                  try {
                    const { data: currentSessionData } = await api.getCurrentSession()
                    if (currentSessionData?.user?.id && currentSessionData?.user?.email) {
                      await fetchProfile(currentSessionData.user.id, currentSessionData.user.email)
                    }
                  } catch (error) {
                    console.error('Failed to refresh profile after invite usage:', error)
                  }
                }
              }
              // Clear the pending invite code
              sessionStorage.removeItem('pendingInviteCodeId')
            })
          }
        }
      })
    } else {
      console.log('⏱️ No auth callback, checking session with delay');
      // Delay initial auth check slightly to avoid immediate 401 noise on fresh page load
      setTimeout(checkSession, 100)
    }
  }, [checkSession])

  const updateProfile = async (updates: Partial<User>) => {
    try {
      if (!user) throw new Error('No user logged in')

      // Optimistic update: immediately update UI while preserving all existing fields
      setProfile(prevProfile => {
        if (!prevProfile) return prevProfile
        return {
          ...prevProfile,
          ...updates,
          updatedAt: new Date().toISOString(),
          _updated: new Date().getTime()
        } as User
      })

      const { data, error } = await api.updateProfile(updates)

      if (error) throw new Error(error)

      // Update with server response (should already include latest verification status)
      setProfile(data as User)
      toast.success('Profile updated!')
      
      // Log completion but don't refetch since server response should be complete
      if (updates.isOnboarded === true) {
        console.log('✅ Onboarding completed, using profile data from server response')
      }
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
      console.log('🚀 Starting Google sign-in process...');
      
      // Better Auth Google OAuth - use the correct social sign-in endpoint
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const signInUrl = `${backendUrl}/api/auth/sign-in/social`;
      
      console.log('📍 Calling sign-in endpoint:', signInUrl);
      
      const response = await fetch(signInUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'google',
          callbackURL: window.location.origin + '?callback=auth'
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Sign-in request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Sign-in response:', data);

      if (data.url) {
        console.log('🔗 Redirecting to Google OAuth:', data.url);
        window.location.href = data.url;
      } else {
        throw new Error('No redirect URL received from server');
      }
    } catch (error: any) {
      console.error('❌ Google sign-in error:', error);
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