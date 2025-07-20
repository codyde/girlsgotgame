import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Award, Target, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'
import toast from 'react-hot-toast'

export function LeaderboardScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'player') // Only show players, not parents
        .order('total_points', { ascending: false })
        .limit(20)

      if (error) throw error
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
      case 2: return 'from-orange-400 to-orange-600'
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
    <div className="pb-20 lg:pb-0">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-8 h-8" />
          <h1 className="text-2xl lg:text-3xl font-bold">Team Leaderboard</h1>
        </div>
        <p className="text-orange-100">See who's crushing their training goals!</p>
      </div>

      {/* Stats overview */}
      <div className="p-4 lg:p-6 bg-white border-b border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{profiles.length}</div>
            <div className="text-sm text-gray-600">Active Players</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {profiles.reduce((sum, p) => sum + p.total_points, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Points</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(profiles.reduce((sum, p) => sum + p.total_points, 0) / Math.max(profiles.length, 1))}
            </div>
            <div className="text-sm text-gray-600">Avg Points</div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="p-4 lg:p-6 space-y-3 lg:space-y-4 max-w-3xl lg:mx-auto">
        {profiles.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No rankings yet!</h3>
            <p className="text-gray-500">Start training to appear on the leaderboard</p>
          </div>
        ) : (
          profiles.map((profile, index) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative overflow-hidden rounded-xl shadow-sm border ${
                index < 3 ? 'border-orange-200' : 'border-gray-200'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${getRankColor(index)} opacity-10`}></div>
              <div className="relative bg-white p-4">
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 font-bold text-gray-700">
                    {getRankIcon(index) || `#${index + 1}`}
                  </div>

                  {/* Avatar */}
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
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
                    <h3 className="font-semibold text-gray-900">
                      {profile.name || profile.email.split('@')[0]}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Award className="w-4 h-4 text-orange-500" />
                      <span>{profile.total_points} points</span>
                    </div>
                  </div>

                  {/* Points badge */}
                  <div className={`px-3 py-1 rounded-full text-white font-semibold bg-gradient-to-r ${getRankColor(index)}`}>
                    {profile.total_points}
                  </div>
                </div>

                {/* Progress bar for top 3 */}
                {index < 3 && profiles[0]?.total_points > 0 && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full bg-gradient-to-r ${getRankColor(index)}`}
                        style={{
                          width: `${(profile.total_points / profiles[0].total_points) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Motivation footer */}
      <div className="p-4 mx-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-semibold text-green-800">Keep Training!</p>
            <p className="text-sm text-green-600">Every workout counts towards your team ranking</p>
          </div>
        </div>
      </div>
    </div>
  )
}