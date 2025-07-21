import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

interface InviteCodeFormProps {
  initialCode?: string
  onBack: () => void
  onValidCode: (inviteData: any) => void
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid'

export function InviteCodeForm({ initialCode = '', onBack, onValidCode }: InviteCodeFormProps) {
  const [code, setCode] = useState(initialCode.toUpperCase())
  const [validationState, setValidationState] = useState<ValidationState>('idle')
  const [inviteData, setInviteData] = useState<any>(null)
  const [error, setError] = useState('')

  // Auto-validate if we have an initial code
  useEffect(() => {
    if (initialCode) {
      validateCode(initialCode)
    }
  }, [initialCode])

  const validateCode = async (codeToValidate: string) => {
    if (!codeToValidate.trim()) {
      setValidationState('idle')
      setError('')
      return
    }

    setValidationState('validating')
    setError('')

    try {
      const { data, error: apiError } = await api.validateInviteCode(codeToValidate)
      
      if (apiError || !data) {
        throw new Error(apiError || 'Validation failed')
      }

      if (data.valid) {
        setValidationState('valid')
        setInviteData(data.inviteCode)
        setError('')
      } else {
        setValidationState('invalid')
        setError(data.error || 'Invalid invite code')
        setInviteData(null)
      }
    } catch (error: any) {
      console.error('Invite code validation error:', error)
      setValidationState('invalid')
      setError(error.message || 'Failed to validate invite code')
      setInviteData(null)
    }
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCode = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    setCode(newCode)

    // Reset validation state when code changes
    if (validationState !== 'idle') {
      setValidationState('idle')
      setError('')
      setInviteData(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim()) {
      validateCode(code)
    }
  }

  const handleProceed = () => {
    if (validationState === 'valid' && inviteData) {
      onValidCode({ code, ...inviteData })
    }
  }

  const getInputClasses = () => {
    const base = "w-full px-4 py-3 text-center text-lg font-mono tracking-wider border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-body"
    
    if (validationState === 'valid') {
      return `${base} border-green-500 bg-green-50`
    } else if (validationState === 'invalid') {
      return `${base} border-red-500 bg-red-50`
    } else if (validationState === 'validating') {
      return `${base} border-blue-500 bg-blue-50`
    }
    
    return `${base} border-gray-300`
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full mb-4">
          <Gift className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold font-heading text-gray-900">Enter Invite Code</h2>
        <p className="text-gray-600 font-body">
          Got an invite code? Enter it below to join the Girls Got Game community!
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium font-body text-gray-700 mb-2">
            Invite Code
          </label>
          <div className="relative">
            <input
              type="text"
              value={code}
              onChange={handleCodeChange}
              placeholder="Enter 8-character code"
              maxLength={8}
              className={getInputClasses()}
              disabled={validationState === 'validating'}
            />
            
            {/* Validation indicators */}
            <div className="absolute right-3 top-3.5">
              {validationState === 'validating' && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              )}
              {validationState === 'valid' && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {validationState === 'invalid' && (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              )}
            </div>
          </div>
          
          {/* Error message */}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-sm text-red-600 font-body"
            >
              {error}
            </motion.p>
          )}
        </div>

        {/* Valid invite info */}
        {validationState === 'valid' && inviteData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 p-4 rounded-lg border border-green-200"
          >
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium font-body text-green-800">Valid Invite Code!</p>
                <p className="text-sm font-body text-green-700">
                  Invited by: <strong>{inviteData.createdBy}</strong>
                </p>
                <p className="text-sm font-body text-green-600">
                  Uses: {inviteData.usedCount}/{inviteData.maxUses}
                  {inviteData.expiresAt && (
                    <> • Expires: {new Date(inviteData.expiresAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={validationState === 'validating'}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-body font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          {validationState === 'valid' ? (
            <button
              type="button"
              onClick={handleProceed}
              className="flex-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-body font-medium"
            >
              Continue with Invite
            </button>
          ) : (
            <button
              type="submit"
              disabled={!code.trim() || validationState === 'validating'}
              className="flex-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 transition-colors font-body font-medium disabled:cursor-not-allowed"
            >
              {validationState === 'validating' ? 'Validating...' : 'Validate Code'}
            </button>
          )}
        </div>
      </form>

      {/* Help text */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <p className="text-sm font-body text-blue-800">
          <strong>Don't have an invite code?</strong><br />
          Ask someone in the community to generate one for you, or go back to request access through our approval process.
        </p>
      </div>
    </motion.div>
  )
}