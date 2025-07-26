import React, { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { appLogger } from '../utils/logger'
import toast from 'react-hot-toast'
import logo from '../assets/logo.png'
import { Share2, TrendingUp, AlertCircle } from 'lucide-react'

interface InviteSignUpScreenProps {
  inviteCode: string
  onSignUpComplete: () => void
}

export function InviteSignUpScreen({ inviteCode, onSignUpComplete }: InviteSignUpScreenProps) {
  const [loading, setLoading] = useState(false)
  const [validatingCode, setValidatingCode] = useState(true)
  const [isValidCode, setIsValidCode] = useState(false)
  const [inviteCodeId, setInviteCodeId] = useState<string | null>(null)

  // Validate the invite code on component mount and auto-start OAuth if valid
  useEffect(() => {
    const validateCodeAndStartOAuth = async () => {
      try {
        setValidatingCode(true)
        
        // Log invite link clicked
        appLogger.invite.linkClicked(inviteCode)
        appLogger.invite.validationStart(inviteCode)
        console.log('🎫 Validating invite code:', inviteCode)
        
        const { data, error } = await api.validateInviteCode(inviteCode)
        
        if (error) {
          appLogger.invite.validationError(inviteCode, error)
          console.error('❌ Invite code validation failed:', error)
          toast.error('Invalid or expired invite code')
          setIsValidCode(false)
          setValidatingCode(false)
        } else {
          appLogger.invite.validationSuccess(inviteCode, data.inviteCodeId)
          console.log('✅ Invite code valid:', data)
          setIsValidCode(true)
          setInviteCodeId(data.inviteCodeId)
          
          // Automatically start OAuth flow after successful validation
          console.log('🚀 Auto-starting Google OAuth flow...')
          await startGoogleOAuth(data.inviteCodeId)
        }
      } catch (error: any) {
        appLogger.invite.validationError(inviteCode, error.message || 'Unknown error')
        console.error('❌ Error validating invite code:', error)
        toast.error('Error validating invite code')
        setIsValidCode(false)
        setValidatingCode(false)
      }
    }

    if (inviteCode) {
      validateCodeAndStartOAuth()
    }
  }, [inviteCode])

  const startGoogleOAuth = async (validatedInviteCodeId: string) => {
    try {
      setLoading(true)
      appLogger.invite.oauthStart(validatedInviteCodeId)
      console.log('🚀 Starting Google OAuth with invite code...')
      
      // Store invite code ID in sessionStorage so we can use it after OAuth callback
      sessionStorage.setItem('pendingInviteCodeId', validatedInviteCodeId)
      
      // Better Auth Google OAuth - use the correct social sign-in endpoint
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const signInUrl = `${backendUrl}/api/auth/sign-in/social`
      
      console.log('📍 Calling sign-in endpoint:', signInUrl)
      
      const response = await fetch(signInUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'google',
          callbackURL: window.location.origin + `?callback=auth&signup=true&invite=${inviteCode}`
        }),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`OAuth request failed: ${response.status}`)
      }

      const data = await response.json()
      console.log('✅ OAuth response:', data)

      if (data.url) {
        appLogger.invite.oauthRedirect(validatedInviteCodeId, data.url)
        console.log('🔗 Redirecting to Google OAuth:', data.url)
        window.location.href = data.url
      } else {
        throw new Error('No redirect URL received from server')
      }
    } catch (error: any) {
      appLogger.invite.oauthError(validatedInviteCodeId, error.message || 'Unknown error')
      console.error('❌ Google OAuth error:', error)
      toast.error(error.message || 'OAuth failed')
      setLoading(false)
      setValidatingCode(false)
    }
  }

  // Show loading while validating code
  if (validatingCode) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 lg:p-8">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.pexels.com/photos/1752757/pexels-photo-1752757.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop')`,
            filter: 'blur(6px)',
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/50 to-purple-600/50"></div>
          
        <div
          className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 lg:p-10 w-full max-w-md lg:max-w-lg border border-white/20"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-64 h-64 mb-4">
              <img src={logo} alt="Girls Got Game" className="h-64 w-64 object-contain" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-heading font-bold text-gray-900 mb-4">
              {loading ? 'Signing you in...' : 'Validating invite...'}
            </h1>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">
              {loading ? 'Redirecting to Google OAuth...' : 'Checking your invite code...'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show error if invite code is invalid
  if (!isValidCode) {
    return (
      <div className="min-h-screen relative">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.pexels.com/photos/1752757/pexels-photo-1752757.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop')`,
            filter: 'blur(6px)',
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/50 to-purple-600/50"></div>
        
        <div className="min-h-screen flex items-center justify-center p-4">
          <div
            className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-full max-w-md border border-white/20"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-heading font-bold text-gray-900 mb-4">
                Invalid Invite Code
              </h1>
              <p className="text-gray-600 mb-6">
                The invite code you're trying to use is invalid or has expired. Please check with the person who sent you the invite for a new link.
              </p>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                Go to Homepage
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If code is valid, we should be loading (OAuth in progress) or have already redirected
  // This should not render if OAuth redirect was successful
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 lg:p-8">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.pexels.com/photos/1752757/pexels-photo-1752757.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop')`,
          filter: 'blur(6px)',
        }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/50 to-purple-600/50"></div>
        
      <div
        className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 lg:p-10 w-full max-w-md lg:max-w-lg border border-white/20"
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-64 h-64 mb-4">
            <img src={logo} alt="Girls Got Game" className="h-64 w-64 object-contain" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-heading font-bold text-gray-900 mb-4">
            Signing you in...
          </h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            Starting Google OAuth...
          </p>
        </div>
      </div>
    </div>
  )
}