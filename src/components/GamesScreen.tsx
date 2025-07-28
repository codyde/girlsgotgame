import React, { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, Users, Trophy, UserIcon, ChevronDown, ChevronUp, Star } from 'lucide-react'
import { Game, User, GameWithUserStats } from '../types'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

interface GamesScreenProps {
  onGameClick?: (gameId: string) => void
}

export function GamesScreen({ onGameClick }: GamesScreenProps) {
  const { user, profile } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState<User[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string>('')
  const [childGamesMap, setChildGamesMap] = useState<Map<string, Map<string, GameWithUserStats>>>(new Map())
  const [expandedGameStats, setExpandedGameStats] = useState<Set<string>>(new Set())
  const [loadingChildStats, setLoadingChildStats] = useState(false)

  const isParent = profile?.role === 'parent'
  const isVerified = profile?.isVerified === true

  useEffect(() => {
    fetchGames()
    if (isParent && isVerified) {
      fetchChildren()
    }
  }, [isParent, isVerified])

  const fetchGames = async () => {
    try {
      const { data, error } = await api.getGames()
      if (error) throw new Error(error)
      
      // Sort games by date (soonest first) - additional client-side sorting
      const sortedGames = (data || []).sort((a, b) => 
        new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime()
      )
      
      setGames(sortedGames)
    } catch (error) {
      toast.error('Error loading games: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }

  const fetchChildren = async () => {
    try {
      const { data, error } = await api.getMyChildren()
      if (error) throw new Error(error)
      
      const allChildren = data || []
      setChildren(allChildren)
      
      // Auto-select first child if available
      if (allChildren.length > 0 && !selectedChildId) {
        const firstChild = allChildren[0]
        setSelectedChildId(firstChild.id)
        fetchChildGameStats(firstChild.id)
      }
    } catch (error) {
      console.error('Error loading children:', error)
    }
  }

  const fetchChildGameStats = async (childId: string) => {
    setLoadingChildStats(true)
    try {
      const { data, error } = await api.getUserGames(childId)
      if (error) throw new Error(error)
      
      // Create a map of game ID to game with stats
      const gameStatsMap = new Map<string, GameWithUserStats>()
      data?.forEach((gameWithStats: GameWithUserStats) => {
        gameStatsMap.set(gameWithStats.id, gameWithStats)
      })
      
      // Update the child games map
      setChildGamesMap(prev => {
        const newMap = new Map(prev)
        newMap.set(childId, gameStatsMap)
        return newMap
      })
    } catch (error) {
      console.error('Error loading child game stats:', error)
    } finally {
      setLoadingChildStats(false)
    }
  }

  const handleChildChange = (childId: string) => {
    setSelectedChildId(childId)
    // Only fetch if we don't already have the data
    if (!childGamesMap.has(childId)) {
      fetchChildGameStats(childId)
    }
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

  const calculateGameStats = (stats: GameWithUserStats['stats']) => {
    const points = stats
      .filter(s => ['2pt', '3pt', '1pt'].includes(s.statType))
      .reduce((sum, s) => sum + (s.statType === '3pt' ? 3 : s.statType === '2pt' ? 2 : 1), 0)
    const steals = stats.filter(s => s.statType === 'steal').length
    const rebounds = stats.filter(s => s.statType === 'rebound').length
    
    return { points, steals, rebounds }
  }

  const formatGameDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isGameCompleted = (game: Game) => {
    return game.homeScore !== null && game.awayScore !== null
  }

  const getGameStatus = (game: Game) => {
    const gameDate = new Date(game.gameDate)
    const now = new Date()
    
    if (isGameCompleted(game)) {
      return 'completed'
    } else if (gameDate < now) {
      return 'in-progress'
    } else {
      return 'upcoming'
    }
  }

  const getWinner = (game: Game) => {
    if (!isGameCompleted(game)) return null
    
    const homeScore = game.homeScore!
    const awayScore = game.awayScore!
    
    if (homeScore > awayScore) {
      return 'home'
    } else if (awayScore > homeScore) {
      return 'away'
    } else {
      return 'tie'
    }
  }

  const selectedChild = children.find(c => c.id === selectedChildId)
  const selectedChildGames = selectedChildId ? childGamesMap.get(selectedChildId) : undefined

  if (loading) {
    return (
      <div className="p-4 lg:p-6 pb-20 lg:pb-0 max-w-4xl lg:mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="font-body text-gray-600">Loading games...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl lg:text-4xl font-bold font-heading text-text-primary">Games</h1>
        </div>
        <p className="font-body text-text-secondary">Upcoming and recent game schedule</p>
        
        {/* Child Selection for Parents */}
        {isParent && isVerified && children.length > 0 && (
          <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 font-body mb-2">
              View stats for:
            </label>
            <select
              value={selectedChildId}
              onChange={(e) => handleChildChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-body"
              disabled={loadingChildStats}
            >
              <option value="">Select a child...</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name || child.email.split('@')[0]}
                  {child.jerseyNumber ? ` (#${child.jerseyNumber})` : ''}
                  {child.accountType === 'manual' && ' (Historical)'}
                </option>
              ))}
            </select>
            
            {selectedChild && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 font-body">
                <UserIcon className="w-4 h-4" />
                <span>Showing stats for {selectedChild.name || selectedChild.email.split('@')[0]}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 pb-20 lg:pb-6 max-w-4xl lg:mx-auto">
          {games.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold font-heading text-gray-600 mb-2">No Games Scheduled</h2>
              <p className="font-body text-gray-500">Check back later for upcoming games!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {games.map((game) => {
                const status = getGameStatus(game)
                const winner = getWinner(game)
                const isHomeTeam = game.isHome
                const homeTeamName = isHomeTeam ? game.teamName : game.opponentTeam
                const awayTeamName = isHomeTeam ? game.opponentTeam : game.teamName
                
                // Get child's stats for this game if available
                const childGameStats = selectedChildGames?.get(game.id)
                const hasChildStats = childGameStats && childGameStats.stats.length > 0
                const isExpanded = expandedGameStats.has(game.id)
                
                return (
                  <div
                    key={game.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                  >
                    {/* Game Status Banner */}
                    <div className={`px-4 py-2 text-sm font-medium font-body ${
                      status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : status === 'in-progress'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {status === 'completed' ? 'Final' : status === 'in-progress' ? 'In Progress' : 'Upcoming'}
                    </div>

                    <div 
                      className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => onGameClick?.(game.id)}
                    >
                      {/* Date and Time */}
                      <div className="flex items-center gap-2 text-sm text-gray-600 font-body mb-4">
                        <Clock className="w-4 h-4" />
                        <span>{formatGameDate(game.gameDate)}</span>
                      </div>

                      {/* Teams and Score Card */}
                      <div className="flex items-center justify-center">
                        <div className="flex items-center w-full max-w-2xl">
                          {/* Home Team */}
                          <div className={`flex-1 text-center p-4 ${
                            winner === 'home' ? 'bg-green-50 border-2 border-green-200' : 'bg-gray-50'
                          } rounded-l-lg border-r`}>
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <MapPin className="w-4 h-4 text-gray-500" />
                              <span className="text-xs text-gray-500 font-body uppercase tracking-wide">Home</span>
                            </div>
                            <h3 className="text-lg font-bold font-heading text-gray-900 mb-1">
                              {homeTeamName}
                            </h3>
                            {isGameCompleted(game) && (
                              <div className="text-3xl font-bold font-body text-gray-900">
                                {game.homeScore}
                              </div>
                            )}
                          </div>

                          {/* VS or Score Separator */}
                          <div className="px-4 py-6 bg-white border-t border-b border-gray-200">
                            {isGameCompleted(game) ? (
                              <div className="text-center">
                                <div className="text-xs text-gray-500 font-body uppercase tracking-wide mb-1">Final</div>
                                {winner === 'tie' && (
                                  <div className="text-xs text-gray-600 font-body">Tie Game</div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xl font-bold text-gray-400 font-body">VS</div>
                            )}
                          </div>

                          {/* Away Team */}
                          <div className={`flex-1 text-center p-4 ${
                            winner === 'away' ? 'bg-green-50 border-2 border-green-200' : 'bg-gray-50'
                          } rounded-r-lg border-l`}>
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <Users className="w-4 h-4 text-gray-500" />
                              <span className="text-xs text-gray-500 font-body uppercase tracking-wide">Away</span>
                            </div>
                            <h3 className="text-lg font-bold font-heading text-gray-900 mb-1">
                              {awayTeamName}
                            </h3>
                            {isGameCompleted(game) && (
                              <div className="text-3xl font-bold font-body text-gray-900">
                                {game.awayScore}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Winner Badge */}
                      {winner && winner !== 'tie' && (
                        <div className="flex items-center justify-center mt-4">
                          <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium font-body">
                            <Trophy className="w-4 h-4" />
                            <span>
                              {winner === 'home' ? homeTeamName : awayTeamName} Wins!
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Child Stats Section (for parents) */}
                    {isParent && selectedChild && hasChildStats && (
                      <div className="border-t border-gray-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleGameStats(game.id)
                          }}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium text-gray-900 font-body">
                              {selectedChild.name || selectedChild.email.split('@')[0]}'s Stats
                            </h4>
                            {childGameStats.isStarter && (
                              <div className="flex items-center gap-1 text-xs text-blue-600 font-body">
                                <Star className="w-4 h-4 fill-current" />
                                <span>Starter</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Top Level Stats */}
                          <div className="flex items-center gap-4 mr-2">
                            {(() => {
                              const { points, rebounds, steals } = calculateGameStats(childGameStats.stats)
                              return (
                                <>
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
                                </>
                              )
                            })()}
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* Detailed Stats - Expandable */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 p-4 bg-gray-50">
                            <div className="space-y-1">
                              {childGameStats.stats.map((stat) => (
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
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}