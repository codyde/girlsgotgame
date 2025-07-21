import React, { useState, useEffect } from 'react'
import { Edit2, Camera, Award, Calendar, Target, Users, User as UserIcon } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import { User } from '../types'
import toast from 'react-hot-toast'
import { uploadAvatar, validateFileSize } from '../lib/upload'

export function ProfileScreen() {
  const { profile, updateProfile, user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingChild, setIsEditingChild] = useState(false)
  const [name, setName] = useState('')
  const [players, setPlayers] = useState<User[]>([])
  const [selectedChild, setSelectedChild] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  const [isUploading, setIsUploading] = useState(false)

  // Update state when profile changes
  useEffect(() => {
    if (profile) {
      setName(profile.name || '')
      setSelectedChild(profile.childId || '')
    }
  }, [profile])

  const fetchPlayers = async () => {
    try {
      setLoadingPlayers(true)
      // Note: We'll need to add this endpoint to the API if we want to filter by role
      // For now, we'll get the leaderboard which contains players
      const { data, error } = await api.getLeaderboard()

      if (error) throw new Error(error)
      setPlayers(data || [])
    } catch (error: unknown) {
      toast.error('Error loading players: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoadingPlayers(false)
    }
  }

  const handleEditChild = () => {
    setIsEditingChild(true)
    setSelectedChild(profile?.childId || '')
    setManualEmail('')
    setShowManualEntry(false)
    fetchPlayers()
  }

  const handleSaveChild = async () => {
    try {
      let childId = null
      
      if (selectedChild) {
        childId = selectedChild
      } else if (manualEmail.trim()) {
        // For now, we'll search through the players list
        // In a real app, you'd want a dedicated endpoint for this
        const player = players.find(p => p.email.toLowerCase() === manualEmail.trim().toLowerCase())
        
        if (!player) {
          toast.error('Player not found with that email address')
          return
        }
        
        childId = player.id
      }
      
      await updateProfile({ childId: childId })
      setIsEditingChild(false)
      
      if (childId) {
        toast.success('Child assigned successfully!')
      } else {
        toast.success('Child assignment removed')
      }
    } catch {
      // Error handling is done in the hook
    }
  }

  const handleSave = async () => {
    try {
      await updateProfile({ name: name.trim() || null })
      setIsEditing(false)
    } catch {
      // Error is handled in the hook
    }
  }

  const handleUploadAvatar = async (file: File) => {
    try {
      if (!user) throw new Error('No user logged in')
      
      // Check file size (16MB limit)
      if (!validateFileSize(file, 16)) {
        throw new Error('Image must be less than 16MB')
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file')
      }
      
      setIsUploading(true)
      console.log('🖼️ Starting avatar upload to R2:', file.name);
      
      const result = await uploadAvatar(file, (progress) => {
        console.log(`📊 Upload progress: ${progress.percentage}%`);
      });
      
      console.log('🖼️ Avatar upload successful:', result.url);
      
      // Update profile with new avatar URL
      await updateProfile({ avatarUrl: result.url })
      
      toast.success('Profile photo updated!')
    } catch (error: unknown) {
      console.error('🖼️ Avatar upload error:', error);
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setIsUploading(false)
    }
  }
  
  const handleAvatarClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        handleUploadAvatar(file)
      }
    }
    input.click()
  }

  if (!profile) {
    return (
      <div className="p-4 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20 lg:pb-0">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 lg:px-6 pt-6 lg:pt-8 pb-16 lg:pb-20">
        <div className="flex items-center justify-between text-white">
          <h1 className="text-2xl lg:text-3xl font-bold">My Profile</h1>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition-colors"
          >
            <Edit2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Profile card - overlapping the header */}
      <div className="px-4 lg:px-6 -mt-12 lg:-mt-16 mb-6 max-w-2xl lg:mx-auto">
        <div
          className="bg-white rounded-2xl shadow-xl p-6 lg:p-8"
        >
          {/* Avatar section */}
          <div className="text-center mb-6">
            <div
              onClick={handleAvatarClick}
              className={`relative inline-block cursor-pointer ${isUploading ? 'opacity-50' : ''}`}
            >
              {profile.avatarUrl ? (
                <>
                  {console.log('🖼️ Rendering avatar with URL:', profile.avatarUrl)}
                  <img
                    src={profile.avatarUrl}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover mx-auto mb-4 shadow-lg"
                    style={{ 
                      imageRendering: 'high-quality',
                      colorInterpolation: 'sRGB'
                    }}
                  />
                </>
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg">
                  {profile.name?.[0]?.toUpperCase() || profile.email[0].toUpperCase()}
                </div>
              )}
              <div className={`absolute bottom-3 right-0 bg-white p-2 rounded-full shadow-lg ${isUploading ? 'animate-pulse' : ''}`}>
                <Camera className="w-4 h-4 text-gray-600" />
              </div>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2 rounded-lg font-medium hover:shadow-lg transition-all"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {profile.name || 'Team Member'}
                </h2>
                <p className="text-gray-600">{profile.email}</p>
              </div>
            )}
          </div>

          {/* Parent-specific child assignment */}
          {profile.role === 'parent' && (
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6"
            >
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Child Assignment
              </h3>
              
              {isEditingChild ? (
                <div className="space-y-4">
                  {loadingPlayers ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto"></div>
                    </div>
                  ) : (
                    <>
                      {/* Existing Players */}
                      {players.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select from registered players:
                          </label>
                          <select
                            value={selectedChild}
                            onChange={(e) => {
                              setSelectedChild(e.target.value)
                              setManualEmail('')
                              setShowManualEntry(false)
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          >
                            <option value="">No child selected</option>
                            {players.map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.name || player.email.split('@')[0]} ({player.totalPoints || 0} points)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Manual Entry */}
                      <div className="border-t border-gray-200 pt-4">
                        <button
                          onClick={() => {
                            setShowManualEntry(!showManualEntry)
                            setSelectedChild('')
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {showManualEntry ? 'Hide manual entry' : 'Enter email manually'}
                        </button>
                        
                        {showManualEntry && (
                          <div className="mt-2">
                            <input
                              type="email"
                              value={manualEmail}
                              onChange={(e) => setManualEmail(e.target.value)}
                              placeholder="child@email.com"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingChild(false)}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveChild}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2 rounded-lg font-medium hover:shadow-lg transition-all"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserIcon className="w-8 h-8 text-gray-400" />
                    <div>
                      {profile.childId ? (
                        <>
                          <p className="font-medium text-gray-900">Child assigned</p>
                          <p className="text-sm text-gray-600">Tracking a player's progress</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900">No child assigned</p>
                          <p className="text-sm text-gray-600">Select a player to track</p>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleEditChild}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                  >
                    {profile.childId ? 'Change' : 'Assign'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <Award className="w-6 h-6 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-600">{profile.totalPoints || 0}</div>
              <div className="text-sm text-orange-700">Total Points</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <Target className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">0</div>
              <div className="text-sm text-green-700">This Week</div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity sections */}
      <div className="px-4 lg:px-6 space-y-4 lg:space-y-6 max-w-2xl lg:mx-auto">
        {/* Recent activity */}
        <div
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
        >
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Recent Activity
          </h3>
          <div className="text-center py-4">
            <div className="text-gray-400 text-sm">No recent activity</div>
            <p className="text-xs text-gray-500 mt-1">Start training to see your progress here!</p>
          </div>
        </div>


        {/* Profile stats */}
        <div
          className="bg-gradient-to-r from-orange-50 to-green-50 rounded-xl p-4 border border-orange-200"
        >
          <div className="text-center">
            <h3 className="font-semibold text-gray-900 mb-2">Member Since</h3>
            <p className="text-gray-600">
              {new Date(profile.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}