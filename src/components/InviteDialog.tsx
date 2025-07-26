import React, { useState } from 'react'
import { X, Copy, Check, UserPlus } from 'lucide-react'
import { api } from '../lib/api'
import { appLogger } from '../utils/logger'
import toast from 'react-hot-toast'

interface InviteDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function InviteDialog({ isOpen, onClose }: InviteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  const generateInviteLink = async () => {
    try {
      setLoading(true)
      
      // Generate a random invite code
      const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      
      const { data, error } = await api.createInviteCode({
        code,
        maxUses: 999999, // Effectively unlimited uses
        expiresAt: null // No expiration
      })

      if (error) {
        throw new Error(error)
      }

      // Generate the invite link with the code as a query parameter
      const baseUrl = window.location.origin
      const link = `${baseUrl}?invite=${code}`
      setInviteLink(link)
      
      // Log invite link generation
      appLogger.invite.linkGenerated(code, 'current-user') // TODO: Get actual user ID
      
      toast.success('Invite link generated!')
    } catch (error: any) {
      console.error('Error generating invite link:', error)
      toast.error(error.message || 'Failed to generate invite link')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      toast.success('Link copied to clipboard!')
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      toast.error('Failed to copy link')
    }
  }

  const handleClose = () => {
    setInviteLink('')
    setCopied(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-primary rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-primary">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold text-text-primary">Create Invite</h2>
              <p className="text-sm text-text-secondary">Generate an invite link to share</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {inviteLink ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Invite Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 px-3 py-2 border border-border-primary rounded-lg bg-bg-secondary text-text-primary text-sm"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              
              <div className="bg-bg-secondary rounded-lg p-4">
                <h3 className="font-medium text-text-primary mb-2">How it works:</h3>
                <ul className="text-sm text-text-secondary space-y-1">
                  <li>• Share this link with your family members</li>
                  <li>• Anyone can sign up using this invite link</li>
                  <li>• The link never expires</li>
                  <li>• The link can be used multiple times</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Generate Invite Link
              </h3>
              <p className="text-text-secondary mb-6">
                Create a secure invite link to share with others. They'll be able to join the app using this link.
              </p>
              <button
                onClick={generateInviteLink}
                disabled={loading}
                className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Generating...' : 'Generate Invite Link'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-border-primary">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}