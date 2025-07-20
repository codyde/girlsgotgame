import React, { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import { AuthScreen } from './components/AuthScreen'
import { OnboardingScreen } from './components/OnboardingScreen'
import { ParentDashboard } from './components/ParentDashboard'
import { FeedScreen } from './components/FeedScreen'
import { TrainingScreen } from './components/TrainingScreen'
import { LeaderboardScreen } from './components/LeaderboardScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { AdminScreen } from './components/AdminScreen'
import { Navigation } from './components/Navigation'

function AppContent() {
  const { session, user, profile, updateProfile } = useAuth()
  const [currentTab, setCurrentTab] = useState('feed')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Watch for profile changes and set onboarding state based on database value
  useEffect(() => {
    if (profile) {
      console.log('🔄 AppContent: Profile loaded, is_onboarded:', profile.is_onboarded)
      setShowOnboarding(!profile.is_onboarded)
    }
  }, [profile])

  // Show login screen if not authenticated
  if (!session) {
    return (
      <>
        <AuthScreen />
        <Toaster position="top-center" />
      </>
    )
  }

  console.log('🔍 AppContent: showOnboarding state:', showOnboarding)

  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 'feed':
        return <FeedScreen />
      case 'training':
        return <TrainingScreen />
      case 'leaderboard':
        return <LeaderboardScreen />
      case 'profile':
        return <ProfileScreen />
      case 'admin':
        return <AdminScreen />
      case 'parent-dashboard':
        return <ParentDashboard />
      default:
        return <FeedScreen />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        {/* Desktop Sidebar */}
        <div className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                🏀
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Girls Got Game</h1>
                <p className="text-sm text-gray-600">Basketball Training</p>
              </div>
            </div>
          </div>
          <Navigation currentTab={currentTab} setCurrentTab={setCurrentTab} />
        </div>
        
        {/* Desktop Main Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            {renderCurrentScreen()}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <main className="max-w-lg mx-auto bg-white min-h-screen shadow-xl pb-20">
          {renderCurrentScreen()}
          <Navigation currentTab={currentTab} setCurrentTab={setCurrentTab} />
        </main>
      </div>
      <Toaster position="top-center" />
      
      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md lg:max-w-lg border border-gray-200 max-h-[90vh] overflow-y-auto">
            <OnboardingModalContent 
              updateProfile={updateProfile}
              setShowOnboarding={setShowOnboarding}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Modal-specific onboarding component without basketball background
function OnboardingModalContent({ updateProfile, setShowOnboarding }: {
  updateProfile: (updates: any) => Promise<void>
  setShowOnboarding: (show: boolean) => void
}) {
  const [selectedRole, setSelectedRole] = useState<'player' | 'parent' | null>(null)
  const [updating, setUpdating] = useState(false)
  const [players, setPlayers] = useState<any[]>([])
  const [selectedChild, setSelectedChild] = useState<string>('')
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualEmail, setManualEmail] = useState('')
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  const fetchPlayers = async () => {
    try {
      setLoadingPlayers(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('role', 'player')
        .order('name')

      if (error) throw error
      setPlayers(data || [])
    } catch (error) {
      console.error('Error fetching players:', error)
    } finally {
      setLoadingPlayers(false)
    }
  }

  const handleRoleSelect = async (role: 'player' | 'parent') => {
    setSelectedRole(role)
    if (role === 'parent') {
      await fetchPlayers()
    }
  }

  const handleSkip = async () => {
    if (updating) return
    setUpdating(true)
    
    console.log('🔄 OnboardingModal: Skip clicked, hiding modal optimistically...')
    // Optimistically hide the modal immediately
    setShowOnboarding(false)
    
    try {
      console.log('🔄 OnboardingModal: Updating profile in database...')
      const updates: any = {
        is_onboarded: true,
        role: selectedRole || 'player' // Default to player if no role selected
      }
      
      // If parent role and has child assignment, add child_id or child_email
      if (selectedRole === 'parent') {
        if (selectedChild) {
          updates.child_id = selectedChild
        } else if (showManualEntry && manualEmail) {
          updates.child_email = manualEmail
        }
      }
      
      await updateProfile(updates)
      console.log('✅ OnboardingModal: Profile updated successfully in database')
    } catch (error) {
      console.error('❌ OnboardingModal: Error updating profile:', error)
      // If database update fails, show the modal again
      setShowOnboarding(true)
      setUpdating(false)
    }
  }

  const handleContinue = async () => {
    if (!selectedRole || updating) return
    setUpdating(true)
    
    console.log('🔄 OnboardingModal: Continue clicked, hiding modal optimistically...')
    // Optimistically hide the modal immediately
    setShowOnboarding(false)
    
    try {
      console.log('🔄 OnboardingModal: Updating profile in database...')
      const updates: any = {
        is_onboarded: true,
        role: selectedRole
      }
      
      // If parent role and has child assignment, add child_id or child_email
      if (selectedRole === 'parent') {
        if (selectedChild) {
          updates.child_id = selectedChild
        } else if (showManualEntry && manualEmail) {
          updates.child_email = manualEmail
        }
      }
      
      await updateProfile(updates)
      console.log('✅ OnboardingModal: Profile updated successfully in database')
    } catch (error) {
      console.error('❌ OnboardingModal: Error updating profile:', error)
      // If database update fails, show the modal again
      setShowOnboarding(true)
      setUpdating(false)
    }
  }

  return (
    <div className="text-center">
      <div className="mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
          🏀
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Girls Got Game!</h2>
        <p className="text-gray-600">Let's get you set up. Are you a player or a parent?</p>
      </div>

      <div className="space-y-3 mb-6">
        <button
          onClick={() => handleRoleSelect('player')}
          className={`w-full p-4 rounded-xl border-2 transition-all ${
            selectedRole === 'player'
              ? 'border-orange-500 bg-orange-50 text-orange-700'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="text-2xl">🏃‍♀️</div>
            <div className="text-left">
              <div className="font-semibold">I'm a Player</div>
              <div className="text-sm text-gray-600">Track my own training and earn points</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => handleRoleSelect('parent')}
          className={`w-full p-4 rounded-xl border-2 transition-all ${
            selectedRole === 'parent'
              ? 'border-orange-500 bg-orange-50 text-orange-700'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="text-2xl">👨‍👩‍👧</div>
            <div className="text-left">
              <div className="font-semibold">I'm a Parent</div>
              <div className="text-sm text-gray-600">Monitor my child's training progress</div>
            </div>
          </div>
        </button>
      </div>

      {/* Child Selection for Parents */}
      {selectedRole === 'parent' && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Select Your Child</h3>
          
          {!showManualEntry ? (
            <>
              {loadingPlayers ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-sm text-blue-600 mt-2">Loading players...</p>
                </div>
              ) : (
                <>
                  {players.length > 0 ? (
                    <div className="space-y-3">
                      <select
                        value={selectedChild}
                        onChange={(e) => setSelectedChild(e.target.value)}
                        className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a player...</option>
                        {players.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name || player.email.split('@')[0]} ({player.email})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowManualEntry(true)}
                        className="w-full px-4 py-2 text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                      >
                        Set manually by email address
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-blue-600 mb-3">No players registered yet</p>
                      <button
                        onClick={() => setShowManualEntry(true)}
                        className="px-4 py-2 text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Enter child's email manually
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Child's Email Address
                </label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="Enter your child's email address"
                  className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-blue-600 mt-1">
                  When your child registers with this email, you'll automatically be connected
                </p>
              </div>
              <button
                onClick={() => {
                  setShowManualEntry(false)
                  setManualEmail('')
                }}
                className="w-full px-4 py-2 text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors text-sm"
              >
                Back to player selection
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleSkip}
          disabled={updating}
          className="flex-1 px-4 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updating ? 'Updating...' : 'Skip for now'}
        </button>
        <button
          onClick={handleContinue}
          disabled={!selectedRole || updating}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updating ? 'Updating...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

function App() {
  return <AppContent />
}

export default App