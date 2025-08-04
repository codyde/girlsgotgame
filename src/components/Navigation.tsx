import React, { useState } from 'react'
import { Home, Users, User as UserIcon, LogOut, Menu, X, UserPlus, Calendar, Image, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/logo.png'
import { InviteDialog } from './InviteDialog'

interface NavigationProps {
  currentTab: string
  setCurrentTab: (tab: string) => void
  isCollapsed?: boolean
  mobileMenuOpen?: boolean
  setMobileMenuOpen?: (open: boolean) => void
  onNewPost?: () => void
}

export function Navigation({ currentTab, setCurrentTab, isCollapsed = false, mobileMenuOpen = false, setMobileMenuOpen, onNewPost }: NavigationProps) {
  const { signOut, user, profile } = useAuth()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  const isAdmin = profile?.isAdmin === true
  const isParent = profile?.role === 'parent'
  const isPlayer = profile?.role === 'player'
  const isVerified = profile?.isVerified === true
  const canCreateInvites = isVerified && (isAdmin || isParent)

  // Helper function for user initials
  const getUserInitials = (name: string | null, email: string) => {
    if (name && name.length > 0) return name[0].toUpperCase()
    if (email && email.length > 0) return email[0].toUpperCase()
    return ''
  }

  // For unverified users, show feed and profile tabs only
  const tabs = isVerified ? [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'media', label: 'Media', icon: Image },
    { id: 'games', label: 'Games', icon: Calendar },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ] : [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ]

  // Add dashboard tab for verified parents and players
  if (isVerified && isParent) {
    tabs.splice(1, 0, { id: 'parent-dashboard', label: 'Dashboard', icon: Shield })
  } else if (isVerified && isPlayer) {
    tabs.splice(1, 0, { id: 'parent-dashboard', label: 'My Stats', icon: Shield })
  }

  // Add admin tab for verified admin users
  if (isVerified && isAdmin) {
    tabs.push({ id: 'admin', label: 'Admin', icon: Shield })
  }

  // Insert new post button at the top for prominence
  const renderTabsWithNewPost = (renderContext: 'desktop' | 'mobile-icons' | 'mobile-full') => {
    const tabsToRender = [...tabs]
    const newPostButton = {
      id: 'new-post',
      label: 'New Post',
      icon: Plus,
      isNewPost: true
    }
    
    // Always show New Post button for verified users (it will be handled by the floating button on mobile)
    if (renderContext !== 'mobile-icons') {
      // Place New Post at the very top for all users on desktop and mobile full nav
      tabsToRender.unshift(newPostButton)
    } else if (renderContext === 'mobile-icons' && isVerified) {
      // For mobile icons view, still add it for verified users (admins, etc.)
      tabsToRender.unshift(newPostButton)
    }
    
    return tabsToRender
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex flex-col flex-1 p-4">
        <div className="space-y-2">
          {renderTabsWithNewPost('desktop').map((tab, index) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            const isNewPostButton = (tab as any).isNewPost
            
            return (
              <div key={tab.id}>
                <button
                  onClick={() => isNewPostButton ? onNewPost?.() : setCurrentTab(tab.id)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg transition-all duration-200 text-left font-heading ${
                    isNewPostButton
                      ? 'text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                      : isActive 
                        ? 'text-primary-600 bg-primary-50 border border-primary-200' 
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                  }`}
                  title={isCollapsed ? tab.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span className="font-medium font-heading text-lg">{tab.label}</span>}
                </button>
                {isNewPostButton && <div className="h-4 border-b border-border-primary/30 mx-4"></div>}
              </div>
            )
          })}
        </div>
        
        <div className="mt-auto pt-4 border-t border-border-primary">
          {canCreateInvites && (
            <button
              onClick={() => setInviteDialogOpen(true)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-colors text-left font-heading mb-2`}
              title={isCollapsed ? 'Create Invite' : undefined}
            >
              <UserPlus className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="font-medium font-heading text-lg">Create Invite</span>}
            </button>
          )}
          <button
            onClick={() => {
              console.log('Desktop sign out clicked')
              signOut()
            }}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-left font-heading`}
            title={isCollapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="font-medium font-heading text-lg">Sign Out</span>}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {/* Mobile Collapsed Sidebar */}
        <div className={`fixed top-0 left-0 h-full w-12 bg-bg-primary border-r border-border-primary z-[90] shadow-lg transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'} relative`}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-0.5 border-b border-border-primary">
              <div className="w-10 h-8 mx-auto flex items-center justify-center">
                <img src={logo} alt="Girls Got Game" className="w-8 h-8 object-contain" />
              </div>
            </div>
            
            {/* Navigation Icons */}
            <div className="flex-1 p-1 overflow-y-auto flex flex-col justify-start min-h-0">
              <div className="space-y-0.5">
                {/* Expand Button */}
                {!mobileMenuOpen && (
                  <button
                    onClick={() => setMobileMenuOpen?.(true)}
                    className="w-10 h-8 mx-auto flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-200 flex-shrink-0"
                    title="Expand menu"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                
                {renderTabsWithNewPost('mobile-icons').map((tab) => {
                  const Icon = tab.icon
                  const isActive = currentTab === tab.id
                  const isNewPostButton = (tab as any).isNewPost
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => isNewPostButton ? onNewPost?.() : setCurrentTab(tab.id)}
                      className={`w-10 h-8 mx-auto flex items-center justify-center rounded-lg transition-all duration-200 flex-shrink-0 ${
                        isNewPostButton
                          ? 'text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-sm hover:shadow-md'
                          : isActive 
                            ? 'text-primary-600 bg-primary-50 border border-primary-200' 
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                      }`}
                      title={tab.label}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                    </button>
                  )
                })}
              </div>
            </div>
            
            {/* Bottom Actions */}
            <div className="p-1 border-t border-border-primary space-y-0.5 flex-shrink-0">
              {/* Profile Avatar */}
              <button
                onClick={() => setCurrentTab('profile')}
                className="w-10 h-8 mx-auto flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                title="Profile"
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="Profile"
                    className="w-6 h-6 rounded-full object-cover shadow-sm hover:shadow-md transition-shadow"
                    style={{ 
                      imageRendering: 'high-quality',
                      colorInterpolation: 'sRGB'
                    }}
                  />
                ) : (
                  <div className="w-6 h-6 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm hover:shadow-md transition-shadow">
                    {getUserInitials(profile?.name || null, profile?.email || '')}
                  </div>
                )}
              </button>
              {canCreateInvites && (
                <button
                  onClick={() => setInviteDialogOpen(true)}
                  className="w-10 h-8 mx-auto flex items-center justify-center rounded-lg text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-colors flex-shrink-0"
                  title="Create Invite"
                >
                  <UserPlus className="w-4 h-4 flex-shrink-0" />
                </button>
              )}
              <button
                onClick={() => {
                  console.log('Mobile sign out clicked')
                  signOut()
                }}
                className="w-10 h-8 mx-auto flex items-center justify-center rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors flex-shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>


        {/* Mobile Sidenav Overlay */}
        <div className={`fixed inset-0 z-[9999] lg:hidden ${mobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 bg-black transition-opacity duration-300 ease-in-out ${
              mobileMenuOpen ? 'bg-opacity-50' : 'bg-opacity-0'
            }`}
            onClick={() => setMobileMenuOpen?.(false)}
          />
          
          {/* Sidenav */}
          <div className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-bg-primary shadow-xl transform transition-transform duration-300 ease-in-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border-primary relative">
                  {/* Collapse Button */}
                  <button
                    onClick={() => setMobileMenuOpen?.(false)}
                    className="absolute top-1/2 -translate-y-1/2 -left-4 w-8 h-8 bg-bg-primary border border-border-primary rounded-full shadow-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-200 z-[110]"
                    title="Collapse menu"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center">
                      <img src={logo} alt="Girls Got Game" className="w-full h-auto object-contain" />
                    </div>
                    <div>
                      <h2 className="text-lg font-heading font-bold text-text-primary">Girls Got Game</h2>
                      <p className="text-sm text-text-secondary font-body">Hi, {user?.name || 'Player'}!</p>
                    </div>
                  </div>
                  <div className="w-10 h-10"></div> {/* Spacer to center content */}
                </div>

                {/* Navigation Items */}
                <div className="flex-1 p-2 sm:p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                  <div className="space-y-2">
                    {renderTabsWithNewPost('mobile-full').map((tab) => {
                      const Icon = tab.icon
                      const isActive = currentTab === tab.id
                      const isNewPostButton = (tab as any).isNewPost
                      
                      return (
                        <div key={tab.id}>
                          <button
                            onClick={() => {
                              if (isNewPostButton) {
                                onNewPost?.()
                                setMobileMenuOpen?.(false)
                              } else {
                                setCurrentTab(tab.id)
                                setMobileMenuOpen?.(false)
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left font-heading ${
                              isNewPostButton
                                ? 'text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                                : isActive 
                                  ? 'text-primary-600 bg-primary-50 border border-primary-200' 
                                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="font-medium font-heading text-2xl sm:text-2xl text-xl">{tab.label}</span>
                          </button>
                          {isNewPostButton && <div className="h-4 border-b border-border-primary/30 mx-4"></div>}
                        </div>
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
                        setMobileMenuOpen?.(false)
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
                      setMobileMenuOpen?.(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-left font-heading"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium font-heading text-2xl sm:text-2xl text-xl">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Invite Dialog */}
      <InviteDialog 
        isOpen={inviteDialogOpen} 
        onClose={() => setInviteDialogOpen(false)} 
      />
    </>
  )
}