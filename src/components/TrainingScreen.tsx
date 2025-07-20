import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Award, Clock, Star } from 'lucide-react'
import { exerciseTemplates } from '../data/exercises'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export function TrainingScreen() {
  const { user, profile } = useAuth()
  const [selectedType, setSelectedType] = useState<'all' | 'dribbling' | 'shooting' | 'conditioning'>('all')
  const [activeWorkout, setActiveWorkout] = useState<any>(null)
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')

  const filteredExercises = selectedType === 'all' 
    ? exerciseTemplates 
    : exerciseTemplates.filter(ex => ex.type === selectedType)

  const startWorkout = (exercise: any) => {
    setActiveWorkout(exercise)
    setDuration('')
    setNotes('')
  }

  const completeWorkout = async () => {
    if (!user || !activeWorkout || !duration) return

    try {
      const durationNum = parseInt(duration)
      const pointsEarned = Math.floor(activeWorkout.basePoints * Math.min(durationNum / 10, 3)) // More time = more points (max 3x)

      const { error } = await supabase
        .from('workouts')
        .insert({
          user_id: user.id,
          exercise_type: activeWorkout.type,
          points_earned: pointsEarned,
          duration_minutes: durationNum,
          notes: notes || null
        })

      if (error) throw error

      toast.success(`Workout completed! +${pointsEarned} points!`)
      setActiveWorkout(null)
      setDuration('')
      setNotes('')
    } catch (error: any) {
      toast.error('Error saving workout: ' + error.message)
    }
  }

  return (
    <div className="p-4 lg:p-6 pb-20 lg:pb-0 max-w-4xl lg:mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Training Programs</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Award className="w-4 h-4 text-orange-500" />
          <span>Total Points: <span className="font-bold text-orange-600">{profile?.total_points || 0}</span></span>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['all', 'dribbling', 'shooting', 'conditioning'].map((type) => (
          <motion.button
            key={type}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedType(type as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedType === type
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </motion.button>
        ))}
      </div>

      {/* Exercise cards */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
        {filteredExercises.map((exercise, index) => (
          <motion.div
            key={exercise.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{exercise.icon}</div>
                <div>
                  <h3 className="font-semibold text-gray-900">{exercise.name}</h3>
                  <p className="text-sm text-gray-600">{exercise.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-orange-600">
                <Star className="w-4 h-4" />
                <span className="font-semibold">{exercise.basePoints}</span>
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => startWorkout(exercise)}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Play className="w-4 h-4" />
              Start Training
            </motion.button>
          </motion.div>
        ))}
      </div>

      {/* Workout modal */}
      <AnimatePresence>
        {activeWorkout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md"
            >
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">{activeWorkout.icon}</div>
                <h3 className="text-xl font-bold text-gray-900">{activeWorkout.name}</h3>
                <p className="text-gray-600">{activeWorkout.description}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="15"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="How did it go? Any observations..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setActiveWorkout(null)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={completeWorkout}
                  disabled={!duration}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg font-medium disabled:opacity-50 hover:shadow-lg transition-all"
                >
                  Complete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}