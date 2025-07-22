import React, { useState, useEffect, useRef } from 'react'
import { Send, ChevronDown, Search, Users, MessageCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Team, ChatMessage, DMUser } from '../types'
import { useSocket } from '../hooks/useSocket'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

export function TeamChatScreen() {
  const { user } = useAuth()
  const { socket, isConnected } = useSocket()
  const [chatMode, setChatMode] = useState<'team' | 'dm'>('team')
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [selectedDMUser, setSelectedDMUser] = useState<DMUser | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [searchResults, setSearchResults] = useState<DMUser[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load teams when component mounts
  useEffect(() => {
    loadTeams()
  }, [])

  // Set up default team when teams are loaded
  useEffect(() => {
    if (teams.length > 0 && !selectedTeam && chatMode === 'team') {
      // Just select the first team the user is a member of
      const defaultTeam = teams[0]
      console.log('Setting default team:', defaultTeam, 'from teams:', teams)
      setSelectedTeam(defaultTeam)
    }
  }, [teams, selectedTeam, chatMode])

  // Load messages when team/DM selection changes
  useEffect(() => {
    if (chatMode === 'team' && selectedTeam) {
      loadTeamMessages(selectedTeam.id)
      if (socket) {
        socket.emit('join_team', selectedTeam.id)
      }
    } else if (chatMode === 'dm' && selectedDMUser) {
      loadDMMessages(selectedDMUser.id)
    }
  }, [selectedTeam, selectedDMUser, chatMode, socket])

  // Socket event listeners
  useEffect(() => {
    if (!socket) return

    const handleTeamMessage = (message: ChatMessage) => {
      if (chatMode === 'team' && selectedTeam && message.teamId === selectedTeam.id) {
        setMessages(prev => [...prev, message])
      }
    }

    const handleDirectMessage = (message: ChatMessage) => {
      if (chatMode === 'dm' && selectedDMUser && 
          (message.senderId === selectedDMUser.id || message.recipientId === selectedDMUser.id)) {
        setMessages(prev => [...prev, message])
      }
    }

    socket.on('team_message', handleTeamMessage)
    socket.on('direct_message', handleDirectMessage)

    return () => {
      socket.off('team_message', handleTeamMessage)
      socket.off('direct_message', handleDirectMessage)
    }
  }, [socket, chatMode, selectedTeam, selectedDMUser])

  const loadTeams = async () => {
    try {
      const response = await api.request('/chat/teams')
      if (response.data) {
        console.log('Loaded teams:', response.data)
        setTeams(response.data)
      } else {
        console.error('Error loading teams:', response.error)
        toast.error('Failed to load teams')
      }
    } catch (error) {
      console.error('Error loading teams:', error)
      toast.error('Failed to load teams')
    }
  }

  const loadTeamMessages = async (teamId: string) => {
    try {
      const response = await api.request(`/chat/teams/${teamId}/messages`)
      if (response.data) {
        setMessages(response.data)
      } else {
        console.error('Error loading team messages:', response.error)
        toast.error('Failed to load messages')
      }
    } catch (error) {
      console.error('Error loading team messages:', error)
      toast.error('Failed to load messages')
    }
  }

  const loadDMMessages = async (otherUserId: string) => {
    try {
      const response = await api.request(`/chat/messages/dm/${otherUserId}`)
      if (response.data) {
        setMessages(response.data)
      } else {
        console.error('Error loading DM messages:', response.error)
        toast.error('Failed to load messages')
      }
    } catch (error) {
      console.error('Error loading DM messages:', error)
      toast.error('Failed to load messages')
    }
  }

  const searchUsers = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([])
      return
    }

    try {
      const response = await api.request(`/chat/users/search?q=${encodeURIComponent(query)}`)
      if (response.data) {
        setSearchResults(response.data.filter((u: DMUser) => u.id !== user?.id)) // Exclude current user
      }
    } catch (error) {
      console.error('Error searching users:', error)
    }
  }

  const sendMessage = () => {
    if (!newMessage.trim() || !socket || !user) return

    if (chatMode === 'team' && selectedTeam) {
      socket.emit('team_message', {
        teamId: selectedTeam.id,
        content: newMessage.trim(),
      })
    } else if (chatMode === 'dm' && selectedDMUser) {
      socket.emit('direct_message', {
        recipientId: selectedDMUser.id,
        content: newMessage.trim(),
      })
    }

    setNewMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between p-4 lg:p-6 border-b border-border-primary bg-bg-primary">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl lg:text-4xl font-bold font-heading text-text-primary">Team Chat</h1>
        </div>
        
        {/* Connection status */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-body ${
          isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Chat Mode Selector */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors font-body"
          >
            <div className="flex items-center gap-2">
              {chatMode === 'team' ? (
                <>
                  <Users className="w-5 h-5 text-primary-600" />
                  <span className="font-medium font-body">
                    {selectedTeam ? selectedTeam.name : 'Select Team'}
                  </span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                  <span className="font-medium font-body">
                    {selectedDMUser ? selectedDMUser.name : 'Direct Message'}
                  </span>
                </>
              )}
            </div>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
              {/* Team channels */}
              <div className="border-b border-gray-100">
                <div className="px-3 py-2 text-xs font-medium font-body text-gray-500 uppercase tracking-wide bg-gray-50">
                  Team Channels
                </div>
                {teams.length === 0 ? (
                  <div className="p-3 text-sm font-body text-gray-500">
                    No teams available. Ask an admin to add you to a team.
                  </div>
                ) : (
                  teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => {
                        setChatMode('team')
                        setSelectedTeam(team)
                        setSelectedDMUser(null)
                        setIsDropdownOpen(false)
                      }}
                      className="flex items-center gap-2 w-full p-3 hover:bg-gray-50 transition-colors text-left font-body"
                    >
                      <Users className="w-5 h-5 text-primary-600" />
                      <div>
                        <div className="font-medium font-body">{team.name}</div>
                        {team.description && (
                          <div className="text-xs font-body text-gray-500">{team.description}</div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
              
              {/* Direct Message option */}
              <button
                onClick={() => {
                  setChatMode('dm')
                  setIsDropdownOpen(false)
                  setSelectedTeam(null)
                  setIsUserSearchOpen(true)
                }}
                className="flex items-center gap-2 w-full p-3 hover:bg-gray-50 transition-colors font-body"
              >
                <MessageCircle className="w-5 h-5 text-blue-600" />
                <span className="font-body">Direct Message</span>
              </button>
            </div>
          )}
        </div>

        {/* User Search for DM */}
        {chatMode === 'dm' && (
          <div className="mt-3 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value)
                  searchUsers(e.target.value)
                  setIsUserSearchOpen(true)
                }}
                onFocus={() => setIsUserSearchOpen(true)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-body"
              />
            </div>

            {isUserSearchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedDMUser(user)
                      setUserSearch(user.name)
                      setIsUserSearchOpen(false)
                      setSearchResults([])
                    }}
                    className="flex items-center gap-3 w-full p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 font-body"
                  >
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium font-body text-primary-600">
                        {user.name?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium font-body text-gray-900">{user.name}</div>
                      <div className="text-sm font-body text-gray-500">{user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="font-body">No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex justify-start">
              <div className="max-w-xs lg:max-w-md xl:max-w-lg bg-gray-100 text-gray-900 rounded-lg px-4 py-2 shadow-sm font-body">
                <div className="text-xs font-medium font-body text-gray-600 mb-1">
                  {message.senderName}
                </div>
                <div className="text-sm font-body">{message.content}</div>
                <div className="text-xs mt-1 font-body text-gray-500">
                  {formatMessageTime(message.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder={
              chatMode === 'team' && selectedTeam
                ? `Message ${selectedTeam.name}...`
                : chatMode === 'dm' && selectedDMUser
                ? `Message ${selectedDMUser.name}...`
                : 'Select a chat to start messaging...'
            }
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!isConnected || (chatMode === 'team' && !selectedTeam) || (chatMode === 'dm' && !selectedDMUser)}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-50 disabled:text-gray-400 font-body"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected || (chatMode === 'team' && !selectedTeam) || (chatMode === 'dm' && !selectedDMUser)}
            className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-body"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}