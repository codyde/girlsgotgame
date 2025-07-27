import React, { useState } from 'react'
import { Home, Trophy, Users, User as UserIcon, LogOut, MessageCircle, Menu, X, UserPlus, Calendar, Image } from 'lucide-react'
import { Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/logo.png'
import { InviteDialog } from './InviteDialog'

interface NavigationProps {
  currentTab: string
  setCurrentTab: (tab: string) => void
}

export function Navigation({ currentTab, setCurrentTab }: NavigationProps) {
  const { signOut, user, profile } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  const isAdmin = user?.email === 'codydearkland@gmail.com'
  const isParent = profile?.role === 'parent'
  const isVerified = profile?.isVerified === true
  const canCreateInvites = isVerified && (isAdmin || isParent)

  // For unverified users, show feed and profile tabs only
  const tabs = isVerified ? [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'training', label: 'Training', icon: Trophy },
    { id: 'games', label: 'Games', icon: Calendar },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'media', label: 'Media', icon: Image },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ] : [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ]

  // Add parent dashboard tab for verified parents
  if (isVerified && isParent) {
    tabs.splice(1, 0, { id: 'parent-dashboard', label: 'Dashboard', icon: Shield })
  }

  // Add admin tab for verified admin users
  if (isVerified && isAdmin) {
    tabs.push({ id: 'admin', label: 'Admin', icon: Shield })
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex flex-col flex-1 p-4">
        <div className="space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left font-heading ${
                  isActive 
                    ? 'text-primary-600 bg-primary-50 border border-primary-200' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium font-heading text-2xl">{tab.label}</span>
              </button>
            )
          })}
        </div>
        
        <div className="mt-auto pt-4 border-t border-border-primary">
          {canCreateInvites && (
            <button
              onClick={() => setInviteDialogOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-colors text-left font-heading mb-2"
            >
              <UserPlus className="w-5 h-5" />
              <span className="font-medium font-heading text-2xl">Create Invite</span>
            </button>
          )}
          <button
            onClick={() => {
              console.log('Desktop sign out clicked')
              signOut()
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-left font-heading"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium font-heading text-2xl">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {/* Mobile Header with Hamburger */}
        <div className="fixed top-0 left-0 right-0 bg-bg-primary border-b border-border-primary px-4 py-3 z-50 shadow-sm">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10">
                <img src={logo} alt="Girls Got Game" className="w-10 h-10 object-cover" />
              </div>
              <div>
                <h1 className="text-xl font-heading font-bold text-text-primary">Girls Got Game</h1>
              </div>
            </div>
            <div className="w-10"></div> {/* Spacer to center the title */}
          </div>
        </div>

        {/* Mobile Sidenav Overlay */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-50"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Sidenav */}
            <div className="fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-bg-primary z-50 shadow-xl transform transition-transform duration-300">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border-primary">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center">
                      <img src={logo} alt="Girls Got Game" className="w-full h-auto object-contain" />
                    </div>
                    <div>
                      <h2 className="text-lg font-heading font-bold text-text-primary">Menu</h2>
                      <p className="text-sm text-text-secondary font-body">Hi, {user?.name || 'Player'}!</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 p-2 sm:p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                  <div className="space-y-2">
                    {tabs.map((tab) => {
                      const Icon = tab.icon
                      const isActive = currentTab === tab.id
                      
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setCurrentTab(tab.id)
                            setMobileMenuOpen(false)
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left font-heading ${
                            isActive 
                              ? 'text-primary-600 bg-primary-50 border border-primary-200' 
                              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium font-heading text-2xl sm:text-2xl text-xl">{tab.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Sign Out Button */}
                <div className="p-2 sm:p-4 border-t border-border-primary">
                  {canCreateInvites && (
                    <button
                      onClick={() => {
                        setInviteDialogOpen(true)
                        setMobileMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-colors text-left font-heading mb-2"
                    >
                      <UserPlus className="w-5 h-5" />
                      <span className="font-medium font-heading text-2xl sm:text-2xl text-xl">Create Invite</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      console.log('Mobile sign out clicked')
                      signOut()
                      setMobileMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-left font-heading"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium font-heading text-2xl sm:text-2xl text-xl">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Invite Dialog */}
      <InviteDialog 
        isOpen={inviteDialogOpen} 
        onClose={() => setInviteDialogOpen(false)} 
      />
    </>
  )
}