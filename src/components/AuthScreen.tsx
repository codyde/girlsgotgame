import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export function AuthScreen() {
  const [email, setEmail] = useState(() => {
    // Load cached email from localStorage
    return localStorage.getItem('girls-got-game-cached-email') || ''
  })
  const { signInWithEmail, loading } = useAuth()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim() && !loading) {
      // Cache the email for future use
      localStorage.setItem('girls-got-game-cached-email', email.trim())
      signInWithEmail(email.trim())
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

  // Show loading message if we're processing a magic link
  const urlParams = new URLSearchParams(window.location.search)
  const hasTokens = urlParams.get('access_token') || urlParams.get('token_hash') || urlParams.get('type')
  
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
              Processing your magic link
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Team Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="your.email@team.com"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                required
              />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Sending Magic Link...' : 'Join the Team'}
          </motion.button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            We'll send you a secure login link - no password needed!
          </p>
          {email && (
            <p className="text-xs text-green-600 mt-1">
              ✓ Email saved for next time
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}