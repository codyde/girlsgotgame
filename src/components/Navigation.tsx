import React from 'react'
import { motion } from 'framer-motion'
import { Home, Trophy, Users, User, LogOut } from 'lucide-react'
import { Shield } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

interface NavigationProps {
  currentTab: string
  setCurrentTab: (tab: string) => void
}

export function Navigation({ currentTab, setCurrentTab }: NavigationProps) {
  const { signOut, profile } = useAuth()

  const isAdmin = profile?.email === 'codydearkland@gmail.com'
  const isParentWithChild = profile?.role === 'parent' && profile?.child_id

  const tabs = [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'training', label: 'Training', icon: Trophy },
    { id: 'leaderboard', label: 'Team', icon: Users },
    { id: 'profile', label: 'Profile', icon: User },
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
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                  isActive 
                    ? 'text-orange-600 bg-orange-50 border border-orange-200' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </motion.button>
            )
          })}
        </div>
        
        <div className="mt-auto pt-4 border-t border-gray-200">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              console.log('Desktop sign out clicked')
              signOut()
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-left"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </motion.button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50 shadow-lg">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'text-orange-600 bg-orange-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">{tab.label}</span>
              </motion.button>
            )
          })}
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              console.log('Mobile sign out clicked')
              signOut()
            }}
            className="flex flex-col items-center py-2 px-3 rounded-lg text-red-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">Exit</span>
          </motion.button>
        </div>
      </div>
    </>
  )
}