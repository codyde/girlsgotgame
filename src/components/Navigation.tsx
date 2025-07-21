import React, { useState } from 'react'
import { Home, Trophy, Users, User as UserIcon, LogOut, MessageCircle, Menu, X } from 'lucide-react'
import { Shield } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

interface NavigationProps {
  currentTab: string
  setCurrentTab: (tab: string) => void
}

export function Navigation({ currentTab, setCurrentTab }: NavigationProps) {
  const { signOut, user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isAdmin = user?.email === 'codydearkland@gmail.com'
  const isParentWithChild = user?.role === 'parent' && user?.childId

  const tabs = [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'training', label: 'Training', icon: Trophy },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'leaderboard', label: 'Team', icon: Users },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ]

  // Add parent dashboard tab for parents with assigned children
  if (isParentWithChild) {
    tabs.splice(1, 0, { id: 'parent-dashboard', label: 'Dashboard', icon: Shield })
  }

  // Add admin tab for admin users
  if (isAdmin) {
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                  isActive 
                    ? 'text-orange-600 bg-orange-50 border border-orange-200' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            )
          })}
        </div>
        
        <div className="mt-auto pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              console.log('Desktop sign out clicked')
              signOut()
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-left"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {/* Mobile Header with Hamburger */}
        <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 z-50 shadow-sm">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                🏀
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Girls Got Game</h1>
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
            <div className="fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white z-50 shadow-xl transform transition-transform duration-300">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      🏀
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Menu</h2>
                      <p className="text-sm text-gray-600">Hi, {user?.name || 'Player'}!</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 p-4">
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
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                            isActive 
                              ? 'text-orange-600 bg-orange-50 border border-orange-200' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{tab.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Sign Out Button */}
                <div className="p-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      console.log('Mobile sign out clicked')
                      signOut()
                      setMobileMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}