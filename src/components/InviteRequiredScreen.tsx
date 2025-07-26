import React from 'react'
import logo from '../assets/logo.png'
import { Lock, Mail } from 'lucide-react'

export function InviteRequiredScreen() {
  return (
    <div className="min-h-screen relative">
      {/* Basketball themed background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.pexels.com/photos/1752757/pexels-photo-1752757.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop')`,
          filter: 'blur(6px)',
        }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/50 to-purple-600/50"></div>
      
      {/* Mobile Layout */}
      <div className="lg:hidden min-h-screen flex items-center justify-center p-4">
        <div
          className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-full max-w-md border border-white/20"
        >
          <div className="text-center">
            <div className="mb-6">
              <img src={logo} alt="Girls Got Game" className="mx-auto" />
            </div>
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-orange-600" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-gray-900 mb-2">
              Invite Required
            </h1>
            <p className="text-gray-600 text-sm mb-6">
              Girls Got Game is an invite-only community. You need an invite link from a current member to join.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">How to get an invite:</span>
              </div>
              <p className="text-sm text-gray-600">
                Ask a parent or team member to send you an invite link. They can create one from their account dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left Side - Branding */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="relative text-left max-w-2xl">
            <div className="mb-12">
              <h1 className="text-8xl xl:text-9xl font-heading font-bold text-white mb-6 leading-tight">
                GIRLS GOT GAME
              </h1>
              <h2 className="text-xl xl:text-2xl font-sans text-white/80 font-normal">
                An Invite-Only Basketball Community
              </h2>
            </div>
          </div>
        </div>

        {/* Right Side - Invite Required Message */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-full max-w-lg border border-white/20"
          >
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-44 h-44 bg-white rounded-full flex items-center justify-center p-2">
                  <img src={logo} alt="Girls Got Game" className="h-40 w-40 object-cover border-4 border-white rounded-full" />
                </div>
              </div>

              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-orange-600" />
              </div>

              <h1 className="text-3xl font-heading font-bold text-gray-900 mb-2">
                Invite Required
              </h1>
              <p className="text-gray-600 mb-6">
                Girls Got Game is an invite-only community. You need an invite link from a current member to join.
              </p>

              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <Mail className="w-6 h-6 text-gray-600" />
                  <span className="font-medium text-gray-900 text-lg">How to get an invite:</span>
                </div>
                <p className="text-gray-600">
                  Ask a parent or team member to send you an invite link. They can create one from their account dashboard and share it with you.
                </p>
              </div>

              <p className="text-sm text-gray-500">
                Once you have an invite link, click it to create your account and join the community.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}