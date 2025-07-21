import React, { useState, useEffect } from 'react'
import { Shield, Trash2, User as UserIcon, Trophy, AlertTriangle, Users, Edit2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { User, Workout } from '../types'
import toast from 'react-hot-toast'

interface WorkoutWithUser extends Workout {
  user?: User
}

export function AdminScreen() {
  const { profile } = useAuth()
  const [workouts, setWorkouts] = useState<WorkoutWithUser[]>([])
  const [profiles, setProfiles] = useState<User[]>([])
  const [parentChildRelations, setParentChildRelations] = useState<{parent: User, child: User | null}[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [showRelations, setShowRelations] = useState(false)
  const [editingRelation, setEditingRelation] = useState<string | null>(null)

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

      setWorkouts(workoutData || [])
      setProfiles(profileData || [])
      setParentChildRelations(relationData || [])
    } catch (error: unknown) {
      toast.error('Error loading admin data: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access the admin panel.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 pb-20 lg:pb-0 max-w-4xl lg:mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="bg-white border-b border-gray-200 p-4 lg:p-6 flex-shrink-0">
        <div className="max-w-6xl lg:mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-red-500" />
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Admin Panel</h1>
          </div>
          <p className="text-gray-600">Manage player workouts and activity</p>
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
              <div className="text-2xl font-bold text-gray-900">{profiles.length}</div>
              <div className="text-sm text-gray-600">Total Players</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-orange-500" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{workouts.length}</div>
              <div className="text-sm text-gray-600">Total Workouts</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {profiles.filter(p => p.role === 'parent').length}
              </div>
              <div className="text-sm text-gray-600">Parents</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setShowRelations(false)}
            className={`px-6 py-3 font-medium transition-colors ${
              !showRelations 
                ? 'text-orange-600 border-b-2 border-orange-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Workouts
          </button>
          <button
            onClick={() => setShowRelations(true)}
            className={`px-6 py-3 font-medium transition-colors ${
              showRelations 
                ? 'text-orange-600 border-b-2 border-orange-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Parent-Child Relations
          </button>
        </div>
      </div>

      {showRelations ? (
        /* Parent-Child Relations */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Parent-Child Assignments</h3>
            <p className="text-sm text-gray-600">Manage which children parents are tracking</p>
          </div>
          
          {parentChildRelations.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No parent accounts found</p>
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
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">
                            {relation.parent.name || relation.parent.email.split('@')[0]}
                          </span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Parent</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {relation.child ? (
                            <span>Tracking: <strong>{relation.child.name || relation.child.email.split('@')[0]}</strong></span>
                          ) : (
                            <span className="text-gray-400">No child assigned</span>
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
                            className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                            className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Player
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
              <h3 className="text-lg font-semibold text-gray-900">Recent Workouts</h3>
              <p className="text-sm text-gray-600">Click the trash icon to remove a workout and adjust points</p>
            </div>
            
            {filteredWorkouts.length === 0 ? (
              <div className="p-8 text-center">
                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No workouts found</p>
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
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                            {((workout.profiles as any)?.name || (workout.profiles as any)?.email)?.[0]?.toUpperCase()}
                          </div>
                        )}
                        
                        {/* Workout Info */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">
                              {(workout.profiles as any)?.name || (workout.profiles as any)?.email?.split('@')[0]}
                            </span>
                            <span className="text-sm text-gray-500">•</span>
                            <span className="text-sm text-gray-500">{formatTime(workout.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="capitalize font-medium">{workout.exercise_type}</span>
                            <span>{workout.duration_minutes} minutes</span>
                            <span className="text-orange-600 font-semibold">+{workout.points_earned} points</span>
                          </div>
                          {workout.notes && (
                            <p className="text-sm text-gray-500 mt-1 italic">"{workout.notes}"</p>
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