import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User as UserIcon, Trophy, Calendar, Target, Clock, Award } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { User, Workout } from '../types'
import toast from 'react-hot-toast'

interface WorkoutWithUser extends Workout {
  user?: User
}

export function ParentDashboard() {
  const { user, profile, updateProfile } = useAuth()
  const [players, setPlayers] = useState<User[]>([])
  const [childWorkouts, setChildWorkouts] = useState<WorkoutWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChild, setSelectedChild] = useState<string>('')

  useEffect(() => {
    fetchPlayers()
    if (user?.childId) {
      setSelectedChild(user.childId)
      fetchChildWorkouts(user.childId)
    }
  }, [user])

  const fetchPlayers = async () => {
    try {
      const { data, error } = await api.getPlayerProfiles()

      if (error) throw new Error(error)
      setPlayers(data || [])
    } catch (error: unknown) {
      toast.error('Error loading players: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }

  const fetchChildWorkouts = async (childId: string) => {
    try {
      const { data, error } = await api.getWorkoutsByUserId(childId, 20, 0)

      if (error) throw new Error(error)
      setChildWorkouts(data || [])
    } catch (error: unknown) {
      toast.error('Error loading child workouts: ' + (error instanceof Error ? error.message : String(error)))
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="font-body text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
        <div className="max-w-4xl lg:mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl lg:text-4xl font-bold font-heading text-text-primary">Parent Dashboard</h1>
          </div>
          <p className="text-text-secondary font-body">Track your child's basketball progress</p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 pb-20 lg:pb-6 max-w-4xl lg:mx-auto space-y-6">
        {/* Child Selection */}
        <div className="bg-bg-primary rounded-xl shadow-sm border border-border-primary p-6">
          <h3 className="text-lg font-semibold font-heading text-text-primary mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-primary-600" />
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-body"
            >
              <option value="">Select a player...</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name || player.email.split('@')[0]} ({player.totalPoints || 0} points)
                </option>
              ))}
            </select>
            
            {profile?.childId && selectedChildProfile && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                {selectedChildProfile.avatarUrl ? (
                  <img
                    src={selectedChildProfile.avatarUrl}
                    alt="Child"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                    {selectedChildProfile.name?.[0]?.toUpperCase() || selectedChildProfile.email[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold font-body text-green-800">
                    Currently tracking: {selectedChildProfile.name || selectedChildProfile.email.split('@')[0]}
                  </p>
                  <p className="text-sm font-body text-green-600">{selectedChildProfile.totalPoints || 0} total points</p>
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
                <Trophy className="w-8 h-8 text-primary-500" />
                <div>
                  <div className="text-2xl font-bold font-body text-gray-900">{selectedChildProfile.totalPoints || 0}</div>
                  <div className="text-sm font-body text-gray-600">Total Points</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold font-body text-gray-900">{childWorkouts.length}</div>
                  <div className="text-sm font-body text-gray-600">Total Workouts</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold font-body text-gray-900">
                    {childWorkouts.filter(w => {
                      const workoutDate = new Date(w.created_at)
                      const today = new Date()
                      const diffTime = Math.abs(today.getTime() - workoutDate.getTime())
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                      return diffDays <= 7
                    }).length}
                  </div>
                  <div className="text-sm font-body text-gray-600">This Week</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Workouts */}
        {selectedChild && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold font-heading text-gray-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-500" />
                Recent Training Sessions
              </h3>
            </div>
            
            {childWorkouts.length === 0 ? (
              <div className="p-8 text-center">
                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="font-body text-gray-500">No workouts recorded yet</p>
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
                        <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                          {workout.exercise_type === 'dribbling' && '⚡'}
                          {workout.exercise_type === 'shooting' && '🎯'}
                          {workout.exercise_type === 'conditioning' && '💪'}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2 mb-1 font-body">
                            <span className="font-semibold font-body text-gray-900 capitalize">
                              {workout.exercise_type}
                            </span>
                            <span className="text-sm font-body text-gray-500">•</span>
                            <span className="text-sm font-body text-gray-500">{formatTime(workout.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm font-body text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span className="font-body">{workout.duration_minutes} min</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Trophy className="w-4 h-4 text-primary-500" />
                              <span className="text-primary-600 font-semibold font-body">+{workout.points_earned} pts</span>
                            </div>
                          </div>
                          {workout.notes && (
                            <p className="text-sm font-body text-gray-500 mt-1 italic">"{workout.notes}"</p>
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
    </div>
  )
}