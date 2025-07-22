import React, { useState } from 'react'
import { Play, Award, Clock, Star, Trophy } from 'lucide-react'
import { exerciseTemplates } from '../data/exercises'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
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

      const { data, error } = await api.createWorkout({
        exerciseType: activeWorkout.type,
        pointsEarned: pointsEarned,
        durationMinutes: durationNum,
        notes: notes || null
      })

      if (error) throw new Error(error)

      toast.success(`Workout completed! +${pointsEarned} points!`)
      setActiveWorkout(null)
      setDuration('')
      setNotes('')
    } catch (error: any) {
      toast.error('Error saving workout: ' + error.message)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
        <div className="max-w-4xl lg:mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl lg:text-4xl font-bold font-heading text-text-primary">Training Programs</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Award className="w-4 h-4 text-primary-500" />
            <span className="font-body">Total Points: <span className="font-bold text-primary-600">{profile?.totalPoints || 0}</span></span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 pb-20 lg:pb-6 max-w-4xl lg:mx-auto">

      {/* Filter buttons */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['all', 'dribbling', 'shooting', 'conditioning'].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium font-body whitespace-nowrap transition-colors ${
              selectedType === type
                ? 'bg-primary-500 text-white'
                : 'bg-bg-tertiary text-text-secondary hover:bg-secondary-100'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Exercise cards */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
        {filteredExercises.map((exercise, index) => (
          <div
            key={exercise.name}
            className="bg-bg-primary rounded-xl shadow-sm border border-border-primary p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{exercise.icon}</div>
                <div>
                  <h3 className="font-semibold font-heading text-text-primary">{exercise.name}</h3>
                  <p className="text-sm font-body text-text-secondary">{exercise.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-primary-600">
                <Star className="w-4 h-4" />
                <span className="font-semibold font-body">{exercise.basePoints}</span>
              </div>
            </div>
            
            <button
              onClick={() => startWorkout(exercise)}
              className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-2 rounded-lg font-medium font-body flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Play className="w-4 h-4" />
              Start Training
            </button>
          </div>
        ))}
      </div>

      {/* Workout modal */}
      {activeWorkout && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        >
          <div
            className="bg-bg-primary rounded-2xl p-6 w-full max-w-md"
          >
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">{activeWorkout.icon}</div>
                <h3 className="text-xl font-bold font-heading text-text-primary">{activeWorkout.name}</h3>
                <p className="font-body text-text-secondary">{activeWorkout.description}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium font-body text-text-secondary mb-2">
                    Duration (minutes)
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary w-4 h-4" />
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="15"
                      className="w-full pl-10 pr-4 py-2 border border-border-secondary rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-body bg-bg-primary text-text-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium font-body text-text-secondary mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="How did it go? Any observations..."
                    className="w-full p-3 border border-border-secondary rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none font-body bg-bg-primary text-text-primary"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setActiveWorkout(null)}
                  className="flex-1 bg-bg-tertiary text-text-secondary py-3 rounded-lg font-medium font-body hover:bg-secondary-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={completeWorkout}
                  disabled={!duration}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg font-medium font-body disabled:opacity-50 hover:shadow-lg transition-all"
                >
                  Complete
                </button>
              </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  )
}