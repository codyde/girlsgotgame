import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Shield, Trash2, User as UserIcon, Trophy, AlertTriangle, Users, Edit2, MessageCircle, Plus, X } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { User, Workout, TeamWithMemberCount, TeamMember } from '../types'
import toast from 'react-hot-toast'

interface WorkoutWithUser extends Workout {
  user?: User
}

export function AdminScreen() {
  const { profile } = useAuth()
  const [workouts, setWorkouts] = useState<WorkoutWithUser[]>([])
  const [profiles, setProfiles] = useState<User[]>([])
  const [parentChildRelations, setParentChildRelations] = useState<{parent: User, child: User | null}[]>([])
  const [parentChildRelationships, setParentChildRelationships] = useState<any[]>([])
  const [teams, setTeams] = useState<TeamWithMemberCount[]>([])
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<TeamMember[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [currentTab, setCurrentTab] = useState<'workouts' | 'relations' | 'teams'>('workouts')
  const [editingRelation, setEditingRelation] = useState<string | null>(null)
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')
  const [showAddRelationship, setShowAddRelationship] = useState(false)
  const [selectedParent, setSelectedParent] = useState('')
  const [selectedChild, setSelectedChild] = useState('')
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

      setWorkouts(workoutData || [])
      setProfiles(profileData || [])
      setParentChildRelations(relationData || [])
      setParentChildRelationships(relationshipData || [])
      setTeams(teamData || [])
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

  useEffect(() => {
    if (isAdmin) {
      fetchData()
    }
  }, [isAdmin, fetchData])

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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
            onClick={() => setCurrentTab('relations')}
            className={`px-6 py-3 font-medium font-body transition-colors ${
              currentTab === 'relations'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Parent-Child Relations
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