import React, { useState, useEffect } from 'react'
import { Trophy, Award, TrendingUp } from 'lucide-react'
import { api } from '../lib/api'
import { User } from '../types'
import toast from 'react-hot-toast'

export function LeaderboardScreen() {
  const [profiles, setProfiles] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    try {
      const { data, error } = await api.getLeaderboard()

      if (error) throw new Error(error)
      setProfiles(data || [])
    } catch (error: any) {
      toast.error('Error loading leaderboard: ' + error.message)
    } finally {
      setLoading(false)
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

  if (loading) {
    return (
      <div className="p-4 space-y-4">
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
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
        <div className="max-w-4xl lg:mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-primary-600" />
            <h1 className="text-xl lg:text-4xl font-bold font-heading text-text-primary">Team Leaderboard</h1>
          </div>
          <p className="text-text-secondary font-body">See who's crushing their training goals!</p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 pb-20 lg:pb-6 max-w-4xl lg:mx-auto">

      {/* Stats overview */}
      <div className="p-4 lg:p-6 bg-bg-primary border border-border-primary rounded-xl mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold font-body text-primary-600">{profiles.length}</div>
            <div className="text-sm font-body text-text-secondary">Active Players</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-body text-secondary-600">
              {profiles.reduce((sum, p) => sum + (p.totalPoints || 0), 0)}
            </div>
            <div className="text-sm font-body text-text-secondary">Total Points</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-body text-primary-600">
              {Math.round(profiles.reduce((sum, p) => sum + (p.totalPoints || 0), 0) / Math.max(profiles.length, 1))}
            </div>
            <div className="text-sm font-body text-text-secondary">Avg Points</div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="p-4 lg:p-6 space-y-3 lg:space-y-4 max-w-3xl lg:mx-auto">
        {profiles.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-lg font-semibold font-heading text-text-primary mb-2">No rankings yet!</h3>
            <p className="font-body text-text-secondary">Start training to appear on the leaderboard</p>
          </div>
        ) : (
          profiles.map((profile, index) => (
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
                {index < 3 && (profiles[0]?.totalPoints || 0) > 0 && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full bg-gradient-to-r ${getRankColor(index)}`}
                        style={{
                          width: `${((profile.totalPoints || 0) / (profiles[0]?.totalPoints || 1)) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Motivation footer */}
      <div className="p-4 mx-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-secondary-600" />
          <div>
            <p className="font-semibold font-heading text-secondary-700">Keep Training!</p>
            <p className="text-sm font-body text-secondary-600">Every workout counts towards your team ranking</p>
          </div>
        </div>
        </div>
      </div>
      </div>
    </div>
  )
}