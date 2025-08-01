import React, { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { SessionProvider } from './contexts/SessionContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import logo from './assets/logo.png'
import { AuthScreen } from './components/AuthScreen'
import { InviteSignUpScreen } from './components/InviteSignUpScreen'
import { InviteRequiredScreen } from './components/InviteRequiredScreen'
import { OnboardingModal } from './components/OnboardingModal'
import { ParentDashboard } from './components/ParentDashboard'
import { FeedScreen } from './components/FeedScreen'
import { TrainingScreen } from './components/TrainingScreen'
import { GamesScreen } from './components/GamesScreen'
import { GameDetailsScreen } from './components/GameDetailsScreen'
import { TeamChatScreen } from './components/TeamChatScreen'
import { TeamScreen } from './components/TeamScreen'
import { MediaScreen } from './components/MediaScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { AdminScreen } from './components/AdminScreen'
import { Navigation } from './components/Navigation'
import { AIChatBubble } from './components/AIChatBubble'

function AppContent() {
  const { session, profile, loading } = useAuth()
  const [currentTab, setCurrentTab] = useState('feed')
  const [currentGameId, setCurrentGameId] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showNewPost, setShowNewPost] = useState(false)

  // Check for invite code in URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const invite = urlParams.get('invite')
    if (invite) {
      setInviteCode(invite)
    }
  }, [])

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
            <div className="w-64 h-64 mb-4 mx-auto">
              <img src={logo} alt="Girls Got Game" className="h-64 w-64 object-contain" />
            </div>
            <div className="text-lg font-semibold text-text-secondary font-body">Loading...</div>
          </div>
        </div>
        <Toaster position="top-center" />
      </>
    )
  }

  // Show invite signup screen if there's an invite code and user is not authenticated
  if (!session && inviteCode) {
    return (
      <>
        <InviteSignUpScreen 
          inviteCode={inviteCode} 
          onSignUpComplete={() => {
            // After successful signup, clear the invite code and let normal auth flow take over
            setInviteCode(null)
            // Remove invite parameter from URL
            const url = new URL(window.location.href)
            url.searchParams.delete('invite')
            window.history.replaceState({}, document.title, url.pathname + url.search)
          }} 
        />
        <Toaster position="top-center" />
      </>
    )
  }

  // Show normal login screen for existing users (no invite required)
  if (!session) {
    return (
      <>
        <AuthScreen />
        <Toaster position="top-center" />
      </>
    )
  }


  const navigateToGame = (gameId: string) => {
    setCurrentGameId(gameId)
    setCurrentTab('game-details')
  }

  const navigateBack = () => {
    setCurrentGameId(null)
    setCurrentTab('games')
  }

  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 'feed':
        return <FeedScreen onGameClick={navigateToGame} onNavigate={setCurrentTab} showNewPost={showNewPost} setShowNewPost={setShowNewPost} />
      case 'training':
        return <TrainingScreen />
      case 'games':
        return <GamesScreen onGameClick={navigateToGame} />
      case 'game-details':
        return currentGameId ? (
          <GameDetailsScreen gameId={currentGameId} onBack={navigateBack} />
        ) : (
          <GamesScreen onGameClick={navigateToGame} />
        )
      case 'chat':
        return <TeamChatScreen />
      case 'team':
        return <TeamScreen />
      case 'media':
        return <MediaScreen />
      case 'profile':
        return <ProfileScreen />
      case 'admin':
        return <AdminScreen onGameClick={navigateToGame} />
      case 'parent-dashboard':
        return <ParentDashboard />
      default:
        return <FeedScreen onGameClick={navigateToGame} />
    }
  }

  return (
    <div className="h-screen bg-bg-secondary overflow-hidden">
      {/* Desktop Layout */}
      <div className="hidden lg:flex h-full">
        {/* Desktop Sidebar */}
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-bg-primary shadow-lg border-r border-border-primary flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out`}>
          <div className="px-2 py-4 border-b border-border-primary relative">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2'}`}>
              <div className="w-16 h-16 flex-shrink-0">
                <img src={logo} alt="Girls Got Game" className="w-16 h-16 object-contain" />
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1">
                  <h1 className="text-2xl font-bold font-heading text-text-primary">Girls Got Game</h1>
                  <p className="text-sm font-body text-text-secondary">Basketball Community</p>
                </div>
              )}
            </div>
            
            {/* Toggle Button */}
            <button
              onClick={() => {
                console.log('Sidebar toggle clicked, current state:', sidebarCollapsed);
                setSidebarCollapsed(!sidebarCollapsed);
              }}
              className={`absolute top-1/2 -translate-y-1/2 ${sidebarCollapsed ? '-right-4' : '-right-4'} w-8 h-8 bg-bg-primary border border-border-primary rounded-full shadow-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-200 z-[100] cursor-pointer`}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
          <Navigation 
            currentTab={currentTab} 
            setCurrentTab={setCurrentTab} 
            isCollapsed={sidebarCollapsed}
            onNewPost={() => setShowNewPost(true)}
          />
        </div>
        
        {/* Desktop Main Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            {renderCurrentScreen()}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden h-screen flex bg-bg-secondary">
        <Navigation 
          currentTab={currentTab} 
          setCurrentTab={setCurrentTab}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          onNewPost={() => setShowNewPost(true)}
        />
        <main className={`flex-1 overflow-y-auto overflow-x-hidden ${mobileMenuOpen ? 'z-0' : 'z-auto'}`}>
          {renderCurrentScreen()}
        </main>
      </div>
      <Toaster position="top-center" />
      
      {/* Onboarding Modal */}
      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={() => setShowOnboarding(false)}
      />

      {/* AI Chat Bubble - Admin only */}
      <AIChatBubble />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}

export default App