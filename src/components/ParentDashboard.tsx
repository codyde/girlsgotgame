import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User as UserIcon, Trophy, Calendar, Target, Clock, Award, Shield, MapPin, Star, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { User, Workout, GameWithUserStats } from '../types'
import toast from 'react-hot-toast'

interface WorkoutWithUser extends Workout {
  user?: User
}

interface ManualPlayerWithGames {
  id: string
  name: string
  jerseyNumber: number | null
  notes: string | null
  linkedAt: string
  createdAt: string
  games: GameWithUserStats[]
}

export function ParentDashboard() {
  const { user, profile, updateProfile } = useAuth()
  const [children, setChildren] = useState<User[]>([])
  const [manualPlayers, setManualPlayers] = useState<ManualPlayerWithGames[]>([])
  const [totalChildrenCount, setTotalChildrenCount] = useState<number>(0)
  const [childWorkouts, setChildWorkouts] = useState<WorkoutWithUser[]>([])
  const [childGames, setChildGames] = useState<GameWithUserStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChild, setSelectedChild] = useState<string>('')
  const [selectedType, setSelectedType] = useState<'registered' | 'manual'>('registered')
  const [expandedGameStats, setExpandedGameStats] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchMyChildren()
  }, [user])

  const fetchMyChildren = async () => {
    try {
      // 🎯 UNIFIED SYSTEM: Fetch ALL children (registered + manual) in one API call
      const childrenResponse = await api.getMyChildren()

      if (childrenResponse.error) throw new Error(childrenResponse.error)
      
      const allChildren = childrenResponse.data || []
      
      // Separate children by account type for backwards compatibility
      const registeredChildren = allChildren.filter(child => child.accountType === 'registered')
      const manualChildren = allChildren.filter(child => child.accountType === 'manual')
      
      setChildren(registeredChildren)
      setManualPlayers(manualChildren.map(child => ({
        id: child.id,
        name: child.name,
        jerseyNumber: child.jerseyNumber,
        notes: null,
        linkedAt: child.createdAt,
        createdAt: child.createdAt,
        games: [] // Will be populated when selected
      })))
      
      // Store total children count for UI logic
      setTotalChildrenCount(allChildren.length)
      
      // Debug logging
      console.log('🏀 Parent Dashboard Debug - Unified fetch:', {
        totalChildren: allChildren.length,
        registeredChildren: registeredChildren.length,
        manualChildren: manualChildren.length,
        allChildrenData: allChildren
      })
      
      // Auto-select first available child
      if (allChildren.length > 0 && !selectedChild) {
        const firstChild = allChildren[0]
        setSelectedChild(firstChild.id)
        setSelectedType(firstChild.accountType === 'manual' ? 'manual' : 'registered')
        
        if (firstChild.accountType === 'manual') {
          fetchManualPlayerData(firstChild.id)
        } else {
          fetchChildData(firstChild.id)
        }
      }
    } catch (error: unknown) {
      toast.error('Error loading children: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }

  const fetchChildData = async (childId: string) => {
    try {
      // Fetch workouts and games in parallel
      const [workoutsResponse, gamesResponse] = await Promise.all([
        api.getWorkoutsByUserId(childId, 20, 0),
        api.getUserGames(childId)
      ])

      if (workoutsResponse.error) throw new Error(workoutsResponse.error)
      if (gamesResponse.error) throw new Error(gamesResponse.error)
      
      setChildWorkouts(workoutsResponse.data || [])
      setChildGames(gamesResponse.data || [])
    } catch (error: unknown) {
      toast.error('Error loading child data: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const fetchManualPlayerData = async (manualPlayerId: string) => {
    try {
      // 🎯 UNIFIED SYSTEM: Use the same getUserGames API for manual players
      const gamesResponse = await api.getUserGames(manualPlayerId)
      
      if (gamesResponse.error) throw new Error(gamesResponse.error)
      
      console.log('🏀 Parent Dashboard Debug - Manual player unified data:', {
        manualPlayerId,
        gamesCount: gamesResponse.data?.length || 0,
        games: gamesResponse.data
      })
      
      setChildGames(gamesResponse.data || [])
      setChildWorkouts([]) // Manual players don't have workouts
    } catch (error: unknown) {
      toast.error('Error loading manual player data: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const selectChild = async (childId: string, type: 'registered' | 'manual') => {
    setSelectedChild(childId)
    setSelectedType(type)
    if (type === 'registered') {
      fetchChildData(childId)
    } else {
      fetchManualPlayerData(childId)
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

  const formatGameTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateGameStats = (stats: GameWithUserStats['stats']) => {
    const points = stats
      .filter(s => ['2pt', '3pt', '1pt'].includes(s.statType))
      .reduce((sum, s) => sum + (s.statType === '3pt' ? 3 : s.statType === '2pt' ? 2 : 1), 0)
    const steals = stats.filter(s => s.statType === 'steal').length
    const rebounds = stats.filter(s => s.statType === 'rebound').length
    
    return { points, steals, rebounds }
  }

  const toggleGameStats = (gameId: string) => {
    setExpandedGameStats(prev => {
      const newSet = new Set(prev)
      if (newSet.has(gameId)) {
        newSet.delete(gameId)
      } else {
        newSet.add(gameId)
      }
      return newSet
    })
  }

  const selectedChildProfile = selectedType === 'registered' 
    ? children.find(p => p.id === selectedChild)
    : null
  const selectedManualPlayer = selectedType === 'manual'
    ? manualPlayers.find(mp => mp.id === selectedChild)
    : null

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
          
          {totalChildrenCount === 0 ? (
            <div className="text-center py-6">
              <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-body">No children assigned to your account yet.</p>
              <p className="text-sm text-gray-400 font-body mt-1">Contact an admin to link your children to your parent account.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <select
                value={selectedChild ? `${selectedType}:${selectedChild}` : ''}
                onChange={(e) => {
                  const [type, childId] = e.target.value.split(':')
                  if (childId && (type === 'registered' || type === 'manual')) {
                    selectChild(childId, type as 'registered' | 'manual')
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-body"
              >
                <option value="">Select a child...</option>
                {children.length > 0 && (
                  <optgroup label="Registered Children">
                    {children.map((child) => (
                      <option key={child.id} value={`registered:${child.id}`}>
                        {child.name || child.email.split('@')[0]} ({child.totalPoints || 0} points)
                      </option>
                    ))}
                  </optgroup>
                )}
                {manualPlayers.length > 0 && (
                  <optgroup label="Manual Players (Historical Data)">
                    {manualPlayers.map((player) => (
                      <option key={player.id} value={`manual:${player.id}`}>
                        {player.name} {player.jerseyNumber ? `(#${player.jerseyNumber})` : ''} - {player.games.length} games
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}
            
            {(selectedChildProfile || selectedManualPlayer) && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200 mt-3">
                {selectedChildProfile?.avatarUrl ? (
                  <img
                    src={selectedChildProfile.avatarUrl}
                    alt="Child"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                    {selectedChildProfile ? 
                      (selectedChildProfile.name?.[0]?.toUpperCase() || selectedChildProfile.email[0].toUpperCase()) :
                      selectedManualPlayer?.name?.[0]?.toUpperCase() || '?'
                    }
                  </div>
                )}
                <div>
                  <p className="font-semibold font-body text-green-800">
                    Currently viewing: {selectedChildProfile ? 
                      (selectedChildProfile.name || selectedChildProfile.email.split('@')[0]) :
                      selectedManualPlayer?.name || 'Unknown'
                    }
                    {selectedType === 'manual' && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Historical Data</span>
                    )}
                  </p>
                  <p className="text-sm font-body text-green-600">
                    {selectedChildProfile ? 
                      `${selectedChildProfile.totalPoints || 0} total points` :
                      `${selectedManualPlayer?.games.length || 0} games played`
                    }
                  </p>
                </div>
              </div>
            )}
        </div>

        {/* Child Stats */}
        {(selectedChildProfile || selectedManualPlayer) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-primary-500" />
                <div>
                  <div className="text-2xl font-bold font-body text-gray-900">
                    {selectedChildProfile ? (selectedChildProfile.totalPoints || 0) : 'N/A'}
                  </div>
                  <div className="text-sm font-body text-gray-600">
                    {selectedChildProfile ? 'Total Points' : 'Training Points (Historical Only)'}
                  </div>
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
                  <div className="text-2xl font-bold font-body text-gray-900">{childGames.length}</div>
                  <div className="text-sm font-body text-gray-600">Games Played</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold font-body text-gray-900">
                    {childGames.reduce((total, game) => {
                      return total + calculateGameStats(game.stats).points
                    }, 0)}
                  </div>
                  <div className="text-sm font-body text-gray-600">Game Points</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Games */}
        {selectedChild && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold font-heading text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                Recent Games
              </h3>
            </div>
            
            {childGames.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="font-body text-gray-500">No games played yet</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {childGames.slice(0, 5).map((game, index) => {
                  const isHomeGame = game.isHome
                  const homeTeamName = isHomeGame ? game.teamName : game.opponentTeam
                  const awayTeamName = isHomeGame ? game.opponentTeam : game.teamName
                  const isCompleted = game.homeScore !== null && game.awayScore !== null
                  const { points, steals, rebounds } = calculateGameStats(game.stats)
                  const isExpanded = expandedGameStats.has(game.id)
                  
                  return (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-gray-50 rounded-xl border border-gray-200 p-4"
                    >
                      {/* Game Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700 font-body">
                            {formatGameTime(game.gameDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCompleted && (
                            <Trophy className="w-4 h-4 text-yellow-500" />
                          )}
                          {game.isStarter && (
                            <Star className="w-4 h-4 text-blue-500 fill-current" />
                          )}
                          <span className={`px-2 py-1 text-xs font-medium rounded-full font-body ${
                            isCompleted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {isCompleted ? 'Final' : 'Scheduled'}
                          </span>
                        </div>
                      </div>

                      {/* Teams and Score */}
                      <div className="flex items-center justify-center mb-4">
                        <div className="flex items-center w-full max-w-md">
                          {/* Home Team */}
                          <div className="flex-1 text-center">
                            <div className="font-bold text-lg text-gray-900 mb-1 font-heading">
                              {homeTeamName}
                            </div>
                            {isCompleted && (
                              <div className="text-2xl font-bold text-primary-600 font-body">
                                {game.homeScore}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 uppercase tracking-wide font-body">
                              Home
                            </div>
                          </div>

                          {/* VS */}
                          <div className="px-4">
                            <div className="text-lg font-bold text-gray-400 font-body">VS</div>
                          </div>

                          {/* Away Team */}
                          <div className="flex-1 text-center">
                            <div className="font-bold text-lg text-gray-900 mb-1 font-heading">
                              {awayTeamName}
                            </div>
                            {isCompleted && (
                              <div className="text-2xl font-bold text-primary-600 font-body">
                                {game.awayScore}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 uppercase tracking-wide font-body">
                              Away
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Game Info */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-sm text-gray-600 font-body">
                            <MapPin className="w-4 h-4" />
                            <span>{isHomeGame ? 'Home Game' : 'Away Game'}</span>
                          </div>
                          
                          {game.jerseyNumber && (
                            <div className="text-sm text-gray-600 font-body">
                              Jersey #{game.jerseyNumber}
                            </div>
                          )}
                        </div>

                        {/* Manual Player Entry Information */}
                        {game.participationType && game.participationType !== 'direct' && (
                          <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                            <UserIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <div className="text-xs text-blue-700 font-body">
                              {game.participationType === 'manual' ? (
                                <>
                                  Historical game data linked from manual entry: <span className="font-semibold">{game.manualPlayerName}</span>
                                  {game.manualPlayerJerseyNumber && (
                                    <span> (#{game.manualPlayerJerseyNumber})</span>
                                  )}
                                </>
                              ) : game.participationType === 'mixed' ? (
                                <>
                                  Includes both direct participation and historical data from manual entry: <span className="font-semibold">{game.manualPlayerName}</span>
                                  {game.manualPlayerJerseyNumber && (
                                    <span> (#{game.manualPlayerJerseyNumber})</span>
                                  )}
                                </>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Player Stats - Accordion */}
                      <div className="bg-white rounded-lg border border-gray-100">
                        {/* Stats Header - Always Visible */}
                        <button
                          onClick={() => toggleGameStats(game.id)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium text-gray-900 font-body">
                              {selectedChildProfile?.name || selectedManualPlayer?.name || 'Player'}'s Stats
                            </h4>
                            <span className="text-xs text-gray-500 font-body">
                              {game.stats.length} stat{game.stats.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          {/* Top Level Stats - Always Visible */}
                          <div className="flex items-center gap-4 mr-2">
                            <div className="text-center">
                              <div className="text-lg font-bold text-blue-600 font-body">{points}</div>
                              <div className="text-xs text-gray-500 uppercase tracking-wide font-body">PTS</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-600 font-body">{rebounds}</div>
                              <div className="text-xs text-gray-500 uppercase tracking-wide font-body">REB</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-red-600 font-body">{steals}</div>
                              <div className="text-xs text-gray-500 uppercase tracking-wide font-body">STL</div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* Detailed Stats - Expandable */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 p-4">
                            {game.stats.length === 0 ? (
                              <p className="text-sm text-gray-500 font-body italic">No stats recorded</p>
                            ) : (
                              <div className="space-y-1">
                                {game.stats.map((stat) => (
                                  <div key={stat.id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-600 font-body">
                                        {stat.statType.toUpperCase()} 
                                        {stat.quarter && ` (Q${stat.quarter})`}
                                        {stat.timeMinute && ` ${stat.timeMinute}:00`}
                                      </span>
                                      {stat.source && stat.source === 'manual' && (
                                        <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded font-body">
                                          Historical
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-gray-900 font-semibold font-body">
                                      +{stat.statType === '3pt' ? 3 : stat.statType === '2pt' ? 2 : stat.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Recent Training Sessions - Only for registered children */}
        {selectedChild && selectedType === 'registered' && (
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