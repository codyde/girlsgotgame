import React, { useState, useEffect } from 'react'
import { ArrowLeft, Clock, MapPin, Users, Trophy, MessageCircle, Send, Edit2, Save, X, Share, Plus, UserPlus, Star, Activity, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { Game, GameComment, GamePlayer, User, ManualPlayer, GameActivity } from '../types'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../hooks/useSocket'
import toast from 'react-hot-toast'

interface GameDetailsScreenProps {
  gameId: string
  onBack: () => void
}

export function GameDetailsScreen({ gameId, onBack }: GameDetailsScreenProps) {
  const { user, profile } = useAuth()
  const { socket, isConnected } = useSocket()
  const [game, setGame] = useState<Game | null>(null)
  const [comments, setComments] = useState<GameComment[]>([])
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [activities, setActivities] = useState<GameActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [isEditingScore, setIsEditingScore] = useState(false)
  const [editHomeScore, setEditHomeScore] = useState('')
  const [editAwayScore, setEditAwayScore] = useState('')
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')
  
  // Player management state
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<GamePlayer | null>(null)
  const [showActivities, setShowActivities] = useState(false)
  const [showLiveActivity, setShowLiveActivity] = useState(false)
  const [optimisticStats, setOptimisticStats] = useState<Record<string, { statType: string; value: number; timestamp: number }[]>>({})
  const [myChildren, setMyChildren] = useState<User[]>([])

  const isAdmin = user?.email === 'codydearkland@gmail.com'
  const isParent = profile?.role === 'parent'

  useEffect(() => {
    fetchGameDetails()
    if (isAdmin) {
      fetchAllUsers()
    }
    if (isParent) {
      fetchMyChildren()
    }
  }, [gameId, isAdmin, isParent])

  // Websocket listeners for live updates
  useEffect(() => {
    if (!socket || !isConnected) return

    // Listen for score updates
    const handleScoreUpdate = (data: any) => {
      if (data.gameId === gameId) {
        setGame(prev => prev ? {
          ...prev,
          homeScore: data.homeScore,
          awayScore: data.awayScore
        } : null)
        
        // Update the edit fields if they're being shown
        setEditHomeScore(data.homeScore.toString())
        setEditAwayScore(data.awayScore.toString())
        
        // Show a toast notification
        toast.success(`Score updated: ${data.homeScore}-${data.awayScore}`)
      }
    }

    // Listen for activity updates (stats added/removed)
    const handleActivityUpdate = (data: any) => {
      if (data.gameId === gameId) {
        // Add the new activity to the list
        setActivities(prev => [data.activity, ...prev])
        
        // If it's a stat being added/removed, refresh the players to get updated stats
        if (data.stat || data.statRemoved) {
          fetchGameDetails()
        }
      }
    }

    socket.on('game:score-updated', handleScoreUpdate)
    socket.on('game:activity-added', handleActivityUpdate)

    return () => {
      socket.off('game:score-updated', handleScoreUpdate)
      socket.off('game:activity-added', handleActivityUpdate)
    }
  }, [socket, isConnected, gameId])

  const fetchGameDetails = async () => {
    try {
      const [gameResponse, playersResponse, activitiesResponse] = await Promise.all([
        api.getGameDetails(gameId),
        api.getGamePlayers(gameId),
        api.getGameActivities(gameId)
      ])
      
      if (gameResponse.error) throw new Error(gameResponse.error)
      if (playersResponse.error) throw new Error(playersResponse.error)
      if (activitiesResponse.error) throw new Error(activitiesResponse.error)
      
      setGame(gameResponse.data.game)
      setComments(gameResponse.data.comments || [])
      setPlayers(playersResponse.data || [])
      setActivities(activitiesResponse.data || [])
      setEditHomeScore(gameResponse.data.game.homeScore?.toString() || '')
      setEditAwayScore(gameResponse.data.game.awayScore?.toString() || '')
      setEditStatus(gameResponse.data.game.status)
      setEditNotes(gameResponse.data.game.notes || '')
    } catch (error) {
      toast.error('Error loading game details: ' + (error instanceof Error ? error.message : String(error)))
      onBack()
    } finally {
      setLoading(false)
    }
  }

  const fetchAllUsers = async () => {
    try {
      const { data, error } = await api.getAllProfiles()
      if (error) throw new Error(error)
      setAllUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchMyChildren = async () => {
    try {
      const { data, error } = await api.getMyChildren()
      if (error) throw new Error(error)
      setMyChildren(data || [])
    } catch (error) {
      console.error('Error fetching children:', error)
    }
  }


  const addComment = async () => {
    if (!newComment.trim()) return

    try {
      const { data, error } = await api.addGameComment(gameId, newComment.trim())
      if (error) throw new Error(error)
      
      setComments(prev => [...prev, data])
      setNewComment('')
      toast.success('Comment added!')
    } catch (error) {
      toast.error('Error adding comment: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const saveScore = async () => {
    try {
      const homeScore = parseInt(editHomeScore) || 0
      const awayScore = parseInt(editAwayScore) || 0
      
      const { error } = await api.updateGameScore(gameId, homeScore, awayScore)
      if (error) throw new Error(error)
      
      setGame(prev => prev ? { ...prev, homeScore, awayScore } : null)
      setIsEditingScore(false)
      toast.success('Score updated!')
    } catch (error) {
      toast.error('Error updating score: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const saveStatus = async () => {
    try {
      const { data, error } = await api.updateGameStatus(gameId, editStatus, editNotes)
      if (error) throw new Error(error)
      
      setGame(prev => prev ? { ...prev, status: data.status, notes: data.notes } : null)
      setIsEditingStatus(false)
      toast.success('Game status updated!')
    } catch (error) {
      toast.error('Error updating status: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const shareToFeed = async () => {
    try {
      const { error } = await api.shareGameToFeed(gameId)
      if (error) throw new Error(error)
      
      setGame(prev => prev ? { ...prev, isSharedToFeed: true } : null)
      toast.success('Game shared to feed!')
    } catch (error) {
      toast.error('Error sharing to feed: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const addRegisteredPlayer = async () => {
    if (!selectedUserId) return
    
    try {
      const { error } = await api.addRegisteredPlayerToGame(gameId, selectedUserId)
      if (error) throw new Error(error)
      
      toast.success('Player added to game!')
      fetchGameDetails()
      setShowAddPlayer(false)
      setSelectedUserId('')
    } catch (error) {
      toast.error('Error adding player: ' + (error instanceof Error ? error.message : String(error)))
    }
  }


  const addPlayerStat = async (playerId: string, statType: string, value: number = 1) => {
    // Optimistic update
    const optimisticStat = {
      statType,
      value,
      timestamp: Date.now()
    }
    
    setOptimisticStats(prev => ({
      ...prev,
      [playerId]: [...(prev[playerId] || []), optimisticStat]
    }))
    
    try {
      const { error } = await api.addPlayerStat(gameId, playerId, statType, value)
      if (error) throw new Error(error)
      
      toast.success(`${statType.toUpperCase()} recorded!`)
      
      // Clear optimistic stat and refresh real data
      setOptimisticStats(prev => ({
        ...prev,
        [playerId]: (prev[playerId] || []).filter(s => s.timestamp !== optimisticStat.timestamp)
      }))
      
      fetchGameDetails()
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticStats(prev => ({
        ...prev,
        [playerId]: (prev[playerId] || []).filter(s => s.timestamp !== optimisticStat.timestamp)
      }))
      
      toast.error('Error adding stat: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const removePlayerStat = async (statId: string) => {
    try {
      const { error } = await api.removePlayerStat(gameId, statId)
      if (error) throw new Error(error)
      
      toast.success('Stat removed!')
      fetchGameDetails()
    } catch (error) {
      toast.error('Error removing stat: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const formatGameDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCommentTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatActivityTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) {
      return 'just now'
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes}m ago`
    } else {
      return date.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-red-100 text-red-700'
      case 'completed': return 'bg-green-100 text-green-700'
      default: return 'bg-blue-100 text-blue-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'live': return 'LIVE'
      case 'completed': return 'Final'
      default: return 'Upcoming'
    }
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl lg:text-4xl font-bold font-heading text-text-primary">Game Details</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl lg:text-4xl font-bold font-heading text-text-primary">Game Not Found</h1>
          </div>
        </div>
      </div>
    )
  }

  const isHomeTeam = game.isHome
  const homeTeamName = isHomeTeam ? game.teamName : game.opponentTeam
  const awayTeamName = isHomeTeam ? game.opponentTeam : game.teamName
  const isCompleted = game.homeScore !== null && game.awayScore !== null

  // Filter players based on user role
  const visiblePlayers = isParent 
    ? players.filter(player => {
        // For parents, only show their children
        const myChildIds = myChildren.map(child => child.id)
        
        // Check direct registered players
        if (player.userId && myChildIds.includes(player.userId)) {
          return true
        }
        
        // Check manual players linked to their children
        if (player.manualPlayer?.linkedUserId && myChildIds.includes(player.manualPlayer.linkedUserId)) {
          return true
        }
        
        return false
      })
    : players // Admins see all players

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl lg:text-4xl font-bold font-heading text-text-primary">Game Details</h1>
          </div>
          {isAdmin && !game.isSharedToFeed && (
            <button
              onClick={shareToFeed}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-body"
            >
              <Share className="w-4 h-4" />
              Share to Feed
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 pb-20 lg:pb-6 max-w-4xl lg:mx-auto space-y-6">
          
          {/* Game Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Status Badge */}
            <div className={`px-4 py-2 text-sm font-medium font-body ${getStatusColor(game.status)}`}>
              <div className="flex items-center justify-between">
                <span>{getStatusLabel(game.status)}</span>
                {isAdmin && (
                  <button
                    onClick={() => setIsEditingStatus(!isEditingStatus)}
                    className="text-xs hover:underline"
                  >
                    {isEditingStatus ? 'Cancel' : 'Edit'}
                  </button>
                )}
              </div>
            </div>

            <div className="p-6">
              {/* Date and Time */}
              <div className="flex items-center gap-2 text-sm text-gray-600 font-body mb-4">
                <Clock className="w-4 h-4" />
                <span>{formatGameDate(game.gameDate)}</span>
              </div>

              {/* Teams and Score */}
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center w-full max-w-2xl">
                  {/* Home Team */}
                  <div className="flex-1 text-center p-4 bg-gray-50 rounded-l-lg border-r">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500 font-body uppercase tracking-wide">Home</span>
                    </div>
                    <h3 className="text-lg font-bold font-heading text-gray-900 mb-2">
                      {homeTeamName}
                    </h3>
                    {isEditingScore && isAdmin ? (
                      <input
                        type="number"
                        value={editHomeScore}
                        onChange={(e) => setEditHomeScore(e.target.value)}
                        className="w-20 px-2 py-1 text-center text-2xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                      />
                    ) : (
                      <div className="text-3xl font-bold font-body text-gray-900">
                        {game.homeScore ?? '-'}
                      </div>
                    )}
                  </div>

                  {/* VS Separator */}
                  <div className="px-4 py-6 bg-white border-t border-b border-gray-200">
                    <div className="text-xl font-bold text-gray-400 font-body">VS</div>
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 text-center p-4 bg-gray-50 rounded-r-lg border-l">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500 font-body uppercase tracking-wide">Away</span>
                    </div>
                    <h3 className="text-lg font-bold font-heading text-gray-900 mb-2">
                      {awayTeamName}
                    </h3>
                    {isEditingScore && isAdmin ? (
                      <input
                        type="number"
                        value={editAwayScore}
                        onChange={(e) => setEditAwayScore(e.target.value)}
                        className="w-20 px-2 py-1 text-center text-2xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                      />
                    ) : (
                      <div className="text-3xl font-bold font-body text-gray-900">
                        {game.awayScore ?? '-'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin Score Controls */}
              {isAdmin && (
                <div className="flex justify-center gap-3 mb-4">
                  {isEditingScore ? (
                    <>
                      <button
                        onClick={saveScore}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-body"
                      >
                        <Save className="w-4 h-4" />
                        Save Score
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingScore(false)
                          setEditHomeScore(game.homeScore?.toString() || '')
                          setEditAwayScore(game.awayScore?.toString() || '')
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-body"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditingScore(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-body"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Score
                    </button>
                  )}
                </div>
              )}

              {/* Game Notes */}
              {(game.notes || isEditingStatus) && (
                <div className="border-t border-gray-100 pt-4">
                  {isEditingStatus && isAdmin ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium font-body text-gray-700 mb-1">Status</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="live">Live</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium font-body text-gray-700 mb-1">Notes</label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Add game notes..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={saveStatus}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-body"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingStatus(false)
                            setEditStatus(game.status)
                            setEditNotes(game.notes || '')
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-body"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <p className="text-gray-600 font-body">{game.notes}</p>
                      {isAdmin && (
                        <button
                          onClick={() => setIsEditingStatus(true)}
                          className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Live Game Activity Accordion */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setShowLiveActivity(!showLiveActivity)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-amber-500" />
                <div className="text-left">
                  <h3 className="text-lg font-semibold font-heading text-gray-900">Live Game Activity</h3>
                  <p className="text-sm font-body text-gray-600">Follow the action as it happens</p>
                </div>
                {activities.length > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">
                    {activities.length}
                  </span>
                )}
              </div>
              {showLiveActivity ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {showLiveActivity && (
              <div className="border-t border-gray-200 bg-gray-50">
                <div className="p-4">
                  {activities.length === 0 ? (
                    <div className="text-center py-8">
                      <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="font-body text-gray-500">Game activity will appear here as it happens</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {activities.slice(0, 20).map((activity, index) => (
                        <div 
                          key={activity.id} 
                          className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                            index === 0 ? 'bg-amber-50 border border-amber-200 animate-pulse' : 'bg-white border border-gray-100'
                          }`}
                        >
                          <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-gray-900 font-body font-medium">
                              {activity.description}
                            </p>
                            <p className="text-xs text-gray-500 font-body mt-1">
                              {formatActivityTime(activity.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {isConnected && (
                    <div className="mt-4 flex items-center gap-2 text-xs text-green-600 font-body">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span>Live updates active</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Players Section */}
          {(isAdmin || isParent) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary-600" />
                    <h3 className="text-lg font-semibold font-heading text-gray-900">Players</h3>
                    <span className="text-sm text-gray-500 font-body">({visiblePlayers.length})</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowActivities(!showActivities)}
                      className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-body"
                    >
                      <Activity className="w-4 h-4" />
                      Activity Log
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setShowAddPlayer(true)}
                        className="flex items-center gap-2 px-3 py-1 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-body"
                      >
                        <Plus className="w-4 h-4" />
                        Add Player
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Players List */}
              <div className="p-4">
                {visiblePlayers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="font-body text-gray-500">
                      {isParent ? "Your child is not in this game." : "No players added yet."}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {visiblePlayers.map((player) => {
                      const displayName = player.user?.name || player.manualPlayer?.name || 'Unknown Player'
                      const jerseyNumber = player.jerseyNumber || player.user?.jerseyNumber || player.manualPlayer?.jerseyNumber
                      const stats = player.stats || []
                      const playerOptimisticStats = optimisticStats[player.id] || []
                      
                      // Calculate stat totals including optimistic updates
                      const allStats = [...stats, ...playerOptimisticStats]
                      const points = allStats.filter(s => ['2pt', '3pt', '1pt'].includes(s.statType))
                        .reduce((sum, s) => sum + (s.statType === '3pt' ? 3 : s.statType === '2pt' ? 2 : 1), 0)
                      const steals = allStats.filter(s => s.statType === 'steal').length
                      const rebounds = allStats.filter(s => s.statType === 'rebound').length
                      
                      return (
                        <div key={player.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-bold text-primary-600">
                                  {jerseyNumber || displayName[0]?.toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <h4 className="font-medium font-body text-gray-900">{displayName}</h4>
                              </div>
                            </div>
                            {player.isStarter && (
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            )}
                          </div>
                          
                          {/* Stats Summary */}
                          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-lg font-bold text-gray-900">{points}</div>
                              <div className="text-xs text-gray-500">PTS</div>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-lg font-bold text-gray-900">{rebounds}</div>
                              <div className="text-xs text-gray-500">REB</div>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-lg font-bold text-gray-900">{steals}</div>
                              <div className="text-xs text-gray-500">STL</div>
                            </div>
                          </div>
                          
                          {/* Quick Add Stats */}
                          {/* Mobile layout: 2 rows (3 top, 2 bottom) with square buttons */}
                          <div className="md:hidden space-y-1">
                            {/* Top row - 3 buttons */}
                            <div className="grid grid-cols-3 gap-1">
                              <button
                                onClick={() => addPlayerStat(player.id, '2pt', 2)}
                                className="h-8 w-full flex items-center justify-center text-xs font-semibold bg-blue-100 text-blue-700 rounded hover:bg-blue-200 active:bg-blue-300 transition-colors font-body touch-manipulation"
                              >
                                2PT
                              </button>
                              <button
                                onClick={() => addPlayerStat(player.id, '3pt', 3)}
                                className="h-8 w-full flex items-center justify-center text-xs font-semibold bg-green-100 text-green-700 rounded hover:bg-green-200 active:bg-green-300 transition-colors font-body touch-manipulation"
                              >
                                3PT
                              </button>
                              <button
                                onClick={() => addPlayerStat(player.id, '1pt', 1)}
                                className="h-8 w-full flex items-center justify-center text-xs font-semibold bg-purple-100 text-purple-700 rounded hover:bg-purple-200 active:bg-purple-300 transition-colors font-body touch-manipulation"
                              >
                                FT
                              </button>
                            </div>
                            {/* Bottom row - 2 buttons */}
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                onClick={() => addPlayerStat(player.id, 'steal', 1)}
                                className="h-8 w-full flex items-center justify-center text-xs font-semibold bg-red-100 text-red-700 rounded hover:bg-red-200 active:bg-red-300 transition-colors font-body touch-manipulation"
                              >
                                STL
                              </button>
                              <button
                                onClick={() => addPlayerStat(player.id, 'rebound', 1)}
                                className="h-8 w-full flex items-center justify-center text-xs font-semibold bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 active:bg-yellow-300 transition-colors font-body touch-manipulation"
                              >
                                REB
                              </button>
                            </div>
                          </div>
                          
                          {/* Desktop layout: Single row with compact buttons */}
                          <div className="hidden md:grid grid-cols-5 gap-1">
                            <button
                              onClick={() => addPlayerStat(player.id, '2pt', 2)}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-body"
                            >
                              2PT
                            </button>
                            <button
                              onClick={() => addPlayerStat(player.id, '3pt', 3)}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors font-body"
                            >
                              3PT
                            </button>
                            <button
                              onClick={() => addPlayerStat(player.id, '1pt', 1)}
                              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors font-body"
                            >
                              FT
                            </button>
                            <button
                              onClick={() => addPlayerStat(player.id, 'steal', 1)}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors font-body"
                            >
                              STL
                            </button>
                            <button
                              onClick={() => addPlayerStat(player.id, 'rebound', 1)}
                              className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors font-body"
                            >
                              REB
                            </button>
                          </div>
                          
                          {/* Show detailed stats if any */}
                          {stats.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <button
                                onClick={() => setSelectedPlayer(selectedPlayer?.id === player.id ? null : player)}
                                className="text-xs text-primary-600 hover:underline"
                              >
                                {selectedPlayer?.id === player.id ? 'Hide' : 'View'} detailed stats ({stats.length})
                              </button>
                              
                              {selectedPlayer?.id === player.id && (
                                <div className="mt-2 space-y-1">
                                  {stats.map((stat) => (
                                    <div key={stat.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                                      <span>{stat.statType.toUpperCase()} (+{stat.value})</span>
                                      <button
                                        onClick={() => removePlayerStat(stat.id)}
                                        className="text-red-500 hover:text-red-700"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
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

              {/* Activity Log */}
              {showActivities && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <h4 className="font-medium font-body text-gray-900 mb-3">Recent Activity</h4>
                  {activities.length === 0 ? (
                    <p className="text-sm text-gray-500 font-body">No activity recorded yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {activities.slice(0, 10).map((activity) => (
                        <div key={activity.id} className="text-sm text-gray-600 font-body">
                          <span className="font-medium">{activity.performedByUser?.name || 'Admin'}</span>
                          {' '}{activity.description}
                          <span className="text-xs text-gray-400 ml-2">
                            {new Date(activity.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Add Player Modal */}
          {showAddPlayer && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:pl-4 pl-16">
              <div className="bg-white rounded-xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold font-heading">Add Player to Game</h3>
                  <button
                    onClick={() => {
                      setShowAddPlayer(false)
                      setSelectedUserId('')
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  {/* Registered Players */}
                  <div>
                    <label className="block text-sm font-medium font-body text-gray-700 mb-2">
                      Add Registered Player
                    </label>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                    >
                      <option value="">Select a player...</option>
                      {allUsers
                        .filter(u => u.role === 'player' && !players.some(p => p.userId === u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} {u.jerseyNumber ? `(#${u.jerseyNumber})` : ''}
                          </option>
                        ))}
                    </select>
                    {selectedUserId && (
                      <button
                        onClick={addRegisteredPlayer}
                        className="mt-2 w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-body"
                      >
                        Add Player
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5 text-primary-600" />
                <h3 className="text-lg font-semibold font-heading text-gray-900">Game Comments</h3>
                <span className="text-sm text-gray-500 font-body">({comments.length})</span>
              </div>
            </div>

            {/* Add Comment */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your thoughts about this game..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body resize-none"
                  />
                </div>
                <button
                  onClick={addComment}
                  disabled={!newComment.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-body flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Post
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="p-4">
              {comments.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-body text-gray-500">No comments yet. Be the first to share your thoughts!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium font-body text-primary-600">
                          {comment.user?.name?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium font-body text-gray-900">
                            {comment.user?.name || 'Unknown User'}
                          </span>
                          <span className="text-sm text-gray-500 font-body">
                            {formatCommentTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-gray-700 font-body">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}