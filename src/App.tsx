import React, { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { SessionProvider } from './contexts/SessionContext'
import { ThemeProvider } from './contexts/ThemeContext'
import logo from './assets/logo.png'
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
        <div className="min-h-screen bg-bg-secondary flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mb-4 mx-auto">
              <img src={logo} alt="Girls Got Game" className="w-16 h-16 rounded-full shadow-lg" />
            </div>
            <div className="text-lg font-semibold text-text-secondary font-body">Loading...</div>
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
    <div className="min-h-screen bg-bg-secondary">
      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        {/* Desktop Sidebar */}
        <div className="w-64 bg-bg-primary shadow-lg border-r border-border-primary flex flex-col">
          <div className="p-6 border-b border-border-primary">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10">
                <img src={logo} alt="Girls Got Game" className="w-10 h-10 rounded-full shadow-sm" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-heading text-text-primary">Girls Got Game</h1>
                <p className="text-sm font-body text-text-secondary">Basketball Community</p>
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
      <div className="lg:hidden min-h-screen bg-bg-secondary">
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
    <ThemeProvider>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </ThemeProvider>
  )
}

export default App