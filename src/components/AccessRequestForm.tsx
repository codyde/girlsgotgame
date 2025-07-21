import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, User, MessageSquare, Send, ArrowLeft, CheckCircle } from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

interface AccessRequestFormProps {
  initialEmail?: string
  onCancel?: () => void
  onSuccess: () => void
}

type FormStep = 'form' | 'submitting' | 'success'

export function AccessRequestForm({ initialEmail = '', onCancel, onSuccess }: AccessRequestFormProps) {
  const [step, setStep] = useState<FormStep>('form')
  const [formData, setFormData] = useState({
    email: initialEmail,
    name: '',
    message: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.email.trim()) {
      toast.error('Email is required')
      return
    }

    if (!formData.email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    setStep('submitting')

    try {
      const { data, error } = await api.submitAccessRequest(
        formData.email.trim(),
        formData.name.trim() || undefined,
        formData.message.trim() || undefined
      )

      if (error) {
        throw new Error(error)
      }

      setStep('success')
      toast.success('Access request submitted successfully!')
      
      // Auto-redirect after showing success
      setTimeout(() => {
        onSuccess()
      }, 3000)

    } catch (error: any) {
      console.error('Submit access request error:', error)
      toast.error(error.message || 'Failed to submit access request')
      setStep('form')
    }
  }

  if (step === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mx-auto"
        >
          <CheckCircle className="w-10 h-10 text-green-600" />
        </motion.div>
        
        <div className="space-y-3">
          <h2 className="text-2xl font-bold font-heading text-gray-900">Request Submitted!</h2>
          <p className="text-gray-600 font-body">
            Thanks for your interest in joining Girls Got Game. 
            We've received your access request and will review it soon.
          </p>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm font-body text-blue-800">
            <strong>What happens next?</strong><br />
            • Our team will review your request<br />
            • You'll receive an email with the decision<br />
            • If approved, you can create your account and join!
          </p>
        </div>

        <button
          onClick={onSuccess}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-body font-medium"
        >
          Got it, thanks!
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold font-heading text-gray-900">Request Access</h2>
        <p className="text-gray-600 font-body">
          Girls Got Game is currently invite-only. Submit your information and we'll review your request.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label className="block text-sm font-medium font-body text-gray-700 mb-2">
            Email Address *
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter your email address"
              disabled={step === 'submitting'}
              required
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-body disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Name Field */}
        <div>
          <label className="block text-sm font-medium font-body text-gray-700 mb-2">
            Full Name (optional)
          </label>
          <div className="relative">
            <User className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your full name"
              disabled={step === 'submitting'}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-body disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Message Field */}
        <div>
          <label className="block text-sm font-medium font-body text-gray-700 mb-2">
            Tell us why you'd like to join (optional)
          </label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <textarea
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Share a bit about yourself or your child's basketball journey..."
              rows={4}
              disabled={step === 'submitting'}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-body resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
          <p className="text-sm font-body text-amber-800">
            <strong>Alternative:</strong> If you know someone in the community, ask them to send you an invite code for instant access!
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={step === 'submitting'}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-body font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          
          <button
            type="submit"
            disabled={step === 'submitting' || !formData.email.trim()}
            className={`${onCancel ? 'flex-2' : 'w-full'} flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 transition-colors font-body font-medium disabled:cursor-not-allowed`}
          >
            {step === 'submitting' ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Request
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  )
}