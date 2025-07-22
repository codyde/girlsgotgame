import React, { useState } from 'react'
import { ArrowLeft, Share2, TrendingUp } from 'lucide-react'
import logo from '../assets/logo.png'
import { InviteCodeForm } from './InviteCodeForm'
import { AccessRequestForm } from './AccessRequestForm'

interface SignUpScreenProps {
  onBack: () => void
}

export function SignUpScreen({ onBack }: SignUpScreenProps) {
  const [selectedOption, setSelectedOption] = useState<'invite' | 'request' | null>(null)

  if (selectedOption === 'invite') {
    return <InviteCodeForm onBack={() => setSelectedOption(null)} />
  }

  if (selectedOption === 'request') {
    return <AccessRequestForm onBack={() => setSelectedOption(null)} />
  }

  return (
    <div className="min-h-screen relative">
      {/* Same background as AuthScreen */}
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
          className="relative bg-white/60 backdrop-blur-md rounded-2xl shadow-xl p-8 w-full max-w-md border border-white/30"
        >
          {/* Back Button */}
          <button
            onClick={onBack}
            className="absolute top-4 left-4 p-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="text-center mb-8">
            <div className="mb-6">
              <img src={logo} alt="Girls Got Game" className="mx-auto" />
            </div>
            <h2 className="text-2xl font-heading font-bold text-gray-900 mb-2">
              Join Girls Got Game
            </h2>
            <p className="text-gray-600 font-body">
              Choose how you'd like to sign up
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setSelectedOption('invite')}
              className="w-full bg-white text-gray-700 py-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-300 hover:bg-gray-50"
            >
              Enter an Invite Code
            </button>
            
            <button
              onClick={() => setSelectedOption('request')}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-medium shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-200"
            >
              Request an Invite
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left Side - Same as AuthScreen */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="relative text-left max-w-2xl">
            <div className="mb-12">
              <h1 className="text-8xl xl:text-9xl font-heading font-bold text-white mb-6 leading-tight">
                GIRLS GOT GAME
              </h1>
              <h2 className="text-xl xl:text-2xl font-sans text-white/80 font-normal">
                A Girls Basketball and Training Community
              </h2>
            </div>
            
            {/* Informational Cards */}
            <div className="grid grid-cols-2 gap-6 mt-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Share2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white font-heading mb-2">Share Your Journey</h3>
                <p className="text-white/70 font-sans text-base">Document your progress and inspire others</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white font-heading mb-2">Join the Community</h3>
                <p className="text-white/70 font-sans text-base">Connect with teammates and build friendships</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Sign Up Options */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            className="relative bg-white/60 backdrop-blur-md rounded-2xl shadow-xl p-8 w-full max-w-lg border border-white/30"
          >
            {/* Back Button */}
            <button
              onClick={onBack}
              className="absolute top-6 left-6 p-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="text-center mb-8">
              <div className="mb-6 flex justify-center">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center p-2">
                  <img src={logo} alt="Girls Got Game" className="h-28 w-28 object-cover border-4 border-white rounded-full" />
                </div>
              </div>
              <h2 className="text-3xl font-heading font-bold text-gray-900 mb-2">
                Join Girls Got Game
              </h2>
              <p className="text-gray-600 font-body">
                Choose how you'd like to sign up
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setSelectedOption('invite')}
                className="w-full bg-white text-gray-700 py-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-300 hover:bg-gray-50"
              >
                Enter an Invite Code
              </button>
              
              <button
                onClick={() => setSelectedOption('request')}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-medium shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-200"
              >
                Request an Invite
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}