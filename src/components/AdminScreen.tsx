import React, { useState, useEffect } from 'react'
import { Shield, Trash2, User as UserIcon, Trophy, AlertTriangle, Users, Edit2, MessageCircle, Plus, X, Mail, CheckCircle, XCircle, Clock, Gift, Copy } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { User, Workout, TeamWithMemberCount, TeamMember } from '../types'
import toast from 'react-hot-toast'

interface WorkoutWithUser extends Workout {
  user?: User
}

interface AccessRequest {
  id: string
  email: string
  name?: string
  message?: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  reviewedAt?: string
  reviewer?: {
    id: string
    name: string
    email: string
  }
}

interface InviteCode {
  id: string
  code: string
  maxUses: number
  usedCount: number
  isActive: boolean
  expiresAt?: string
  createdAt: string
  creator: {
    id: string
    name: string
    email: string
  }
  registrations: Array<{
    id: string
    userId: string
    userName: string
    userEmail: string
    registeredAt: string
  }>
}

export function AdminScreen() {
  const { profile } = useAuth()
  const [workouts, setWorkouts] = useState<WorkoutWithUser[]>([])
  const [profiles, setProfiles] = useState<User[]>([])
  const [parentChildRelations, setParentChildRelations] = useState<{parent: User, child: User | null}[]>([])
  const [teams, setTeams] = useState<TeamWithMemberCount[]>([])
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<TeamMember[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [currentTab, setCurrentTab] = useState<'workouts' | 'relations' | 'teams' | 'access-requests' | 'invites' | 'users'>('workouts')
  const [editingRelation, setEditingRelation] = useState<string | null>(null)
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')

  // Access requests and invites state
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [accessRequestsLoading, setAccessRequestsLoading] = useState(false)
  const [accessRequestFilter, setAccessRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [invitesLoading, setInvitesLoading] = useState(false)
  
  // User management state
  const [adminUsers, setAdminUsers] = useState<User[]>([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [emailWhitelist, setEmailWhitelist] = useState<any[]>([])
  const [bannedEmails, setBannedEmails] = useState<any[]>([])
  const [userManagementLoading, setUserManagementLoading] = useState(false)
  const [showAddWhitelist, setShowAddWhitelist] = useState(false)
  const [showBanEmail, setShowBanEmail] = useState(false)
  const [whitelistEmail, setWhitelistEmail] = useState('')
  const [banEmailData, setBanEmailData] = useState({ email: '', reason: '' })

  // Check if user is admin
  const isAdmin = profile?.email === 'codydearkland@gmail.com'

  useEffect(() => {
    if (isAdmin) {
      fetchData()
    }
  }, [isAdmin])

  const fetchData = async () => {
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

      // Fetch teams
      const { data: teamData, error: teamError } = await api.getAllTeamsAdmin()
      if (teamError) throw new Error(teamError)

      setWorkouts(workoutData || [])
      setProfiles(profileData || [])
      setParentChildRelations(relationData || [])
      setTeams(teamData || [])
    } catch (error: unknown) {
      toast.error('Error loading admin data: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }

  const fetchAccessRequests = async () => {
    try {
      setAccessRequestsLoading(true)
      const status = accessRequestFilter === 'all' ? undefined : accessRequestFilter
      const { data, error } = await api.getAllAccessRequestsAdmin(status)
      
      if (error) throw new Error(error)
      setAccessRequests(data || [])
    } catch (error: unknown) {
      toast.error('Error loading access requests: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setAccessRequestsLoading(false)
    }
  }

  const fetchInvites = async () => {
    try {
      setInvitesLoading(true)
      const { data, error } = await api.getAllInvitesAdmin()
      
      if (error) throw new Error(error)
      setInvites(data || [])
    } catch (error: unknown) {
      toast.error('Error loading invites: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setInvitesLoading(false)
    }
  }

  // Effect to load data when tab changes
  useEffect(() => {
    if (currentTab === 'access-requests') {
      fetchAccessRequests()
    } else if (currentTab === 'invites') {
      fetchInvites()
    } else if (currentTab === 'users') {
      fetchUserManagementData()
    }
  }, [currentTab, accessRequestFilter])

  const fetchUserManagementData = async () => {
    try {
      setUserManagementLoading(true)
      
      // Fetch users, whitelist, and banned emails in parallel
      const [usersResult, whitelistResult, bannedResult] = await Promise.all([
        api.getAdminUsers(),
        api.getEmailWhitelist(),
        api.getBannedEmails()
      ])
      
      if (usersResult.error) throw new Error(usersResult.error)
      if (whitelistResult.error) throw new Error(whitelistResult.error)
      if (bannedResult.error) throw new Error(bannedResult.error)
      
      setAdminUsers(usersResult.data || [])
      setEmailWhitelist(whitelistResult.data || [])
      setBannedEmails(bannedResult.data || [])
    } catch (error: unknown) {
      toast.error('Error loading user management data: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setUserManagementLoading(false)
    }
  }

  const addEmailToWhitelist = async () => {
    try {
      const { error } = await api.addEmailToWhitelist(whitelistEmail)
      
      if (error) throw new Error(error)
      
      toast.success('Email added to whitelist!')
      setShowAddWhitelist(false)
      setWhitelistEmail('')
      fetchUserManagementData() // Refresh data
    } catch (error: unknown) {
      toast.error('Error adding to whitelist: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const removeFromWhitelist = async (whitelistId: string) => {
    try {
      const { error } = await api.removeEmailFromWhitelist(whitelistId)
      
      if (error) throw new Error(error)
      
      toast.success('Email removed from whitelist')
      fetchUserManagementData() // Refresh data
    } catch (error: unknown) {
      toast.error('Error removing from whitelist: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const banEmail = async () => {
    try {
      const { error } = await api.banEmailAddress(banEmailData.email, banEmailData.reason)
      
      if (error) throw new Error(error)
      
      toast.success('Email banned successfully!')
      setShowBanEmail(false)
      setBanEmailData({ email: '', reason: '' })
      fetchUserManagementData() // Refresh data
    } catch (error: unknown) {
      toast.error('Error banning email: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const unbanEmail = async (banId: string) => {
    try {
      const { error } = await api.unbanEmailAddress(banId)
      
      if (error) throw new Error(error)
      
      toast.success('Email unbanned')
      fetchUserManagementData() // Refresh data
    } catch (error: unknown) {
      toast.error('Error unbanning email: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const removeUser = async (userId: string, userName: string, userEmail: string) => {
    const shouldBanEmail = window.confirm(
      `Remove ${userName || userEmail}?\n\nClick OK to remove and ban their email (recommended)\nClick Cancel to just remove the account`
    )

    if (shouldBanEmail === null) return // User clicked outside dialog
    
    const reason = prompt('Reason for removal (optional):')
    if (reason === null) return // User cancelled

    try {
      const { error } = await api.removeUser(userId, reason || undefined, shouldBanEmail)
      
      if (error) throw new Error(error)
      
      toast.success(`User removed${shouldBanEmail ? ' and email banned' : ''}`)
      fetchUserManagementData() // Refresh data
    } catch (error: unknown) {
      toast.error('Error removing user: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const approveAccessRequest = async (requestId: string) => {
    try {
      const { error } = await api.approveAccessRequest(requestId, true)
      
      if (error) throw new Error(error)
      
      toast.success('Access request approved!')
      fetchAccessRequests() // Refresh the list
    } catch (error: unknown) {
      toast.error('Error approving request: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const rejectAccessRequest = async (requestId: string) => {
    try {
      const { error } = await api.rejectAccessRequest(requestId)
      
      if (error) throw new Error(error)
      
      toast.success('Access request rejected')
      fetchAccessRequests() // Refresh the list
    } catch (error: unknown) {
      toast.error('Error rejecting request: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const copyInviteLink = async (code: string) => {
    const inviteUrl = `${window.location.origin}?invite=${code}`
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success('Invite link copied to clipboard!')
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = inviteUrl
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        document.execCommand('copy')
        toast.success('Invite link copied to clipboard!')
      } catch (fallbackError) {
        toast.error('Failed to copy invite link')
      }
      document.body.removeChild(textArea)
    }
  }

  const deleteWorkout = async (workoutId: string, pointsToDeduct: number, userId: string) => {
    try {
      // Use the existing delete workout API endpoint which handles point adjustment
      const { error } = await api.deleteWorkout(workoutId)
      if (error) throw new Error(error)

      toast.success('Workout deleted and points adjusted')
      fetchData() // Refresh data
    } catch (error: unknown) {
      toast.error('Error deleting workout: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const updateChildAssignment = async (parentId: string, childId: string | null) => {
    try {
      const { error } = await api.updateChildAssignment(parentId, childId)
      if (error) throw new Error(error)

      toast.success('Child assignment updated!')
      fetchData() // Refresh data
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
      fetchData() // Refresh teams
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
      fetchData() // Refresh teams
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

  const addTeamMember = async (teamId: string, userId: string) => {
    try {
      const { error } = await api.addTeamMember(teamId, userId)
      if (error) throw new Error(error)
      
      toast.success('Player added to team')
      loadTeamMembers(teamId) // Refresh team members
      fetchData() // Refresh team counts
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
      fetchData() // Refresh team counts
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
        <div className="flex border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setCurrentTab('workouts')}
            className={`px-6 py-3 font-medium font-body transition-colors whitespace-nowrap ${
              currentTab === 'workouts'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Workouts
          </button>
          <button
            onClick={() => setCurrentTab('access-requests')}
            className={`px-6 py-3 font-medium font-body transition-colors whitespace-nowrap ${
              currentTab === 'access-requests'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Access Requests
          </button>
          <button
            onClick={() => setCurrentTab('invites')}
            className={`px-6 py-3 font-medium font-body transition-colors whitespace-nowrap ${
              currentTab === 'invites'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Invites
          </button>
          <button
            onClick={() => setCurrentTab('teams')}
            className={`px-6 py-3 font-medium font-body transition-colors whitespace-nowrap ${
              currentTab === 'teams'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Teams
          </button>
          <button
            onClick={() => setCurrentTab('users')}
            className={`px-6 py-3 font-medium font-body transition-colors whitespace-nowrap ${
              currentTab === 'users'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setCurrentTab('relations')}
            className={`px-6 py-3 font-medium font-body transition-colors whitespace-nowrap ${
              currentTab === 'relations'
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Parent-Child Relations
          </button>
        </div>
      </div>

      {currentTab === 'access-requests' ? (
        /* Access Request Management */
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold font-heading text-gray-900">Access Request Management</h3>
                  <p className="text-sm font-body text-gray-600">Review and approve access requests to join the community</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={accessRequestFilter}
                    onChange={(e) => setAccessRequestFilter(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-body"
                  >
                    <option value="all">All Requests</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            {accessRequestsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
                <p className="font-body text-gray-600">Loading access requests...</p>
              </div>
            ) : accessRequests.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="font-body text-gray-500">No access requests found</p>
                <p className="text-sm font-body text-gray-400 mt-2">
                  {accessRequestFilter === 'pending' ? 'No pending requests at the moment' : 'Try changing the filter to see other requests'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {accessRequests.map((request) => (
                  <div key={request.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Mail className="w-5 h-5 text-gray-400" />
                          <span className="font-medium font-body text-gray-900">{request.email}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-body ${
                            request.status === 'pending' 
                              ? 'bg-yellow-100 text-yellow-800'
                              : request.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </div>
                        
                        {request.name && (
                          <p className="text-sm font-body text-gray-600 mb-1">
                            <strong>Name:</strong> {request.name}
                          </p>
                        )}
                        
                        {request.message && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-body text-gray-700">"{request.message}"</p>
                          </div>
                        )}
                        
                        <div className="mt-3 text-xs font-body text-gray-500 space-y-1">
                          <div>Submitted: {new Date(request.createdAt).toLocaleString()}</div>
                          {request.reviewedAt && (
                            <div>
                              Reviewed: {new Date(request.reviewedAt).toLocaleString()}
                              {request.reviewer && ` by ${request.reviewer.name || request.reviewer.email}`}
                            </div>
                          )}
                        </div>
                      </div>

                      {request.status === 'pending' && (
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => approveAccessRequest(request.id)}
                            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-body text-sm"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => rejectAccessRequest(request.id)}
                            className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-body text-sm"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : currentTab === 'invites' ? (
        /* Invite Analytics */
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold font-heading text-gray-900">Invite Code Analytics</h3>
                <p className="text-sm font-body text-gray-600">Monitor invite code usage and community growth</p>
              </div>
            </div>

            {invitesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
                <p className="font-body text-gray-600">Loading invite analytics...</p>
              </div>
            ) : invites.length === 0 ? (
              <div className="text-center py-8">
                <Gift className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="font-body text-gray-500">No invite codes found</p>
                <p className="text-sm font-body text-gray-400 mt-2">Invite codes will appear here once parents start generating them</p>
              </div>
            ) : (
              <div className="p-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600">{invites.length}</div>
                    <div className="text-sm text-blue-600">Total Codes</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-600">
                      {invites.filter(i => i.isActive && i.usedCount < i.maxUses).length}
                    </div>
                    <div className="text-sm text-green-600">Active Codes</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="text-2xl font-bold text-purple-600">
                      {invites.reduce((sum, invite) => sum + invite.usedCount, 0)}
                    </div>
                    <div className="text-sm text-purple-600">Total Uses</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="text-2xl font-bold text-orange-600">
                      {invites.reduce((sum, invite) => sum + invite.registrations.length, 0)}
                    </div>
                    <div className="text-sm text-orange-600">New Members</div>
                  </div>
                </div>

                {/* Invite Codes List */}
                <div className="space-y-4">
                  <h4 className="font-medium font-heading text-gray-900">All Invite Codes</h4>
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className={`border rounded-lg p-4 ${
                        invite.isActive && invite.usedCount < invite.maxUses
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-lg font-bold text-primary-600">{invite.code}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-body ${
                              invite.isActive && invite.usedCount < invite.maxUses
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {invite.isActive && invite.usedCount < invite.maxUses ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          
                          <div className="text-sm font-body text-gray-600 space-y-1 mb-2">
                            <div><strong>Created by:</strong> {invite.creator.name || invite.creator.email}</div>
                            <div><strong>Uses:</strong> {invite.usedCount}/{invite.maxUses}</div>
                            <div><strong>Created:</strong> {new Date(invite.createdAt).toLocaleDateString()}</div>
                            {invite.expiresAt && (
                              <div><strong>Expires:</strong> {new Date(invite.expiresAt).toLocaleDateString()}</div>
                            )}
                          </div>
                          
                          {/* Show registrations */}
                          {invite.registrations.length > 0 && (
                            <div className="mt-3 p-3 bg-white rounded border">
                              <p className="text-xs font-medium font-body text-gray-700 mb-2">New members from this invite:</p>
                              {invite.registrations.map((reg) => (
                                <div key={reg.id} className="text-xs font-body text-gray-600 flex items-center justify-between">
                                  <span>{reg.userName} ({reg.userEmail})</span>
                                  <span>{new Date(reg.registeredAt).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {invite.isActive && invite.usedCount < invite.maxUses && (
                          <div className="ml-4">
                            <button
                              onClick={() => copyInviteLink(invite.code)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Copy invite link"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : currentTab === 'teams' ? (
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
      ) : currentTab === 'users' ? (
        /* User Management */
        <div className="space-y-6">
          {userManagementLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
              <p className="font-body text-gray-600">Loading user management data...</p>
            </div>
          ) : (
            <>
              {/* Users Management */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold font-heading text-gray-900">User Management</h3>
                  <p className="text-sm font-body text-gray-600">Remove users and manage user accounts</p>
                </div>
                
                {adminUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="font-body text-gray-500">No users found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {adminUsers.map((user) => (
                      <div key={user.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt="User"
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                                {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                              </div>
                            )}
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold font-body text-gray-900">
                                  {user.name || user.email.split('@')[0]}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded-full font-body ${
                                  user.role === 'parent' 
                                    ? 'bg-blue-100 text-blue-700'
                                    : user.role === 'player'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {user.role?.charAt(0).toUpperCase() + user.role?.slice(1) || 'Unknown'}
                                </span>
                                {!user.isOnboarded && (
                                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-body">
                                    Pending Onboarding
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-body text-gray-600 space-y-1">
                                <div>{user.email}</div>
                                <div className="flex items-center gap-4">
                                  <span>Points: {user.totalPoints || 0}</span>
                                  <span>Joined: {new Date(user.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {user.email !== 'codydearkland@gmail.com' && (
                            <button
                              onClick={() => removeUser(user.id, user.name || user.email.split('@')[0], user.email)}
                              className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-body text-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Email Whitelist Management */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold font-heading text-gray-900">Email Whitelist</h3>
                      <p className="text-sm font-body text-gray-600">Pre-approved emails that can sign up without invites</p>
                    </div>
                    <button
                      onClick={() => setShowAddWhitelist(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-body"
                    >
                      <Plus className="w-4 h-4" />
                      Add Email
                    </button>
                  </div>
                </div>

                {showAddWhitelist && (
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium font-body text-gray-700 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={whitelistEmail}
                          onChange={(e) => setWhitelistEmail(e.target.value)}
                          placeholder="Enter email address to whitelist"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-body"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={addEmailToWhitelist}
                          disabled={!whitelistEmail.includes('@')}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-body disabled:bg-gray-300"
                        >
                          Add to Whitelist
                        </button>
                        <button
                          onClick={() => {
                            setShowAddWhitelist(false)
                            setWhitelistEmail('')
                          }}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-body"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {emailWhitelist.length === 0 ? (
                  <div className="text-center py-8">
                    <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="font-body text-gray-500">No whitelisted emails</p>
                    <p className="text-sm font-body text-gray-400 mt-2">Add emails that should be allowed to register without invites</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {emailWhitelist.map((item) => (
                      <div key={item.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-green-500" />
                            <div>
                              <div className="font-medium font-body text-gray-900">{item.email}</div>
                              <div className="text-sm font-body text-gray-600">
                                Added {new Date(item.addedAt).toLocaleDateString()} by {item.addedBy.name || item.addedBy.email}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromWhitelist(item.id)}
                            className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-body text-sm"
                          >
                            <X className="w-4 h-4" />
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Banned Emails Management */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold font-heading text-gray-900">Banned Emails</h3>
                      <p className="text-sm font-body text-gray-600">Emails that are permanently blocked from registering</p>
                    </div>
                    <button
                      onClick={() => setShowBanEmail(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-body"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Ban Email
                    </button>
                  </div>
                </div>

                {showBanEmail && (
                  <div className="p-4 border-b border-gray-200 bg-red-50">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium font-body text-gray-700 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={banEmailData.email}
                          onChange={(e) => setBanEmailData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="Enter email address to ban"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-body"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium font-body text-gray-700 mb-1">Reason (Optional)</label>
                        <input
                          type="text"
                          value={banEmailData.reason}
                          onChange={(e) => setBanEmailData(prev => ({ ...prev, reason: e.target.value }))}
                          placeholder="Reason for banning this email"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-body"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={banEmail}
                          disabled={!banEmailData.email.includes('@')}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-body disabled:bg-gray-300"
                        >
                          Ban Email
                        </button>
                        <button
                          onClick={() => {
                            setShowBanEmail(false)
                            setBanEmailData({ email: '', reason: '' })
                          }}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-body"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {bannedEmails.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="font-body text-gray-500">No banned emails</p>
                    <p className="text-sm font-body text-gray-400 mt-2">Banned emails will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {bannedEmails.map((ban) => (
                      <div key={ban.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <div>
                              <div className="font-medium font-body text-gray-900">{ban.email}</div>
                              <div className="text-sm font-body text-gray-600 space-y-1">
                                <div>Banned {new Date(ban.bannedAt).toLocaleDateString()} by {ban.bannedBy.name || ban.bannedBy.email}</div>
                                {ban.reason && (
                                  <div className="text-red-600">Reason: {ban.reason}</div>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => unbanEmail(ban.id)}
                            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-body text-sm"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Unban
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
      ) : currentTab === 'relations' ? (
        /* Parent-Child Relations */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold font-heading text-gray-900">Parent-Child Assignments</h3>
            <p className="text-sm font-body text-gray-600">Manage which children parents are tracking</p>
          </div>
          
          {parentChildRelations.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="font-body text-gray-500">No parent accounts found</p>
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