import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Shield, Trash2, User as UserIcon, Trophy, AlertTriangle, Users, Edit2, MessageCircle, Plus, X, Calendar, Share, Flag, CheckCircle, XCircle, Play } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { User, Workout, TeamWithMemberCount, TeamMember, Game } from '../types'
import toast from 'react-hot-toast'

interface WorkoutWithUser extends Workout {
  user?: User
}

interface AdminScreenProps {
  onGameClick?: (gameId: string) => void
}

export function AdminScreen({ onGameClick }: AdminScreenProps) {
  const { profile } = useAuth()
  const [workouts, setWorkouts] = useState<WorkoutWithUser[]>([])
  const [profiles, setProfiles] = useState<User[]>([])
  const [parentChildRelations, setParentChildRelations] = useState<{parent: User, child: User | null}[]>([])
  const [parentChildRelationships, setParentChildRelationships] = useState<any[]>([])
  const [teams, setTeams] = useState<TeamWithMemberCount[]>([])
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<TeamMember[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [currentTab, setCurrentTab] = useState<'workouts' | 'relations' | 'teams' | 'games' | 'unverified' | 'reports'>('workouts')
  const [reports, setReports] = useState<any[]>([])
  const [reportFilter, setReportFilter] = useState<'pending' | 'resolved' | 'dismissed' | 'all'>('pending')
  const [editingRelation, setEditingRelation] = useState<string | null>(null)
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')
  const [showAddRelationship, setShowAddRelationship] = useState(false)
  const [selectedParent, setSelectedParent] = useState('')
  const [selectedChild, setSelectedChild] = useState('')
  const [showCreateGame, setShowCreateGame] = useState(false)
  const [newGameTeamName, setNewGameTeamName] = useState('')
  const [newGameIsHome, setNewGameIsHome] = useState(true)
  const [newGameOpponent, setNewGameOpponent] = useState('')
  const [newGameDate, setNewGameDate] = useState(new Date().toISOString().split('T')[0])
  const [newGameTime, setNewGameTime] = useState('18:00')
  const [editingGameTime, setEditingGameTime] = useState<string | null>(null)
  const [editGameDate, setEditGameDate] = useState('')
  const [editGameTime, setEditGameTime] = useState('')
  const fetchingData = useRef(false)

  // Check if user is admin
  const isAdmin = profile?.email === 'codydearkland@gmail.com'

  const fetchData = useCallback(async () => {
    if (fetchingData.current) return // Prevent duplicate calls
    
    fetchingData.current = true
    try {
      // Fetch all workouts with user profiles
      const { data: workoutData, error: workoutError } = await api.getAllWorkouts()
      if (workoutError) throw new Error(workoutError)

      // Fetch all profiles
      const { data: profileData, error: profileError } = await api.getAllProfiles()
      if (profileError) throw new Error(profileError)

      // Fetch parent-child relationships
      const { data: relationData, error: relationError } = await api.getParentChildRelations()
      if (relationError) throw new Error(relationError)

      // Fetch new multi-child relationships
      const { data: relationshipData, error: relationshipError } = await api.getParentChildRelationships()
      if (relationshipError) throw new Error(relationshipError)

      // Fetch teams
      const { data: teamData, error: teamError } = await api.getAllTeamsAdmin()
      if (teamError) throw new Error(teamError)

      // Fetch games
      const { data: gameData, error: gameError } = await api.getGames()
      if (gameError) throw new Error(gameError)

      // Sort games by date (soonest first) - additional client-side sorting
      const sortedGames = (gameData || []).sort((a, b) => 
        new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime()
      )

      setWorkouts(workoutData || [])
      setProfiles(profileData || [])
      setParentChildRelations(relationData || [])
      setParentChildRelationships(relationshipData || [])
      setTeams(teamData || [])
      setGames(sortedGames)
    } catch (error: unknown) {
      toast.error('Error loading admin data: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
      fetchingData.current = false
    }
  }, [])

  // Targeted refresh functions to avoid full data reload
  const refreshWorkouts = useCallback(async () => {
    try {
      const { data: workoutData, error: workoutError } = await api.getAllWorkouts()
      if (workoutError) throw new Error(workoutError)
      setWorkouts(workoutData || [])
    } catch (error) {
      console.error('Error refreshing workouts:', error)
    }
  }, [])

  const refreshRelations = useCallback(async () => {
    try {
      const { data: relationData, error: relationError } = await api.getParentChildRelations()
      if (relationError) throw new Error(relationError)
      setParentChildRelations(relationData || [])
    } catch (error) {
      console.error('Error refreshing relations:', error)
    }
  }, [])

  const refreshRelationships = useCallback(async () => {
    try {
      const { data: relationshipData, error: relationshipError } = await api.getParentChildRelationships()
      if (relationshipError) throw new Error(relationshipError)
      setParentChildRelationships(relationshipData || [])
    } catch (error) {
      console.error('Error refreshing relationships:', error)
    }
  }, [])

  const refreshTeams = useCallback(async () => {
    try {
      const { data: teamData, error: teamError } = await api.getAllTeamsAdmin()
      if (teamError) throw new Error(teamError)
      setTeams(teamData || [])
    } catch (error) {
      console.error('Error refreshing teams:', error)
    }
  }, [])

  const refreshGames = useCallback(async () => {
    try {
      const { data: gameData, error: gameError } = await api.getGames()
      if (gameError) throw new Error(gameError)
      
      // Sort games by date (soonest first) - additional client-side sorting
      const sortedGames = (gameData || []).sort((a, b) => 
        new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime()
      )
      
      setGames(sortedGames)
    } catch (error) {
      console.error('Error refreshing games:', error)
    }
  }, [])

  const loadReports = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (reportFilter !== 'all') {
        params.append('status', reportFilter)
      }
      params.append('limit', '100')
      
      const response = await api.request(`/reports?${params.toString()}`)
      if (response.error) {
        throw new Error(response.error)
      }
      setReports(response.data || [])
    } catch (error) {
      console.error('Error loading reports:', error)
      toast.error('Failed to load reports')
    }
  }, [reportFilter])

  useEffect(() => {
    if (isAdmin) {
      fetchData()
    }
  }, [isAdmin, fetchData])

  useEffect(() => {
    if (isAdmin && currentTab === 'reports') {
      loadReports()
    }
  }, [isAdmin, currentTab, loadReports])

  const deleteWorkout = async (workoutId: string, pointsToDeduct: number, userId: string) => {
    try {
      // Use the existing delete workout API endpoint which handles point adjustment
      const { error } = await api.deleteWorkout(workoutId)
      if (error) throw new Error(error)

      toast.success('Workout deleted and points adjusted')
      refreshWorkouts() // Only refresh workouts
    } catch (error: unknown) {
      toast.error('Error deleting workout: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const updateChildAssignment = async (parentId: string, childId: string | null) => {
    try {
      const { error } = await api.updateChildAssignment(parentId, childId)
      if (error) throw new Error(error)

      toast.success('Child assignment updated!')
      refreshRelations() // Only refresh relations
      setEditingRelation(null)
    } catch (error: unknown) {
      toast.error('Error updating assignment: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const createTeam = async () => {
    if (!newTeamName.trim()) {
      toast.error('Team name is required')
      return
    }

    try {
      const { error } = await api.createTeam(newTeamName.trim(), newTeamDescription.trim() || undefined)
      if (error) throw new Error(error)
      
      toast.success('Team created successfully')
      setShowCreateTeam(false)
      setNewTeamName('')
      setNewTeamDescription('')
      refreshTeams() // Only refresh teams
    } catch (error: unknown) {
      toast.error('Error creating team: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const deleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete the team "${teamName}"? This will remove all members and delete all chat messages.`)) {
      return
    }

    try {
      const { error } = await api.deleteTeam(teamId)
      if (error) throw new Error(error)
      
      toast.success('Team deleted successfully')
      setSelectedTeam(null)
      setSelectedTeamMembers([])
      refreshTeams() // Only refresh teams
    } catch (error: unknown) {
      toast.error('Error deleting team: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const loadTeamMembers = async (teamId: string) => {
    try {
      const { data, error } = await api.getTeamMembers(teamId)
      if (error) throw new Error(error)
      
      setSelectedTeamMembers(data || [])
      setSelectedTeam(teamId)
    } catch (error: unknown) {
      toast.error('Error loading team members: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const addParentChildRelationship = async () => {
    if (!selectedParent || !selectedChild) {
      toast.error('Please select both parent and child')
      return
    }

    try {
      const { error } = await api.addParentChildRelationship(selectedParent, selectedChild)
      if (error) throw new Error(error)

      toast.success('Parent-child relationship added!')
      setShowAddRelationship(false)
      setSelectedParent('')
      setSelectedChild('')
      refreshRelationships()
    } catch (error: unknown) {
      toast.error('Error adding relationship: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const removeParentChildRelationship = async (relationId: string) => {
    if (!confirm('Are you sure you want to remove this parent-child relationship?')) {
      return
    }

    try {
      const { error } = await api.removeParentChildRelationship(relationId)
      if (error) throw new Error(error)

      toast.success('Relationship removed!')
      refreshRelationships()
    } catch (error: unknown) {
      toast.error('Error removing relationship: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const addTeamMember = async (teamId: string, userId: string) => {
    try {
      const { error } = await api.addTeamMember(teamId, userId)
      if (error) throw new Error(error)
      
      toast.success('Player added to team')
      loadTeamMembers(teamId) // Refresh team members
      refreshTeams() // Only refresh team counts
    } catch (error: unknown) {
      toast.error('Error adding team member: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const removeTeamMember = async (teamId: string, memberId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from this team?`)) {
      return
    }

    try {
      const { error } = await api.removeTeamMember(teamId, memberId)
      if (error) throw new Error(error)
      
      toast.success('Player removed from team')
      loadTeamMembers(teamId) // Refresh team members
      refreshTeams() // Only refresh team counts
    } catch (error: unknown) {
      toast.error('Error removing team member: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const createGame = async () => {
    if (!newGameTeamName.trim() || !newGameOpponent.trim()) {
      toast.error('Team name and opponent are required')
      return
    }

    try {
      const gameDateTime = new Date(`${newGameDate}T${newGameTime}:00`).toISOString()
      const { error } = await api.createGame(
        newGameTeamName.trim(),
        newGameIsHome,
        newGameOpponent.trim(),
        gameDateTime
      )
      if (error) throw new Error(error)
      
      toast.success('Game created successfully')
      setShowCreateGame(false)
      setNewGameTeamName('')
      setNewGameOpponent('')
      setNewGameDate(new Date().toISOString().split('T')[0])
      setNewGameTime('18:00')
      setNewGameIsHome(true)
      refreshGames()
    } catch (error: unknown) {
      toast.error('Error creating game: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const updateGameScore = async (gameId: string, homeScore: number, awayScore: number) => {
    try {
      const { error } = await api.updateGameScore(gameId, homeScore, awayScore)
      if (error) throw new Error(error)
      
      toast.success('Game score updated')
      refreshGames()
    } catch (error: unknown) {
      toast.error('Error updating score: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const deleteGame = async (gameId: string, teamName: string, opponent: string) => {
    if (!confirm(`Are you sure you want to delete the game between ${teamName} and ${opponent}?`)) {
      return
    }

    try {
      const { error } = await api.deleteGame(gameId)
      if (error) throw new Error(error)
      
      toast.success('Game deleted successfully')
      refreshGames()
    } catch (error: unknown) {
      toast.error('Error deleting game: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const shareGameToFeed = async (gameId: string) => {
    try {
      const { error } = await api.shareGameToFeed(gameId)
      if (error) throw new Error(error)
      
      toast.success('Game shared to feed!')
      refreshGames()
    } catch (error: unknown) {
      toast.error('Error sharing to feed: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const startEditingGameTime = (gameId: string, currentDateTime: string) => {
    const date = new Date(currentDateTime)
    setEditGameDate(date.toISOString().split('T')[0])
    setEditGameTime(date.toTimeString().slice(0, 5))
    setEditingGameTime(gameId)
  }

  const cancelEditingGameTime = () => {
    setEditingGameTime(null)
    setEditGameDate('')
    setEditGameTime('')
  }

  const updateGameDateTime = async (gameId: string) => {
    if (!editGameDate || !editGameTime) {
      toast.error('Please provide both date and time')
      return
    }

    try {
      const gameDateTime = new Date(`${editGameDate}T${editGameTime}:00`).toISOString()
      const response = await api.request(`/games/${gameId}`, {
        method: 'PATCH',
        body: JSON.stringify({ gameDate: gameDateTime })
      })
      if (response.error) {
        throw new Error(response.error)
      }
      
      toast.success('Game time updated successfully')
      setEditingGameTime(null)
      setEditGameDate('')
      setEditGameTime('')
      refreshGames()
    } catch (error: unknown) {
      toast.error('Error updating game time: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const updateReportStatus = async (reportId: string, status: 'resolved' | 'dismissed', adminNotes?: string) => {
    try {
      const response = await api.request(`/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNotes })
      })
      if (response.error) {
        throw new Error(response.error)
      }
      
      toast.success(`Report ${status}`)
      loadReports()
    } catch (error: unknown) {
      toast.error('Error updating report: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const deleteReportedContent = async (reportId: string, contentType: string) => {
    if (!confirm(`Are you sure you want to delete this ${contentType}? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await api.request(`/reports/${reportId}/content`, {
        method: 'DELETE'
      })
      if (response.error) {
        throw new Error(response.error)
      }
      
      toast.success('Content deleted and report resolved')
      loadReports()
    } catch (error: unknown) {
      toast.error('Error deleting content: ' + (error instanceof Error ? error.message : String(error)))
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

  const approveUser = async (userId: string, userName: string) => {
    if (!confirm(`Approve ${userName} to access the full application?`)) {
      return
    }

    try {
      const { error } = await api.approveUser(userId)
      if (error) throw new Error(error)
      
      // Update local state to mark user as verified instead of full data refresh
      setProfiles(prevProfiles => 
        prevProfiles.map(profile => 
          profile.id === userId 
            ? { ...profile, isVerified: true }
            : profile
        )
      )
      
      toast.success(`${userName} has been approved and can now access the full application!`)
    } catch (error: unknown) {
      toast.error('Error approving user: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const filteredWorkouts = selectedUser === 'all' 
    ? workouts 
    : workouts.filter(w => w.user_id === selectedUser)

  if (!isAdmin) {
    return (
      <div className="p-4 lg:p-6 pb-20 lg:pb-0 max-w-4xl lg:mx-auto">
        <div className="text-center py-12">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold font-heading text-gray-900 mb-2">Access Denied</h2>
          <p className="font-body text-gray-600">You don't have permission to access the admin panel.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 pb-20 lg:pb-0 max-w-4xl lg:mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="font-body text-gray-600">Loading admin data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
        <div className="max-w-6xl lg:mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl lg:text-4xl font-bold font-heading text-text-primary">Admin Panel</h1>
          </div>
          <p className="font-body text-text-secondary">Manage player workouts and activity</p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 pb-20 lg:pb-6 max-w-6xl lg:mx-auto">

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <UserIcon className="w-8 h-8 text-blue-500" />
            <div>
              <div className="text-2xl font-bold font-body text-gray-900">{profiles.length}</div>
              <div className="text-sm font-body text-gray-600">Total Players</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary-500" />
            <div>
              <div className="text-2xl font-bold font-body text-gray-900">{workouts.length}</div>
              <div className="text-sm font-body text-gray-600">Total Workouts</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold font-body text-gray-900">
                {profiles.filter(p => p.role === 'parent').length}
              </div>
              <div className="text-sm font-body text-gray-600">Parents</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setCurrentTab('workouts')}
            className={`px-6 py-3 font-medium font-body transition-colors ${
              currentTab === 'workouts'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Workouts
          </button>
          <button
            onClick={() => setCurrentTab('teams')}
            className={`px-6 py-3 font-medium font-body transition-colors ${
              currentTab === 'teams'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Teams
          </button>
          <button
            onClick={() => setCurrentTab('games')}
            className={`px-6 py-3 font-medium font-body transition-colors ${
              currentTab === 'games'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Games
          </button>
          <button
            onClick={() => setCurrentTab('relations')}
            className={`px-6 py-3 font-medium font-body transition-colors ${
              currentTab === 'relations'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Parent-Child Relations
          </button>
          <button
            onClick={() => setCurrentTab('unverified')}
            className={`px-6 py-3 font-medium font-body transition-colors ${
              currentTab === 'unverified'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Unverified Users
          </button>
          <button
            onClick={() => setCurrentTab('reports')}
            className={`px-6 py-3 font-medium font-body transition-colors ${
              currentTab === 'reports'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Reports
          </button>
        </div>
      </div>

      {currentTab === 'teams' ? (
        /* Team Management */
        <div className="space-y-6">
          {/* Create Team Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold font-heading text-gray-900">Team Management</h3>
                  <p className="text-sm font-body text-gray-600">Create and manage chat teams for players</p>
                </div>
                <button
                  onClick={() => setShowCreateTeam(!showCreateTeam)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-body"
                >
                  <Plus className="w-4 h-4" />
                  Create Team
                </button>
              </div>
            </div>

            {showCreateTeam && (
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium font-body text-gray-700 mb-1">Team Name</label>
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="Enter team name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium font-body text-gray-700 mb-1">Description (Optional)</label>
                    <textarea
                      value={newTeamDescription}
                      onChange={(e) => setNewTeamDescription(e.target.value)}
                      placeholder="Enter team description"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={createTeam}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-body"
                    >
                      Create Team
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateTeam(false)
                        setNewTeamName('')
                        setNewTeamDescription('')
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-body"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Teams List */}
            <div className="p-4">
              {teams.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-body text-gray-500">No teams created yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                        selectedTeam === team.id ? 'ring-2 ring-primary-500 border-primary-500' : ''
                      }`}
                      onClick={() => loadTeamMembers(team.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold font-heading text-gray-900">{team.name}</h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteTeam(team.id, team.name)
                          }}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {team.description && (
                        <p className="text-sm font-body text-gray-600 mb-2">{team.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-sm font-body text-gray-500">
                        <Users className="w-4 h-4" />
                        <span className="font-body">{team.memberCount} members</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Team Members Section */}
          {selectedTeam && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold font-heading text-gray-900">
                  Team Members - {teams.find(t => t.id === selectedTeam)?.name}
                </h3>
                <p className="text-sm font-body text-gray-600">Add or remove players from this team</p>
              </div>

              <div className="p-4">
                {/* Add Member Section */}
                <div className="mb-6">
                  <h4 className="text-md font-medium font-heading text-gray-900 mb-3">Add Player</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {profiles
                      .filter(profile => !selectedTeamMembers.some(member => member.userId === profile.id))
                      .map((profile) => (
                        <button
                          key={profile.id}
                          onClick={() => addTeamMember(selectedTeam, profile.id)}
                          className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left font-body"
                        >
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium font-body text-primary-600">
                              {profile.name?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium font-body text-gray-900">{profile.name}</div>
                            <div className="text-sm font-body text-gray-500">{profile.email}</div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Current Members */}
                <div>
                  <h4 className="text-md font-medium font-heading text-gray-900 mb-3">Current Members</h4>
                  {selectedTeamMembers.length === 0 ? (
                    <p className="font-body text-gray-500">No members in this team</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedTeamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium font-body text-primary-600">
                                {member.userName?.[0]?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{member.userName}</div>
                              <div className="text-sm text-gray-500">{member.userEmail}</div>
                            </div>
                            {member.role === 'admin' && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-body rounded-full">
                                Admin
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removeTeamMember(selectedTeam, member.id, member.userName)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : currentTab === 'games' ? (
        /* Games Management */
        <div className="space-y-6">
          {/* Create Game Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold font-heading text-gray-900">Games Management</h3>
                  <p className="text-sm font-body text-gray-600">Create and manage game schedule</p>
                </div>
                <button
                  onClick={() => setShowCreateGame(!showCreateGame)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-body"
                >
                  <Plus className="w-4 h-4" />
                  Create Game
                </button>
              </div>
            </div>

            {showCreateGame && (
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium font-body text-gray-700 mb-1">Team Name</label>
                      <input
                        type="text"
                        value={newGameTeamName}
                        onChange={(e) => setNewGameTeamName(e.target.value)}
                        placeholder="Enter your team name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium font-body text-gray-700 mb-1">Opponent Team</label>
                      <input
                        type="text"
                        value={newGameOpponent}
                        onChange={(e) => setNewGameOpponent(e.target.value)}
                        placeholder="Enter opponent team name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium font-body text-gray-700 mb-1">Home/Away</label>
                      <select
                        value={newGameIsHome ? 'home' : 'away'}
                        onChange={(e) => setNewGameIsHome(e.target.value === 'home')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                      >
                        <option value="home">Home</option>
                        <option value="away">Away</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium font-body text-gray-700 mb-1">Game Date</label>
                      <input
                        type="date"
                        value={newGameDate}
                        onChange={(e) => setNewGameDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium font-body text-gray-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={newGameTime}
                        onChange={(e) => setNewGameTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={createGame}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-body"
                    >
                      Create Game
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateGame(false)
                        setNewGameTeamName('')
                        setNewGameOpponent('')
                        setNewGameDate(new Date().toISOString().split('T')[0])
                        setNewGameTime('18:00')
                        setNewGameIsHome(true)
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-body"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Games List */}
            <div className="p-4">
              {games.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-body text-gray-500">No games created yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {games.map((game) => {
                    const isHomeTeam = game.isHome
                    const homeTeamName = isHomeTeam ? game.teamName : game.opponentTeam
                    const awayTeamName = isHomeTeam ? game.opponentTeam : game.teamName
                    const isCompleted = game.homeScore !== null && game.awayScore !== null
                    
                    return (
                      <div
                        key={game.id}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        {/* Game Header */}
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <Calendar className="w-5 h-5 text-gray-500" />
                              {editingGameTime === game.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    value={editGameDate}
                                    onChange={(e) => setEditGameDate(e.target.value)}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm font-body"
                                  />
                                  <input
                                    type="time"
                                    value={editGameTime}
                                    onChange={(e) => setEditGameTime(e.target.value)}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm font-body"
                                  />
                                  <button
                                    onClick={() => updateGameDateTime(game.id)}
                                    className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEditingGameTime}
                                    className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span 
                                    className="font-medium font-body text-gray-900 cursor-pointer hover:text-primary-600 transition-colors"
                                    onClick={() => onGameClick?.(game.id)}
                                  >
                                    {new Date(game.gameDate).toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                  <button
                                    onClick={() => startEditingGameTime(game.id, game.gameDate)}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                                    title="Edit game time"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                              <span className={`px-2 py-1 text-xs font-medium font-body rounded-full ${
                                isCompleted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {isCompleted ? 'Final' : 'Scheduled'}
                              </span>
                              {game.isSharedToFeed && (
                                <span className="px-2 py-1 text-xs font-medium font-body rounded-full bg-primary-100 text-primary-700">
                                  Shared
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {!game.isSharedToFeed && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    shareGameToFeed(game.id)
                                  }}
                                  className="p-2 text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                                  title="Share to Feed"
                                >
                                  <Share className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteGame(game.id, game.teamName, game.opponentTeam)
                                }}
                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Game"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Sports Card Layout */}
                        <div className="p-6">
                          <div className="flex items-center justify-center">
                            <div className="flex items-center w-full max-w-2xl">
                              {/* Home Team */}
                              <div className="flex-1 text-center p-4 bg-gray-50 rounded-l-lg border-r">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                  <span className="text-xs text-gray-500 font-body uppercase tracking-wide">Home</span>
                                </div>
                                <h4 className="text-lg font-bold font-heading text-gray-900 mb-2">
                                  {homeTeamName}
                                </h4>
                                <div className="space-y-2">
                                  <input
                                    type="number"
                                    value={game.homeScore || ''}
                                    onChange={(e) => {
                                      const homeScore = parseInt(e.target.value) || 0
                                      const awayScore = game.awayScore || 0
                                      updateGameScore(game.id, homeScore, awayScore)
                                    }}
                                    placeholder="Score"
                                    className="w-20 px-2 py-1 text-center text-2xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                                  />
                                </div>
                              </div>

                              {/* VS Separator */}
                              <div className="px-4 py-6 bg-white border-t border-b border-gray-200">
                                <div className="text-xl font-bold text-gray-400 font-body">VS</div>
                              </div>

                              {/* Away Team */}
                              <div className="flex-1 text-center p-4 bg-gray-50 rounded-r-lg border-l">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                  <span className="text-xs text-gray-500 font-body uppercase tracking-wide">Away</span>
                                </div>
                                <h4 className="text-lg font-bold font-heading text-gray-900 mb-2">
                                  {awayTeamName}
                                </h4>
                                <div className="space-y-2">
                                  <input
                                    type="number"
                                    value={game.awayScore || ''}
                                    onChange={(e) => {
                                      const awayScore = parseInt(e.target.value) || 0
                                      const homeScore = game.homeScore || 0
                                      updateGameScore(game.id, homeScore, awayScore)
                                    }}
                                    placeholder="Score"
                                    className="w-20 px-2 py-1 text-center text-2xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : currentTab === 'relations' ? (
        /* Parent-Child Relations */
        <div className="space-y-6">
          {/* Parent-Child Relations Management */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold font-heading text-gray-900">Parent-Child Relationships</h3>
              <p className="text-sm font-body text-gray-600">Manage parent-child relationships (parents can have multiple children)</p>
            </div>
            {/* Add Relationship Section */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium font-heading text-gray-900">Add Parent-Child Relationship</h4>
                <button
                  onClick={() => setShowAddRelationship(!showAddRelationship)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-body"
                >
                  <Plus className="w-4 h-4" />
                  Add Relationship
                </button>
              </div>

              {showAddRelationship && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium font-body text-gray-700 mb-1">Parent</label>
                      <select
                        value={selectedParent}
                        onChange={(e) => setSelectedParent(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                      >
                        <option value="">Select a parent</option>
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name || profile.email.split('@')[0]} ({profile.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium font-body text-gray-700 mb-1">Child</label>
                      <select
                        value={selectedChild}
                        onChange={(e) => setSelectedChild(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-body"
                      >
                        <option value="">Select a child</option>
                        {profiles.filter(p => p.role === 'player').map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name || profile.email.split('@')[0]} ({profile.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={addParentChildRelationship}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-body"
                    >
                      Add Relationship
                    </button>
                    <button
                      onClick={() => {
                        setShowAddRelationship(false)
                        setSelectedParent('')
                        setSelectedChild('')
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-body"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Current Relationships */}
            <div className="p-4">
              {parentChildRelationships.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-body text-gray-500">No parent-child relationships yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {parentChildRelationships.map((relationship) => (
                    <div key={relationship.parentId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                          {relationship.parentName?.[0]?.toUpperCase() || relationship.parentEmail[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold font-body text-gray-900">
                              {relationship.parentName || relationship.parentEmail.split('@')[0]}
                            </span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-body">Parent</span>
                          </div>
                          <div className="text-sm font-body text-gray-600">{relationship.parentEmail}</div>
                        </div>
                      </div>

                      {relationship.children.length === 0 ? (
                        <div className="text-sm font-body text-gray-500 ml-14">No children assigned</div>
                      ) : (
                        <div className="ml-14 space-y-2">
                          <div className="text-sm font-medium font-body text-gray-700">Children:</div>
                          {relationship.children.map((child: any) => (
                            <div key={child.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                  {child.childName?.[0]?.toUpperCase() || child.childEmail[0].toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium font-body text-gray-900">
                                    {child.childName || child.childEmail.split('@')[0]}
                                  </div>
                                  <div className="text-sm font-body text-gray-600">{child.childEmail}</div>
                                </div>
                              </div>
                              <button
                                onClick={() => removeParentChildRelationship(child.id)}
                                className="text-red-500 hover:text-red-700 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Legacy Parent-Child Relations (for transition) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold font-heading text-gray-900">Legacy Parent-Child Assignments</h3>
              <p className="text-sm font-body text-gray-600">Old single-child assignments (will be migrated)</p>
            </div>
            
            {parentChildRelations.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="font-body text-gray-500">No legacy parent accounts found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {parentChildRelations.map((relation, index) => (
                  <div
                    key={relation.parent.id}
                    className="p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Parent Info */}
                        {relation.parent.avatarUrl ? (
                          <img
                            src={relation.parent.avatarUrl}
                            alt="Parent"
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                            {relation.parent.name?.[0]?.toUpperCase() || relation.parent.email[0].toUpperCase()}
                          </div>
                        )}
                        
                        <div>
                          <div className="flex items-center gap-2 mb-1 font-body">
                            <span className="font-semibold font-body text-gray-900">
                              {relation.parent.name || relation.parent.email.split('@')[0]}
                            </span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-body">Parent</span>
                          </div>
                          <div className="text-sm font-body text-gray-600">
                            {relation.child ? (
                              <span className="font-body">Tracking: <strong>{relation.child.name || relation.child.email.split('@')[0]}</strong></span>
                            ) : (
                              <span className="text-gray-400 font-body">No child assigned</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Edit Assignment */}
                      <div className="flex items-center gap-2">
                        {editingRelation === relation.parent.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              defaultValue={relation.child?.id || ''}
                              onChange={(e) => updateChildAssignment(relation.parent.id, e.target.value || null)}
                              className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent font-body"
                            >
                              <option value="">No child</option>
                              {profiles.filter(p => p.role === 'player').map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.name || player.email.split('@')[0]}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => setEditingRelation(null)}
                              className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm font-body"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingRelation(relation.parent.id)}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : currentTab === 'unverified' ? (
        /* Unverified Users Management */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold font-heading text-gray-900">Unverified Users</h3>
            <p className="text-sm font-body text-gray-600">Users who have signed up but haven't been verified yet</p>
          </div>
          
          {profiles.filter(p => !p.isVerified).length === 0 ? (
            <div className="p-8 text-center">
              <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="font-body text-gray-500">All users are verified</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {profiles.filter(p => !p.isVerified).map((unverifiedUser) => (
                <div key={unverifiedUser.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* User Avatar */}
                      {unverifiedUser.avatarUrl ? (
                        <img
                          src={unverifiedUser.avatarUrl}
                          alt="Profile"
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                          {(unverifiedUser.name || unverifiedUser.email)?.[0]?.toUpperCase()}
                        </div>
                      )}
                      
                      {/* User Info */}
                      <div>
                        <div className="font-semibold font-body text-gray-900">
                          {unverifiedUser.name || unverifiedUser.email.split('@')[0]}
                        </div>
                        <div className="text-sm font-body text-gray-500">{unverifiedUser.email}</div>
                        <div className="flex items-center gap-2 text-sm font-body text-gray-600">
                          <span className="capitalize">{unverifiedUser.role}</span>
                          <span>•</span>
                          <span>{unverifiedUser.totalPoints || 0} points</span>
                          <span>•</span>
                          <span>Joined {new Date(unverifiedUser.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Approve Button */}
                    <button
                      onClick={() => approveUser(unverifiedUser.id, unverifiedUser.name || unverifiedUser.email)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-body"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : currentTab === 'reports' ? (
        /* Reports Management */
        <div className="space-y-6">
          {/* Reports Filter and Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold font-heading text-gray-900">Content Reports</h3>
                  <p className="text-sm font-body text-gray-600">Manage user reports for posts and media content</p>
                </div>
                <div className="flex gap-2">
                  {(['pending', 'resolved', 'dismissed', 'all'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setReportFilter(filter)}
                      className={`px-3 py-1 rounded-full text-sm font-heading transition-colors ${
                        reportFilter === filter
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reports List */}
            <div className="p-4">
              {reports.length === 0 ? (
                <div className="text-center py-8">
                  <Flag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-body text-gray-500">
                    {reportFilter === 'all' ? 'No reports found' : `No ${reportFilter} reports`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className={`border rounded-lg p-4 ${
                        report.status === 'pending' 
                          ? 'border-orange-200 bg-orange-50' 
                          : report.status === 'resolved'
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            report.status === 'pending' 
                              ? 'bg-orange-500' 
                              : report.status === 'resolved'
                              ? 'bg-green-500'
                              : 'bg-gray-500'
                          }`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium font-body text-gray-900">
                                {report.reportType === 'post' ? 'Post' : 'Media'} Report
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium font-body rounded-full ${
                                report.status === 'pending' 
                                  ? 'bg-orange-100 text-orange-700' 
                                  : report.status === 'resolved'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {report.status}
                              </span>
                            </div>
                            <div className="text-sm font-body text-gray-600 mt-1">
                              Reported by {report.reporterName || 'Unknown'} • {new Date(report.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {report.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateReportStatus(report.id, 'dismissed')}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Dismiss Report"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateReportStatus(report.id, 'resolved')}
                              className="p-2 text-green-500 hover:text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                              title="Mark Resolved"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteReportedContent(report.id, report.reportType)}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete Content"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Report Reason */}
                      <div className="mb-3">
                        <div className="text-sm font-medium font-body text-gray-700 mb-1">Reason:</div>
                        <div className="text-sm font-body text-gray-600 bg-white p-2 rounded border">
                          {report.reason}
                        </div>
                      </div>

                      {/* Reported Content */}
                      {report.reportedItem && (
                        <div className="mb-3">
                          <div className="text-sm font-medium font-body text-gray-700 mb-2">Reported Content:</div>
                          <div className="bg-white border rounded-lg p-3">
                            {report.reportType === 'post' ? (
                              <div>
                                {report.reportedItem.content && (
                                  <p className="text-sm font-body text-gray-800 mb-2">
                                    {report.reportedItem.content}
                                  </p>
                                )}
                                {report.reportedItem.imageUrl && (
                                  <img
                                    src={report.reportedItem.imageUrl}
                                    alt="Reported post"
                                    className="max-w-xs max-h-32 object-cover rounded"
                                  />
                                )}
                                <div className="text-xs font-body text-gray-500 mt-2">
                                  Posted by {report.reportedItem.userName || 'Unknown'}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-3">
                                  {report.reportedItem.mediaType === 'image' ? (
                                    <img
                                      src={report.reportedItem.uploadUrl}
                                      alt="Reported media"
                                      className="w-16 h-16 object-cover rounded"
                                    />
                                  ) : (
                                    <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                                      <Play className="w-6 h-6 text-gray-400" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-sm font-medium font-body text-gray-800">
                                      {report.reportedItem.originalName}
                                    </div>
                                    <div className="text-xs font-body text-gray-500">
                                      {report.reportedItem.mediaType} • Uploaded by {report.reportedItem.uploaderName || 'Unknown'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Admin Notes */}
                      {report.adminNotes && (
                        <div className="text-sm font-body text-gray-600">
                          <span className="font-medium">Admin Notes:</span> {report.adminNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* User Filter */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
            <label className="block text-sm font-medium font-body text-gray-700 mb-2">
              Filter by Player
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-body"
            >
              <option value="all">All Players</option>
              {profiles.filter(p => p.role === 'player').map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name || profile.email.split('@')[0]} ({profile.totalPoints || 0} pts)
                </option>
              ))}
            </select>
          </div>

          {/* Workouts List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold font-heading text-gray-900">Recent Workouts</h3>
              <p className="text-sm font-body text-gray-600">Click the trash icon to remove a workout and adjust points</p>
            </div>
            
            {filteredWorkouts.length === 0 ? (
              <div className="p-8 text-center">
                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="font-body text-gray-500">No workouts found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredWorkouts.map((workout, index) => (
                  <div
                    key={workout.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* User Avatar */}
                        {(workout.user as any)?.avatarUrl ? (
                          <img
                            src={(workout.user as any).avatarUrl}
                            alt="Profile"
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                            {((workout.profiles as any)?.name || (workout.profiles as any)?.email)?.[0]?.toUpperCase()}
                          </div>
                        )}
                        
                        {/* Workout Info */}
                        <div>
                          <div className="flex items-center gap-2 mb-1 font-body">
                            <span className="font-semibold font-body text-gray-900">
                              {(workout.profiles as any)?.name || (workout.profiles as any)?.email?.split('@')[0]}
                            </span>
                            <span className="text-sm font-body text-gray-500">•</span>
                            <span className="text-sm font-body text-gray-500">{formatTime(workout.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm font-body text-gray-600">
                            <span className="capitalize font-medium font-body">{workout.exercise_type}</span>
                            <span className="font-body">{workout.duration_minutes} minutes</span>
                            <span className="text-primary-600 font-semibold font-body">+{workout.points_earned} points</span>
                          </div>
                          {workout.notes && (
                            <p className="text-sm font-body text-gray-500 mt-1 italic">"{workout.notes}"</p>
                          )}
                        </div>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => {
                          if (confirm(`Delete this ${workout.exercise_type} workout? This will deduct ${workout.points_earned} points from ${(workout.profiles as any)?.name || 'the player'}.`)) {
                            deleteWorkout(workout.id, workout.points_earned, workout.user_id)
                          }
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
        </div>
      </div>
    </div>
  )
}