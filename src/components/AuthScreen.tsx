import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export function AuthScreen() {
  const [email, setEmail] = useState(() => {
    // Load cached email from localStorage
    return localStorage.getItem('girls-got-game-cached-email') || ''
  })
  const [loading, setLoading] = useState(false)

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim() && !loading) {
      try {
        setLoading(true)
        // Cache the email for future use
        localStorage.setItem('girls-got-game-cached-email', email.trim())
        
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: window.location.origin
          }
        })
        
        if (error) throw error
        
        toast.success('Magic link sent! Check your email to sign in.')
      } catch (error: any) {
        console.error('Email sign-in error:', error)
        toast.error('Failed to send magic link')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      
      if (error) throw error
    } catch (error: any) {
      console.error('Google sign-in error:', error)
      toast.error('Failed to sign in with Google')
      setLoading(false)
    }
  }

  const handleAppleSignIn = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin
        }
      })
      
      if (error) throw error
    } catch (error: any) {
      console.error('Apple sign-in error:', error)
      toast.error('Failed to sign in with Apple')
      setLoading(false)
    }
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value
    setEmail(newEmail)
    // Cache email as user types (debounced by React's batching)
    if (newEmail.trim()) {
      localStorage.setItem('girls-got-game-cached-email', newEmail.trim())
    }
  }

  // Show loading message if we're processing OAuth callback
  const urlParams = new URLSearchParams(window.location.search)
  const hasTokens = urlParams.get('access_token') || urlParams.get('token_hash') || urlParams.get('type') || urlParams.get('code')
  
  if (hasTokens) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 lg:p-8">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.pexels.com/photos/1752757/pexels-photo-1752757.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop')`,
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/80 to-purple-600/80"></div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 lg:p-10 w-full max-w-md lg:max-w-lg border border-white/20"
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full mb-4 shadow-lg"
            >
              <span className="text-2xl">🏀</span>
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Signing you in...
            </h1>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">
              Processing authentication...
            </p>
          </div>
        </motion.div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 lg:p-8">
      {/* Basketball themed background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.pexels.com/photos/1752757/pexels-photo-1752757.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop')`,
        }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/80 to-purple-600/80"></div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 lg:p-10 w-full max-w-md lg:max-w-lg border border-white/20"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full mb-4 shadow-lg"
          >
            <span className="text-2xl">🏀</span>
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Girls Got Game
          </h1>
          <p className="text-gray-600 lg:text-lg">
            Elevate your game with the Girls Got Game community
          </p>
        </div>

        {/* Social Sign-In Buttons */}
        <div className="space-y-4 mb-8">
          {/* Apple Sign In Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAppleSignIn}
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            {loading ? 'Signing in...' : 'Continue with Apple'}
          </motion.button>

          {/* Google Sign In Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </motion.button>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Secure authentication with Apple or Google - no passwords needed!
          </p>
        </div>
      </motion.div>
    </div>
  )
}