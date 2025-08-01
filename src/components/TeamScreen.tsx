import React, { useState, useEffect } from 'react'
import { Users, Crown, Calendar, ChevronRight, UserCheck, User as UserIcon } from 'lucide-react'
import { api } from '../lib/api'
import { Team, TeamMember } from '../types'
import toast from 'react-hot-toast'

export function TeamScreen() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)

  // Separate members by role
  const playerMembers = teamMembers.filter(member => member.userRole === 'player')
  const parentMembers = teamMembers.filter(member => member.userRole === 'parent')
  const coachMembers = teamMembers.filter(member => member.role === 'admin')

  useEffect(() => {
    fetchUserTeams()
  }, [])

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam.id)
    }
  }, [selectedTeam])

  const fetchUserTeams = async () => {
    try {
      const { data, error } = await api.getUserTeams()
      if (error) throw new Error(error)
      
      const userTeams = data || []
      setTeams(userTeams)
      
      // Auto-select first team if user has teams
      if (userTeams.length > 0) {
        setSelectedTeam(userTeams[0])
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error('Error loading teams: ' + errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamMembers = async (teamId: string) => {
    setMembersLoading(true)
    try {
      const { data, error } = await api.getTeamMembers(teamId)
      if (error) throw new Error(error)
      setTeamMembers(data || [])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error('Error loading team members: ' + errorMessage)
    } finally {
      setMembersLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-primary-600" />
            <h1 className="text-xl lg:text-4xl font-bold font-heading text-text-primary">Team</h1>
          </div>
          <p className="text-text-secondary font-body">Select and view your team roster</p>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-8">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-semibold font-heading text-text-primary mb-2">No teams yet!</h3>
            <p className="font-body text-text-secondary">You haven't been added to any teams yet</p>
          </div>
        </div>
      </div>
    )
  }

  if (!selectedTeam) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-primary-600" />
            <h1 className="text-xl lg:text-4xl font-bold font-heading text-text-primary">Select Your Team</h1>
          </div>
          <p className="text-text-secondary font-body">Choose a team to view the roster</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-4xl lg:mx-auto">
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className="bg-bg-primary rounded-xl shadow-sm border border-border-primary p-4 hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold font-heading text-text-primary">{team.name}</h3>
                        {team.description && (
                          <p className="text-sm font-body text-text-secondary">{team.description}</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-text-tertiary" />
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    {team.role === 'admin' && (
                      <div className="flex items-center gap-1">
                        <Crown className="w-4 h-4 text-primary-500" />
                        <span className="font-body">Admin</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span className="font-body">Joined {new Date(team.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-8 h-8 text-primary-600" />
          <h1 className="text-xl lg:text-4xl font-bold font-heading text-text-primary">{selectedTeam.name}</h1>
          {selectedTeam.role === 'admin' && (
            <Crown className="w-6 h-6 text-primary-500" />
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-text-secondary font-body">
            {selectedTeam.description || 'Team roster and information'}
          </p>
          {teams.length > 1 && (
            <button
              onClick={() => setSelectedTeam(null)}
              className="text-primary-600 hover:text-primary-700 font-body text-sm"
            >
              Switch Team
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 pb-20 lg:pb-6 max-w-4xl lg:mx-auto">
          
          {/* Team Stats */}
          <div className="p-4 lg:p-6 bg-bg-primary border border-border-primary rounded-xl mb-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold font-body text-primary-600">{playerMembers.length}</div>
                <div className="text-sm font-body text-text-secondary">Players</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-body text-secondary-600">{parentMembers.length}</div>
                <div className="text-sm font-body text-text-secondary">Parents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-body text-accent-600">{coachMembers.length}</div>
                <div className="text-sm font-body text-text-secondary">Coaches</div>
              </div>
            </div>
          </div>

          {/* Team Roster */}
          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-lg font-semibold font-heading text-text-primary mb-2">No members yet!</h3>
              <p className="font-body text-text-secondary">This team doesn't have any members yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Players Section */}
              {playerMembers.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold font-heading text-text-primary mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary-600" />
                    Players ({playerMembers.length})
                  </h2>
                  <div className="space-y-3">
                    {playerMembers.map((member) => (
                      <div
                        key={member.id}
                        className="bg-bg-primary rounded-xl shadow-sm border border-border-primary p-4"
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          {member.userAvatar ? (
                            <img
                              src={member.userAvatar}
                              alt="Profile"
                              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br from-primary-400 to-primary-600">
                              {member.userName?.[0]?.toUpperCase() || member.userEmail[0].toUpperCase()}
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1">
                            <h3 className="font-semibold font-heading text-text-primary">
                              {member.userName || member.userEmail.split('@')[0]}
                            </h3>
                            <div className="flex items-center gap-2 text-sm font-body text-text-secondary">
                              <UserCheck className="w-4 h-4" />
                              <span>{member.userEmail}</span>
                            </div>
                          </div>
                        </div>

                        {/* Join date */}
                        <div className="mt-3 text-xs font-body text-text-tertiary">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parents Section */}
              {parentMembers.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold font-heading text-text-primary mb-4 flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-secondary-600" />
                    Parents ({parentMembers.length})
                  </h2>
                  <div className="space-y-3">
                    {parentMembers.map((member) => (
                      <div
                        key={member.id}
                        className="bg-bg-primary rounded-xl shadow-sm border border-border-primary p-4"
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          {member.userAvatar ? (
                            <img
                              src={member.userAvatar}
                              alt="Profile"
                              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br from-secondary-400 to-secondary-600">
                              {member.userName?.[0]?.toUpperCase() || member.userEmail[0].toUpperCase()}
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1">
                            <h3 className="font-semibold font-heading text-text-primary">
                              {member.userName || member.userEmail.split('@')[0]}
                            </h3>
                            <div className="flex items-center gap-2 text-sm font-body text-text-secondary">
                              <UserCheck className="w-4 h-4" />
                              <span>{member.userEmail}</span>
                            </div>
                          </div>
                        </div>

                        {/* Join date */}
                        <div className="mt-3 text-xs font-body text-text-tertiary">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coaches Section */}
              {coachMembers.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold font-heading text-text-primary mb-4 flex items-center gap-2">
                    <Crown className="w-5 h-5 text-accent-600" />
                    Coaches ({coachMembers.length})
                  </h2>
                  <div className="space-y-3">
                    {coachMembers.map((member) => (
                      <div
                        key={member.id}
                        className="bg-bg-primary rounded-xl shadow-sm border border-border-primary p-4"
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          {member.userAvatar ? (
                            <img
                              src={member.userAvatar}
                              alt="Profile"
                              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br from-accent-400 to-accent-600">
                              {member.userName?.[0]?.toUpperCase() || member.userEmail[0].toUpperCase()}
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1">
                            <h3 className="font-semibold font-heading text-text-primary">
                              {member.userName || member.userEmail.split('@')[0]}
                            </h3>
                            <div className="flex items-center gap-2 text-sm font-body text-text-secondary">
                              <Crown className="w-4 h-4" />
                              <span>{member.userEmail}</span>
                            </div>
                          </div>
                        </div>

                        {/* Join date */}
                        <div className="mt-3 text-xs font-body text-text-tertiary">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}