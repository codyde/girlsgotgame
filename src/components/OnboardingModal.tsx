import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, User as UserIcon, ArrowRight, Camera, Upload, X, Check, Star } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import toast from 'react-hot-toast'
import { uploadAvatar, validateFileSize } from '../lib/upload'

type OnboardingStep = 'welcome' | 'role' | 'profile-setup' | 'complete'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { updateProfile } = useAuth()
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [selectedRole, setSelectedRole] = useState<'parent' | 'player' | null>(null)
  const [name, setName] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUploading, setIsUploading] = useState(false)

  const handleRoleSelection = (role: 'parent' | 'player') => {
    setSelectedRole(role)
    setStep('profile-setup')
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 16 * 1024 * 1024) { // 16MB limit to match UploadThing config
        toast.error('Image must be less than 16MB')
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

  const uploadImageToR2 = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true)
      console.log("🖼️ Starting onboarding avatar upload to R2:", file.name);
      
      const result = await uploadAvatar(file, (progress) => {
        console.log(`📊 Upload progress: ${progress.percentage}%`);
      });
      
      console.log('🖼️ Onboarding avatar upload successful:', result.url);
      return result.url;
    } catch (error: unknown) {
      console.error('🖼️ Onboarding avatar upload error:', error);
      toast.error('Error uploading image: ' + (error instanceof Error ? error.message : String(error)));
      return null;
    } finally {
      setIsUploading(false)
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
        avatarUrl = await uploadImageToR2(selectedImage)
        if (!avatarUrl) return // uploadImageToR2 handles error display
      }

      // Prepare profile updates
      const profileUpdates: Record<string, unknown> = {
        role: selectedRole,
        name: name.trim(),
        isOnboarded: true
      }

      if (avatarUrl) {
        profileUpdates.avatarUrl = avatarUrl
      }

      if (selectedRole === 'player' && jerseyNumber.trim()) {
        const jersey = parseInt(jerseyNumber.trim())
        if (isNaN(jersey) || jersey < 0 || jersey > 99) {
          toast.error('Jersey number must be between 0 and 99')
          return
        }
        profileUpdates.jerseyNumber = jersey
      }

      await updateProfile(profileUpdates)
      setStep('complete')
      
      // Close modal after showing completion for 2 seconds
      setTimeout(() => {
        onClose()
      }, 2000)
      
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
    } else if (step === 'role') {
      setStep('welcome')
    }
  }

  const getStepTitle = () => {
    switch (step) {
      case 'welcome': return 'Welcome to Girls Got Game!'
      case 'role': return 'Choose Your Role'
      case 'profile-setup': return 'Set Up Your Profile'
      case 'complete': return 'Welcome to the Team!'
      default: return ''
    }
  }

  const getStepDescription = () => {
    switch (step) {
      case 'welcome': return 'Let\'s get you set up with your basketball training journey'
      case 'role': return 'Are you a player or a parent supporting your child?'
      case 'profile-setup': return selectedRole === 'player' 
        ? 'Tell us about yourself so teammates can find you!' 
        : 'Set up your profile to support your child\'s journey'
      case 'complete': return 'Your profile is all set up and ready to go!'
      default: return ''
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && step !== 'complete' && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-orange-500 to-purple-600 p-6 text-white">
            {step !== 'complete' && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            
            <div className="text-center">
              <motion.div 
                key={step}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4"
              >
                {step === 'welcome' && <Star className="w-8 h-8" />}
                {step === 'role' && <Users className="w-8 h-8" />}
                {step === 'profile-setup' && (selectedRole === 'player' ? <UserIcon className="w-8 h-8" /> : <Users className="w-8 h-8" />)}
                {step === 'complete' && <Check className="w-8 h-8" />}
              </motion.div>
              
              <motion.h2 
                key={`title-${step}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-2xl font-bold mb-2"
              >
                {getStepTitle()}
              </motion.h2>
              
              <motion.p
                key={`desc-${step}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-white opacity-90"
              >
                {getStepDescription()}
              </motion.p>
            </div>

            {/* Progress indicator */}
            <div className="flex justify-center mt-6 space-x-2">
              {['welcome', 'role', 'profile-setup', 'complete'].map((stepName, index) => (
                <div
                  key={stepName}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    ['welcome', 'role', 'profile-setup', 'complete'].indexOf(step) >= index
                      ? 'bg-white'
                      : 'bg-white bg-opacity-30'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {step === 'welcome' && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="text-center py-8"
                >
                  <div className="text-6xl mb-6">🏀</div>
                  <p className="text-gray-600 mb-8 text-lg">
                    Track your training, connect with teammates, and level up your basketball skills!
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setStep('role')}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    Get Started
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </motion.div>
              )}

              {step === 'role' && (
                <motion.div
                  key="role"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleRoleSelection('player')}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <UserIcon className="w-6 h-6" />
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

                  <div className="pt-4">
                    <button
                      onClick={handleBack}
                      className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 'profile-setup' && (
                <motion.div
                  key="profile-setup"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
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
                        {isUploading && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                          </div>
                        )}
                      </motion.div>
                      <div className="absolute bottom-0 right-0 bg-orange-500 rounded-full p-1">
                        <Upload className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Tap to add a photo (optional)</p>
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleBack}
                      className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={loading || isUploading || !name.trim() || (selectedRole === 'player' && !jerseyNumber.trim())}
                      className="flex-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-6 rounded-xl font-medium disabled:opacity-50 hover:shadow-lg transition-all flex items-center justify-center gap-2"
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
                </motion.div>
              )}

              {step === 'complete' && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"
                  >
                    <Check className="w-8 h-8" />
                  </motion.div>
                  
                  <motion.h3
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-2xl font-bold text-gray-900 mb-2"
                  >
                    All Set!
                  </motion.h3>
                  
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-gray-600"
                  >
                    Welcome to Girls Got Game, {name}!
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}