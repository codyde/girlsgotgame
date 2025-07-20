import React, { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import { AuthScreen } from './components/AuthScreen'
import { OnboardingScreen } from './components/OnboardingScreen'
import { ParentDashboard } from './components/ParentDashboard'
import { FeedScreen } from './components/FeedScreen'
import { TrainingScreen } from './components/TrainingScreen'
import { LeaderboardScreen } from './components/LeaderboardScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { AdminScreen } from './components/AdminScreen'
import { Navigation } from './components/Navigation'

function App() {
  const { user, profile, loading } = useAuth()
  const [currentTab, setCurrentTab] = useState('feed')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <AuthScreen />
        <Toaster position="top-center" />
      </>
    )
  }

  // Show onboarding if user hasn't completed it
  if (user && profile && !profile.is_onboarded) {
    return (
      <>
        <OnboardingScreen />
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
    </div>
  )
}

export default App