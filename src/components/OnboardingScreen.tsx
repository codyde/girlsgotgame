import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, User, ArrowRight, Mail, Clock, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'
import toast from 'react-hot-toast'

export function OnboardingScreen() {
  const { updateProfile, signOut } = useAuth()
  const [step, setStep] = useState<'role' | 'child-selection'>('role')
  const [selectedRole, setSelectedRole] = useState<'parent' | 'player' | null>(null)
  const [players, setPlayers] = useState<Profile[]>([])
  const [selectedChild, setSelectedChild] = useState<string>('')
  const [manualEmail, setManualEmail] = useState('')
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  useEffect(() => {
    if (step === 'child-selection') {
      fetchPlayers()
    }
  }, [step])

  const fetchPlayers = async () => {
    try {
      setLoadingPlayers(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'player')
        .order('name')

      if (error) throw error
      setPlayers(data || [])
    } catch (error: any) {
      toast.error('Error loading players: ' + error.message)
    } finally {
      setLoadingPlayers(false)
    }
  }

  const handleRoleSelection = async (role: 'parent' | 'player') => {
    setSelectedRole(role)
    
    if (role === 'player') {
      // Players go directly to the main app
      try {
        setLoading(true)
        await updateProfile({ 
          role: 'player', 
          is_onboarded: true 
        })
      } catch (error) {
        // Error handling is done in the hook
      } finally {
        setLoading(false)
      }
    } else {
      // Parents go to child selection
      setStep('child-selection')
    }
  }

  const handleChildSelection = async () => {
    try {
      setLoading(true)
      
      let childId = null
      
      if (selectedChild) {
        childId = selectedChild
      } else if (manualEmail.trim()) {
        // Find player by email
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', manualEmail.trim().toLowerCase())
          .eq('role', 'player')
          .single()
        
        if (error || !data) {
          toast.error('Player not found with that email address')
          setLoading(false)
          return
        }
        
        childId = data.id
      }
      
      await updateProfile({ 
        role: 'parent', 
        child_id: childId,
        is_onboarded: true 
      })
      
      if (childId) {
        toast.success('Child assigned successfully!')
      }
    } catch (error) {
      // Error handling is done in the hook
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  const skipChildSelection = async () => {
    try {
      setLoading(true)
      console.log('🟡 Starting skipChildSelection...')
      await updateProfile({ 
        role: 'parent', 
        child_id: null,
        is_onboarded: true 
      })
      console.log('🟢 updateProfile completed successfully')
      toast.success('Setup completed! You can assign a child later in your profile.')
    } catch (error) {
      console.error('🔴 Error in skipChildSelection:', error)
      // Error handling is done in the hook
    } finally {
      setLoading(false)
    }
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
        {step === 'role' ? (
          <>
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
                Welcome to Girls Got Game!
              </h1>
              <p className="text-gray-600 lg:text-lg">
                Let's get you set up. Are you a parent or a player?
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleRoleSelection('parent')}
                disabled={loading}
                className="w-full p-6 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50 transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold">I'm a Parent</h3>
                    <p className="text-sm opacity-75">Track and support my child's basketball journey</p>
                  </div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleRoleSelection('player')}
                disabled={loading}
                className="w-full p-6 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50 transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-orange-100 text-orange-600">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold">I'm a Player</h3>
                    <p className="text-sm opacity-75">Track my own training and progress</p>
                  </div>
                </div>
              </motion.button>
            </div>

            {loading && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
              </div>
            )}

            {/* Cancel and Logout Button */}
            <div className="mt-6 text-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  console.log('🔴 LOGOUT BUTTON CLICKED - Starting logout process...')
                  signOut().then(() => {
                    console.log('🔴 LOGOUT COMPLETED - Forcing page reload...')
                    // Force page reload to completely clear state
                    window.location.href = '/'
                  }).catch((error) => {
                    console.error('🔴 LOGOUT ERROR:', error)
                    // Force reload even on error to clear stuck state
                    window.location.href = '/'
                  })
                }}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                Cancel and Logout
              </motion.button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full mb-4 shadow-lg"
              >
                <Users className="w-8 h-8 text-white" />
              </motion.div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Select Your Child
              </h1>
              <p className="text-gray-600 lg:text-lg">
                Choose which player you'd like to track
              </p>
            </div>

            {loadingPlayers ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading players...</p>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {/* Existing Players */}
                {players.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Select from registered players:</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {players.map((player) => (
                        <motion.button
                          key={player.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedChild(player.id)
                            setManualEmail('')
                            setShowManualEntry(false)
                          }}
                          className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                            selectedChild === player.id
                              ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {player.avatar_url ? (
                              <img
                                src={player.avatar_url}
                                alt="Player"
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                                {player.name?.[0]?.toUpperCase() || player.email[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold">{player.name || player.email.split('@')[0]}</p>
                              <p className="text-sm opacity-75">{player.total_points} points</p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual Entry Option */}
                <div className="border-t border-gray-200 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowManualEntry(!showManualEntry)
                      setSelectedChild('')
                    }}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      showManualEntry
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold">Enter child's email manually</p>
                        <p className="text-sm opacity-75">If your child isn't listed above</p>
                      </div>
                    </div>
                  </motion.button>

                  {showManualEntry && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3"
                    >
                      <input
                        type="email"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        placeholder="child@email.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </motion.div>
                  )}
                </div>

                {/* No Players Message */}
                {players.length === 0 && (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 mb-2">No registered players found</p>
                    <p className="text-sm text-gray-500">Use the manual entry option below to add your child's email</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={skipChildSelection}
                disabled={loading}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center gap-2">
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      Skip for now
                    </>
                  )}
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleChildSelection}
                disabled={loading || (!selectedChild && !manualEmail.trim())}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center gap-2">
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </div>
              </motion.button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}