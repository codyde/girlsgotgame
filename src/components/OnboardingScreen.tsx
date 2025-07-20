import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Users, User, ArrowRight, Camera, Upload, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

type OnboardingStep = 'role' | 'profile-setup'

export function OnboardingScreen() {
  const { updateProfile, signOut } = useAuth()
  const [step, setStep] = useState<OnboardingStep>('role')
  const [selectedRole, setSelectedRole] = useState<'parent' | 'player' | null>(null)
  const [name, setName] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleRoleSelection = (role: 'parent' | 'player') => {
    setSelectedRole(role)
    setStep('profile-setup')
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Image must be less than 5MB')
        return
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => setImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error: any) {
      toast.error('Error uploading image: ' + error.message)
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleComplete = async () => {
    if (!selectedRole || !name.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    if (selectedRole === 'player' && !jerseyNumber.trim()) {
      toast.error('Please enter your jersey number')
      return
    }

    try {
      setLoading(true)
      
      // Upload image if selected
      let avatarUrl = null
      if (selectedImage) {
        avatarUrl = await uploadImage(selectedImage)
        if (!avatarUrl) return // uploadImage handles error display
      }

      // Prepare profile updates
      const profileUpdates: any = {
        role: selectedRole,
        name: name.trim(),
        is_onboarded: true
      }

      if (avatarUrl) {
        profileUpdates.avatar_url = avatarUrl
      }

      if (selectedRole === 'player' && jerseyNumber.trim()) {
        const jersey = parseInt(jerseyNumber.trim())
        if (isNaN(jersey) || jersey < 0 || jersey > 99) {
          toast.error('Jersey number must be between 0 and 99')
          return
        }
        profileUpdates.jersey_number = jersey
      }

      await updateProfile(profileUpdates)
      
      // Success is handled by the updateProfile function
    } catch {
      // Error handling is done in the hook
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (step === 'profile-setup') {
      setStep('role')
      setSelectedRole(null)
      setName('')
      setJerseyNumber('')
      setSelectedImage(null)
      setImagePreview(null)
    }
  }

  if (step === 'role') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full mb-4">
              <span className="text-2xl">🏀</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Girls Got Game!</h1>
            <p className="text-gray-600">Let's get you set up. Are you a player or a parent?</p>
          </div>

          <div className="space-y-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleRoleSelection('player')}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <User className="w-6 h-6" />
                <div className="text-left">
                  <div className="font-semibold">I'm a Player</div>
                  <div className="text-sm opacity-90">Track my training and connect with teammates</div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleRoleSelection('parent')}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6" />
                <div className="text-left">
                  <div className="font-semibold">I'm a Parent</div>
                  <div className="text-sm opacity-90">Support and track my child's progress</div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>

          <div className="text-center mt-6">
            <button
              onClick={signOut}
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-2 mx-auto"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full mb-4">
            {selectedRole === 'player' ? <User className="w-8 h-8 text-white" /> : <Users className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Set Up Your Profile</h1>
          <p className="text-gray-600">
            {selectedRole === 'player' 
              ? "Tell us about yourself so teammates can find you!" 
              : "Set up your profile to support your child's journey"}
          </p>
        </div>

        <div className="space-y-6">
          {/* Avatar Upload */}
          <div className="text-center">
            <div className="relative inline-block">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer overflow-hidden border-4 border-white shadow-lg relative"
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-8 h-8 text-gray-400" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  </div>
                )}
              </motion.div>
              <div className="absolute bottom-0 right-0 bg-orange-500 rounded-full p-1">
                <Upload className="w-3 h-3 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">Tap to add a photo</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {selectedRole === 'player' ? 'Your Name' : 'Your Name'} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selectedRole === 'player' ? 'Enter your full name' : 'Enter your name'}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Jersey Number (Players Only) */}
          {selectedRole === 'player' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jersey Number *
              </label>
              <input
                type="number"
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
                placeholder="Enter your jersey number (0-99)"
                min="0"
                max="99"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleComplete}
              disabled={loading || uploading || !name.trim() || (selectedRole === 'player' && !jerseyNumber.trim())}
              className="flex-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-6 rounded-lg font-medium disabled:opacity-50 hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Setting up...
                </>
              ) : (
                <>
                  Complete Setup
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}