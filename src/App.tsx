import React, { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { SessionProvider } from './contexts/SessionContext'
import { useAuth } from './hooks/useAuth'
import { AuthScreen } from './components/AuthScreen'
import { OnboardingModal } from './components/OnboardingModal'
import { ParentDashboard } from './components/ParentDashboard'
import { FeedScreen } from './components/FeedScreen'
import { TrainingScreen } from './components/TrainingScreen'
import { TeamChatScreen } from './components/TeamChatScreen'
import { LeaderboardScreen } from './components/LeaderboardScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { AdminScreen } from './components/AdminScreen'
import { Navigation } from './components/Navigation'

function AppContent() {
  const { session, profile, loading } = useAuth()
  const [currentTab, setCurrentTab] = useState('feed')
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Watch for profile changes and set onboarding state based on database value
  useEffect(() => {
    if (profile) {
      setShowOnboarding(!profile.isOnboarded)
    }
  }, [profile])

  // Show loading screen during auth checks
  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-2xl mb-4 mx-auto">
              🏀
            </div>
            <div className="text-lg font-semibold text-gray-700">Loading...</div>
          </div>
        </div>
        <Toaster position="top-center" />
      </>
    )
  }

  // Show login screen if not authenticated
  if (!session) {
    return (
      <>
        <AuthScreen />
        <Toaster position="top-center" />
      </>
    )
  }


  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 'feed':
        return <FeedScreen />
      case 'training':
        return <TrainingScreen />
      case 'chat':
        return <TeamChatScreen />
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
      <div className="lg:hidden min-h-screen bg-gray-50">
        <Navigation currentTab={currentTab} setCurrentTab={setCurrentTab} />
        <main className="pt-16">
          {renderCurrentScreen()}
        </main>
      </div>
      <Toaster position="top-center" />
      
      {/* Onboarding Modal */}
      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  )
}

function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  )
}

export default App