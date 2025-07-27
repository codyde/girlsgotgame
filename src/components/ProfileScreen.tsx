import React, { useState, useEffect } from 'react'
import { Edit2, Camera, Award, Calendar, Target, Users, User as UserIcon, Palette } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../lib/api'
import { User } from '../types'
import toast from 'react-hot-toast'
import { uploadAvatar, validateFileSize } from '../lib/upload'

export function ProfileScreen() {
  const { profile, updateProfile, user } = useAuth()
  const { currentTheme, setTheme, themes } = useTheme()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')

  const [isUploading, setIsUploading] = useState(false)

  // Update state when profile changes
  useEffect(() => {
    if (profile) {
      setName(profile.name || '')
    }
  }, [profile])


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
      
      const result = await uploadAvatar(file);
      
      // Update profile with new avatar URL
      await updateProfile({ avatarUrl: result.url })
      
      toast.success('Profile photo updated!')
    } catch (error: unknown) {
      console.error('Avatar upload error:', error);
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="font-body text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="bg-bg-primary border-b border-border-primary p-4 lg:p-6 flex-shrink-0">
        <div className="max-w-4xl lg:mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserIcon className="w-8 h-8 text-primary-600" />
              <h1 className="text-3xl lg:text-4xl font-bold font-heading text-text-primary">My Profile</h1>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 bg-bg-tertiary text-text-secondary rounded-full hover:bg-secondary-100 transition-colors"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 pb-20 lg:pb-6 max-w-4xl lg:mx-auto">

      {/* Profile card */}
      <div className="mb-6">
        <div
          className="bg-bg-primary rounded-2xl shadow-xl p-6 lg:p-8 border border-border-primary"
        >
          {/* Avatar section */}
          <div className="text-center mb-6">
            <div
              onClick={handleAvatarClick}
              className={`relative inline-block cursor-pointer ${isUploading ? 'opacity-50' : ''}`}
            >
              {profile.avatarUrl ? (
                <img
                    src={profile.avatarUrl}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover mx-auto mb-4 shadow-lg"
                    style={{ 
                      imageRendering: 'high-quality',
                      colorInterpolation: 'sRGB'
                    }}
                  />
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center font-body"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium font-body hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white py-2 rounded-lg font-medium font-body hover:shadow-lg transition-all"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold font-heading text-gray-900 mb-1">
                  {profile.name || 'Team Member'}
                </h2>
                <p className="font-body text-gray-600">{profile.email}</p>
              </div>
            )}
          </div>

          {/* Parent information */}
          {profile.role === 'parent' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
              <h3 className="font-semibold font-heading text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Parent Account
              </h3>
              <div className="flex items-center gap-3">
                <UserIcon className="w-8 h-8 text-gray-400" />
                <div>
                  <p className="font-medium font-body text-gray-900">Parent Dashboard Available</p>
                  <p className="text-sm font-body text-gray-600">Access your children's progress through the dashboard</p>
                </div>
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <Award className="w-6 h-6 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold font-body text-orange-600">{profile.totalPoints || 0}</div>
              <div className="text-sm font-body text-orange-700">Total Points</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <Target className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold font-body text-green-600">0</div>
              <div className="text-sm font-body text-green-700">This Week</div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity sections */}
      <div className="px-4 lg:px-6 space-y-4 lg:space-y-6 max-w-2xl lg:mx-auto">
        {/* Theme Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-500" />
            Choose Your Theme
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(themes).map((theme) => (
              <button
                key={theme.name}
                onClick={() => setTheme(theme.name)}
                className={`relative p-3 rounded-lg border-2 transition-all ${
                  currentTheme === theme.name
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Theme Preview */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: theme.colors.primary[500] }}
                  />
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: theme.colors.secondary[500] }}
                  />
                </div>
                
                <div className="text-left">
                  <div className="font-medium font-body text-sm text-gray-900">
                    {theme.displayName}
                  </div>
                  <div className="text-xs font-body text-gray-600">
                    {theme.description}
                  </div>
                </div>
                
                {/* Active indicator */}
                {currentTheme === theme.name && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
        >
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Recent Activity
          </h3>
          <div className="text-center py-4">
            <div className="text-gray-400 text-sm font-body">No recent activity</div>
            <p className="text-xs font-body text-gray-500 mt-1">Start training to see your progress here!</p>
          </div>
        </div>

        {/* Profile stats */}
        <div
          className="bg-gradient-to-r from-orange-50 to-green-50 rounded-xl p-4 border border-orange-200"
        >
          <div className="text-center">
            <h3 className="font-semibold font-heading text-gray-900 mb-2">Member Since</h3>
            <p className="font-body text-gray-600">
              {new Date(profile.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  )
}