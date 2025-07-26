import React, { useState, useEffect } from 'react'
import { Play, Award, Clock, Star, Trophy, Search, TrendingUp } from 'lucide-react'
import { exerciseTemplates } from '../data/exercises'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { User } from '../types'
import toast from 'react-hot-toast'

export function TrainingScreen() {
  const { user, profile } = useAuth()
  const [selectedType, setSelectedType] = useState<'all' | 'dribbling' | 'shooting' | 'conditioning'>('all')
  const [activeWorkout, setActiveWorkout] = useState<typeof exerciseTemplates[0] | null>(null)
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [currentView, setCurrentView] = useState<'training' | 'leaderboard'>('training')
  const [profiles, setProfiles] = useState<User[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredExercises = selectedType === 'all' 
    ? exerciseTemplates 
    : exerciseTemplates.filter(ex => ex.type === selectedType)

  const filteredProfiles = profiles.filter(profile => 
    profile.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    if (currentView === 'leaderboard') {
      fetchLeaderboard()
    }
  }, [currentView])

  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true)
    try {
      const { data, error } = await api.getLeaderboard()
      if (error) throw new Error(error)
      setProfiles(data || [])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error('Error loading leaderboard: ' + errorMessage)
    } finally {
      setLeaderboardLoading(false)
    }
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return '🥇'
      case 1: return '🥈'
      case 2: return '🥉'
      default: return null
    }
  }

  const getRankColor = (index: number) => {
    switch (index) {
      case 0: return 'from-yellow-400 to-yellow-600'
      case 1: return 'from-gray-300 to-gray-500'
      case 2: return 'from-primary-400 to-primary-600'
      default: return 'from-gray-100 to-gray-200'
    }
  }

  const startWorkout = (exercise: typeof exerciseTemplates[0]) => {
    setActiveWorkout(exercise)
    setDuration('')
    setNotes('')
  }

  const completeWorkout = async () => {
    if (!user || !activeWorkout || !duration) return

    try {
      const durationNum = parseInt(duration)
      const pointsEarned = Math.floor(activeWorkout.basePoints * Math.min(durationNum / 10, 3)) // More time = more points (max 3x)

      const { error } = await api.createWorkout({
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error('Error saving workout: ' + errorMessage)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
        <div className="max-w-4xl lg:mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-primary-600" />
              <h1 className="text-3xl lg:text-4xl font-bold font-heading text-text-primary">
                {currentView === 'training' ? 'Training Programs' : 'Leaderboard'}
              </h1>
            </div>
            
            {/* View Toggle */}
            <div className="flex bg-bg-tertiary rounded-lg p-1">
              <button
                onClick={() => setCurrentView('training')}
                className={`px-3 py-2 rounded-md text-sm font-medium font-body transition-colors ${
                  currentView === 'training'
                    ? 'bg-primary-500 text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Training
              </button>
              <button
                onClick={() => setCurrentView('leaderboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium font-body transition-colors ${
                  currentView === 'leaderboard'
                    ? 'bg-primary-500 text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Leaderboard
              </button>
            </div>
          </div>
          
          {currentView === 'training' ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Award className="w-4 h-4 text-primary-500" />
              <span className="font-body">Total Points: <span className="font-bold text-primary-600">{profile?.totalPoints || 0}</span></span>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <p className="text-text-secondary font-body">See who's crushing their training goals!</p>
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search players..."
                  className="pl-10 pr-4 py-2 border border-border-secondary rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-body bg-bg-primary text-text-primary w-64"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 pb-20 lg:pb-6 max-w-4xl lg:mx-auto">

      {currentView === 'training' ? (
        <>
          {/* Filter buttons */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {['all', 'dribbling', 'shooting', 'conditioning'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type as 'all' | 'dribbling' | 'shooting' | 'conditioning')}
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
        {filteredExercises.map((exercise) => (
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
        </>
      ) : (
        /* Leaderboard View */
        <>
          {/* Stats overview */}
          <div className="p-4 lg:p-6 bg-bg-primary border border-border-primary rounded-xl mb-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold font-body text-primary-600">{filteredProfiles.length}</div>
                <div className="text-sm font-body text-text-secondary">Players Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-body text-secondary-600">
                  {filteredProfiles.reduce((sum, p) => sum + (p.totalPoints || 0), 0)}
                </div>
                <div className="text-sm font-body text-text-secondary">Total Points</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-body text-primary-600">
                  {Math.round(filteredProfiles.reduce((sum, p) => sum + (p.totalPoints || 0), 0) / Math.max(filteredProfiles.length, 1))}
                </div>
                <div className="text-sm font-body text-text-secondary">Avg Points</div>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          {leaderboardLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-20"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-lg font-semibold font-heading text-text-primary mb-2">
                {searchQuery ? 'No players found!' : 'No rankings yet!'}
              </h3>
              <p className="font-body text-text-secondary">
                {searchQuery ? 'Try adjusting your search query' : 'Start training to appear on the leaderboard'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 lg:space-y-4">
              {filteredProfiles.map((profile, index) => (
                <div
                  key={profile.id}
                  className={`relative overflow-hidden rounded-xl shadow-sm border ${
                    index < 3 ? 'border-orange-200' : 'border-gray-200'
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${getRankColor(index)} opacity-10`}></div>
                  <div className="relative bg-white p-4">
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 font-bold font-body text-gray-700">
                        {getRankIcon(index) || `#${index + 1}`}
                      </div>

                      {/* Avatar */}
                      {profile.avatarUrl ? (
                        <img
                          src={profile.avatarUrl}
                          alt="Profile"
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br ${getRankColor(index)}`}>
                          {profile.name?.[0]?.toUpperCase() || profile.email[0].toUpperCase()}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1">
                        <h3 className="font-semibold font-heading text-gray-900">
                          {profile.name || profile.email.split('@')[0]}
                        </h3>
                        <div className="flex items-center gap-2 text-sm font-body text-gray-600">
                          <Award className="w-4 h-4 text-orange-500" />
                          <span className="font-body">{profile.totalPoints || 0} points</span>
                        </div>
                      </div>

                      {/* Points badge */}
                      <div className={`px-3 py-1 rounded-full text-white font-semibold font-body bg-gradient-to-r ${getRankColor(index)}`}>
                        {profile.totalPoints || 0}
                      </div>
                    </div>

                    {/* Progress bar for top 3 */}
                    {index < 3 && (filteredProfiles[0]?.totalPoints || 0) > 0 && (
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full bg-gradient-to-r ${getRankColor(index)}`}
                            style={{
                              width: `${((profile.totalPoints || 0) / (filteredProfiles[0]?.totalPoints || 1)) * 100}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Motivation footer */}
          <div className="p-4 mx-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200 mt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-secondary-600" />
              <div>
                <p className="font-semibold font-heading text-secondary-700">Keep Training!</p>
                <p className="text-sm font-body text-secondary-600">Every workout counts towards your ranking</p>
              </div>
            </div>
          </div>
        </>
      )}

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