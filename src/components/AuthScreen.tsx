import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import logo from '../assets/logo.png'
import { Heart, Share2, TrendingUp } from 'lucide-react'

export function AuthScreen() {
  const [loading, setLoading] = useState(false)
  const { signInWithGoogle } = useAuth()

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      signInWithGoogle()
    } catch (error: any) {
      console.error('Google sign-in error:', error)
      toast.error('Failed to sign in with Google')
      setLoading(false)
    }
  }

  // Show loading message if we're processing OAuth callback
  const urlParams = new URLSearchParams(window.location.search)
  const hasTokens = urlParams.get('callback') === 'auth'
  
  if (hasTokens) {
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
              Processing authentication...
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen relative">
      {/* Basketball themed background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.pexels.com/photos/1752757/pexels-photo-1752757.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop')`,
          filter: 'blur(6px)',
        }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/50 to-purple-600/50"></div>
      
      {/* Mobile Layout */}
      <div className="lg:hidden min-h-screen flex items-center justify-center p-4">
        <div
          className="relative bg-white/60 backdrop-blur-md rounded-2xl shadow-xl p-8 w-full max-w-md border border-white/30"
        >
          <div className="text-center mb-8">
            <div className="mb-6">
              <img src={logo} alt="Girls Got Game" className="mx-auto" />
            </div>
          </div>

          {/* Google Sign In Button */}
          <div className="mb-8">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-white text-gray-700 py-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3 border border-gray-300 hover:bg-gray-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="font-medium">
                {loading ? 'Signing in...' : 'Sign in with Google'}
              </span>
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500 font-body">
              Don't have an account? You need an invite link to sign up.
            </p>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left Side - Branding */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="relative text-left max-w-2xl">
            <div className="mb-12">
              <h1 className="text-8xl xl:text-9xl font-heading font-bold text-white mb-6 leading-tight">
                GIRLS GOT GAME
              </h1>
              <h2 className="text-xl xl:text-2xl font-sans text-white/80 font-normal">
                A Girls Basketball and Training Community
              </h2>
            </div>
            
            {/* Informational Cards */}
            <div className="grid grid-cols-2 gap-6 mt-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Share2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white font-heading mb-2">Share Your Journey</h3>
                <p className="text-white/70 font-sans text-base">Document your progress and inspire others</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white font-heading mb-2">Join the Community</h3>
                <p className="text-white/70 font-sans text-base">Connect with teammates and build friendships</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            className="relative bg-white/60 backdrop-blur-md rounded-2xl shadow-xl p-6 w-full max-w-lg border border-white/30"
          >
            <div className="text-center mb-4 flex justify-center">
              <div className="w-44 h-44 bg-white rounded-full flex items-center justify-center p-2">
                <img src={logo} alt="Girls Got Game" className="h-40 w-40 object-cover border-4 border-white rounded-full" />
              </div>
            </div>

            {/* Google Sign In Button */}
            <div className="mb-4">
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white text-gray-700 py-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3 border border-gray-300 hover:bg-gray-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="font-medium">
                  {loading ? 'Signing in...' : 'Sign in with Google'}
                </span>
              </button>
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-500 font-body">
                Don't have an account? You need an invite link to sign up.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}