import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Trophy, Calendar, Target, Clock, Award } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Profile, Workout } from '../types'
import toast from 'react-hot-toast'

interface WorkoutWithProfile extends Workout {
  profiles?: Profile
}

export function ParentDashboard() {
  const { profile, updateProfile } = useAuth()
  const [players, setPlayers] = useState<Profile[]>([])
  const [childWorkouts, setChildWorkouts] = useState<WorkoutWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChild, setSelectedChild] = useState<string>('')

  useEffect(() => {
    fetchPlayers()
    if (profile?.child_id) {
      setSelectedChild(profile.child_id)
      fetchChildWorkouts(profile.child_id)
    }
  }, [profile])

  const fetchPlayers = async () => {
    try {
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
      setLoading(false)
    }
  }

  const fetchChildWorkouts = async (childId: string) => {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          profiles:user_id (name, email, avatar_url)
        `)
        .eq('user_id', childId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setChildWorkouts(data || [])
    } catch (error: any) {
      toast.error('Error loading child workouts: ' + error.message)
    }
  }

  const assignChild = async (childId: string) => {
    try {
      await updateProfile({ child_id: childId })
      setSelectedChild(childId)
      fetchChildWorkouts(childId)
      toast.success('Child assigned successfully!')
    } catch {
      // Error handling is done in the hook
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const selectedChildProfile = players.find(p => p.id === selectedChild)

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20 lg:pb-0">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 lg:p-8">
        <h1 className="text-2xl lg:text-3xl font-bold mb-2">Parent Dashboard</h1>
        <p className="text-orange-100">Track your child's basketball progress</p>
      </div>

      <div className="p-4 lg:p-6 space-y-6 max-w-4xl lg:mx-auto">
        {/* Child Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-500" />
            Select Your Child
          </h3>
          
          <div className="space-y-3">
            <select
              value={selectedChild}
              onChange={(e) => {
                const childId = e.target.value
                if (childId) {
                  assignChild(childId)
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">Select a player...</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name || player.email.split('@')[0]} ({player.total_points} points)
                </option>
              ))}
            </select>
            
            {profile?.child_id && selectedChildProfile && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                {selectedChildProfile.avatar_url ? (
                  <img
                    src={selectedChildProfile.avatar_url}
                    alt="Child"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                    {selectedChildProfile.name?.[0]?.toUpperCase() || selectedChildProfile.email[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-green-800">
                    Currently tracking: {selectedChildProfile.name || selectedChildProfile.email.split('@')[0]}
                  </p>
                  <p className="text-sm text-green-600">{selectedChildProfile.total_points} total points</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Child Stats */}
        {selectedChildProfile && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold text-gray-900">{selectedChildProfile.total_points}</div>
                  <div className="text-sm text-gray-600">Total Points</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold text-gray-900">{childWorkouts.length}</div>
                  <div className="text-sm text-gray-600">Total Workouts</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {childWorkouts.filter(w => {
                      const workoutDate = new Date(w.created_at)
                      const today = new Date()
                      const diffTime = Math.abs(today.getTime() - workoutDate.getTime())
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                      return diffDays <= 7
                    }).length}
                  </div>
                  <div className="text-sm text-gray-600">This Week</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Workouts */}
        {selectedChild && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-500" />
                Recent Training Sessions
              </h3>
            </div>
            
            {childWorkouts.length === 0 ? (
              <div className="p-8 text-center">
                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No workouts recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {childWorkouts.map((workout, index) => (
                  <motion.div
                    key={workout.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                          {workout.exercise_type === 'dribbling' && '⚡'}
                          {workout.exercise_type === 'shooting' && '🎯'}
                          {workout.exercise_type === 'conditioning' && '💪'}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 capitalize">
                              {workout.exercise_type}
                            </span>
                            <span className="text-sm text-gray-500">•</span>
                            <span className="text-sm text-gray-500">{formatTime(workout.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{workout.duration_minutes} min</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Trophy className="w-4 h-4 text-orange-500" />
                              <span className="text-orange-600 font-semibold">+{workout.points_earned} pts</span>
                            </div>
                          </div>
                          {workout.notes && (
                            <p className="text-sm text-gray-500 mt-1 italic">"{workout.notes}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}