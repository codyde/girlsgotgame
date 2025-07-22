import React, { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'
import logo from '../assets/logo.png'

interface AccessRequestFormProps {
  onBack: () => void
}

export function AccessRequestForm({ onBack }: AccessRequestFormProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      toast.error('Email is required')
      return
    }

    try {
      setLoading(true)
      const { error } = await api.requestAccess(email.trim(), name.trim() || undefined, message.trim() || undefined)
      
      if (error) {
        toast.error(error)
      } else {
        setSubmitted(true)
        toast.success('Access request submitted successfully!')
      }
    } catch (error) {
      console.error('Error submitting access request:', error)
      toast.error('Failed to submit access request')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
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
        
        {/* Success Message */}
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="relative bg-white/60 backdrop-blur-md rounded-2xl shadow-xl p-8 w-full max-w-md lg:max-w-lg border border-white/30 text-center">
            <div className="mb-6">
              <img src={logo} alt="Girls Got Game" className="mx-auto h-24 w-24" />
            </div>
            <h2 className="text-2xl lg:text-3xl font-heading font-bold text-gray-900 mb-4">
              Request Submitted!
            </h2>
            <p className="text-gray-600 font-body mb-6">
              Your access request has been sent to the admin team. You'll receive an email notification once your request has been reviewed.
            </p>
            <button
              onClick={onBack}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-200"
            >
              Back to Sign Up
            </button>
          </div>
        </div>
      </div>
    )
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
            disabled={loading}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="text-center mb-8">
            <div className="mb-6">
              <img src={logo} alt="Girls Got Game" className="mx-auto" />
            </div>
            <h2 className="text-2xl font-heading font-bold text-gray-900 mb-2">
              Request Access
            </h2>
            <p className="text-gray-600 font-body">
              Fill out the form below to request access
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name (Optional)
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Message (Optional)
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Tell us why you'd like to join..."
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left Side - Same as other screens */}
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
          </div>
        </div>

        {/* Right Side - Access Request Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            className="relative bg-white/60 backdrop-blur-md rounded-2xl shadow-xl p-8 w-full max-w-lg border border-white/30"
          >
            {/* Back Button */}
            <button
              onClick={onBack}
              className="absolute top-6 left-6 p-2 text-gray-600 hover:text-gray-800 transition-colors"
              disabled={loading}
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
                Request Access
              </h2>
              <p className="text-gray-600 font-body">
                Fill out the form below to request access
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email-desktop" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email-desktop"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label htmlFor="name-desktop" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  id="name-desktop"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="message-desktop" className="block text-sm font-medium text-gray-700 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  id="message-desktop"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Tell us why you'd like to join..."
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-medium shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}