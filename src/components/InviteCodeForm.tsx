import React, { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import toast from 'react-hot-toast'
import logo from '../assets/logo.png'

interface InviteCodeFormProps {
  onBack: () => void
}

export function InviteCodeForm({ onBack }: InviteCodeFormProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; inviteCodeId?: string } | null>(null)
  const { signInWithGoogle } = useAuth()

  const handleValidateCode = async (codeToValidate = code) => {
    // Ensure we have a string
    const codeValue = String(codeToValidate || '');
    
    console.log('🎫 Frontend - codeToValidate:', codeToValidate);
    console.log('🎫 Frontend - codeValue:', codeValue);
    console.log('🎫 Frontend - code state:', code);
    
    if (!codeValue.trim()) {
      toast.error('Please enter an invite code')
      return
    }

    try {
      setLoading(true)
      console.log('🎫 Frontend - calling API with:', codeValue.trim());
      const { data, error } = await api.validateInviteCode(codeValue.trim())
      
      if (error) {
        toast.error(error)
        setValidationResult(null)
      } else if (data) {
        setValidationResult(data)
        toast.success('Valid invite code! You can now sign in with Google.')
      }
    } catch (error) {
      console.error('Error validating invite code:', error)
      toast.error('Failed to validate invite code')
      setValidationResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (newCode: string) => {
    setCode(newCode.toUpperCase())
    setValidationResult(null) // Clear previous validation
  }

  const handleGoogleSignIn = async () => {
    if (!validationResult?.inviteCodeId) {
      toast.error('Please validate your invite code first')
      return
    }

    try {
      setLoading(true)
      
      // Call OAuth with invite code parameter
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
          callbackURL: window.location.origin + '?callback=auth&i=' + validationResult.inviteCodeId.substring(0, 8),
          inviteCodeId: validationResult.inviteCodeId // Include invite code ID
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
      console.error('Error signing in:', error)
      toast.error('Failed to sign in with Google')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative">
      {/* Same background as AuthScreen */}
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
          {/* Back Button */}
          <button
            onClick={onBack}
            className="absolute top-4 left-4 p-2 text-gray-600 hover:text-gray-800 transition-colors"
            disabled={loading}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="text-center mb-8">
            <div className="mb-6">
              <img src={logo} alt="Girls Got Game" className="mx-auto" />
            </div>
            <h2 className="text-2xl font-heading font-bold text-gray-900 mb-2">
              Enter Invite Code
            </h2>
            <p className="text-gray-600 font-body">
              Enter the invite code you received
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="Enter invite code"
                maxLength={10}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-center text-lg tracking-wider"
                disabled={loading}
              />
            </div>

            <button
              onClick={() => handleValidateCode()}
              disabled={loading || !code.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Validating...' : 'Validate Code'}
            </button>

            {validationResult?.valid && (
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-medium shadow-lg hover:shadow-xl hover:bg-green-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>
                  {loading ? 'Signing in...' : 'Sign in with Google'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left Side - Same as other screens */}
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
          </div>
        </div>

        {/* Right Side - Invite Code Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            className="relative bg-white/60 backdrop-blur-md rounded-2xl shadow-xl p-8 w-full max-w-lg border border-white/30"
          >
            {/* Back Button */}
            <button
              onClick={onBack}
              className="absolute top-6 left-6 p-2 text-gray-600 hover:text-gray-800 transition-colors"
              disabled={loading}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="text-center mb-8">
              <div className="mb-6 flex justify-center">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center p-2">
                  <img src={logo} alt="Girls Got Game" className="h-28 w-28 object-cover border-4 border-white rounded-full" />
                </div>
              </div>
              <h2 className="text-3xl font-heading font-bold text-gray-900 mb-2">
                Enter Invite Code
              </h2>
              <p className="text-gray-600 font-body">
                Enter the invite code you received
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="Enter invite code"
                  maxLength={10}
                  className="w-full px-4 py-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-center text-xl tracking-wider"
                  disabled={loading}
                />
              </div>

              <button
                onClick={() => handleValidateCode()}
                disabled={loading || !code.trim()}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-medium shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Validating...' : 'Validate Code'}
              </button>

              {validationResult?.valid && (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-4 rounded-xl font-medium shadow-lg hover:shadow-xl hover:bg-green-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>
                    {loading ? 'Signing in...' : 'Sign in with Google'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}