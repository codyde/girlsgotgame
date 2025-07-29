import React, { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, Users, Trophy } from 'lucide-react'
import { Game } from '../types'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

interface GamesScreenProps {
  onGameClick?: (gameId: string) => void
}

export function GamesScreen({ onGameClick }: GamesScreenProps) {
  const { user } = useAuth()
  const [allGames, setAllGames] = useState<Game[]>([])
  const [myGames, setMyGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'my-games' | 'all-games'>('my-games')

  useEffect(() => {
    fetchAllData()
  }, [user])

  const fetchAllData = async () => {
    try {
      // Fetch both all games and my games in parallel
      const [allGamesResponse, myGamesResponse] = await Promise.all([
        api.getGames(),
        user ? api.getMyGames() : Promise.resolve({ data: [], error: null })
      ])

      if (allGamesResponse.error) throw new Error(allGamesResponse.error)
      if (myGamesResponse.error) throw new Error(myGamesResponse.error)

      // Sort games by date (soonest first)
      const sortedAllGames = (allGamesResponse.data || []).sort((a, b) => 
        new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime()
      )
      const sortedMyGames = (myGamesResponse.data || []).sort((a, b) => 
        new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime()
      )

      setAllGames(sortedAllGames)
      setMyGames(sortedMyGames)

      // If user has no games of their own, default to all games tab
      if (user && sortedMyGames.length === 0) {
        setActiveTab('all-games')
      }
    } catch (error) {
      toast.error('Error loading games: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-xl lg:text-4xl font-bold font-heading text-text-primary">Games</h1>
        </div>
        <p className="font-body text-text-secondary">Upcoming and recent game schedule</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 pb-20 lg:pb-6 max-w-4xl lg:mx-auto">
          {/* Tabs */}
          {user && (
            <div className="mb-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('my-games')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'my-games'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    My Games
                    {myGames.length > 0 && (
                      <span className="ml-2 bg-primary-100 text-primary-600 py-0.5 px-2 rounded-full text-xs font-medium">
                        {myGames.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('all-games')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'all-games'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    All Games
                    <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs font-medium">
                      {allGames.length}
                    </span>
                  </button>
                </nav>
              </div>
            </div>
          )}

          {(() => {
            const currentGames = user ? (activeTab === 'my-games' ? myGames : allGames) : allGames
            const emptyTitle = activeTab === 'my-games' ? 'No Games Played' : 'No Games Scheduled'
            const emptyMessage = activeTab === 'my-games' 
              ? 'You haven\'t played in any games yet. Games you participate in will appear here!'
              : 'Check back later for upcoming games!'

            return currentGames.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-bold font-heading text-gray-600 mb-2">{emptyTitle}</h2>
                <p className="font-body text-gray-500">{emptyMessage}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentGames.map((game) => {
                const status = getGameStatus(game)
                const winner = getWinner(game)
                const isHomeTeam = game.isHome
                const homeTeamName = isHomeTeam ? game.teamName : game.opponentTeam
                const awayTeamName = isHomeTeam ? game.opponentTeam : game.teamName
                
                return (
                  <div
                    key={game.id}
                    onClick={() => onGameClick?.(game.id)}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
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

                    <div className="p-6">
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
                  </div>
                )
                })}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}