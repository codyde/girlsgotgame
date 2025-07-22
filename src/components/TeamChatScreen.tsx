import React, { useState, useEffect, useRef } from 'react'
import { Send, ChevronDown, Search, Users, MessageCircle, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Team, ChatMessage, DMUser, DMConversation } from '../types'
import { useSocket } from '../hooks/useSocket'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

// Helper component for user avatars
function UserAvatar({ user, size = 'md' }: { user: { name: string; avatarUrl: string | null }, size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10', 
    lg: 'w-12 h-12'
  }
  
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    )
  }
  
  // Fallback to initials circle
  return (
    <div className={`${sizeClasses[size]} bg-orange-100 rounded-full flex items-center justify-center`}>
      <span className="text-sm font-medium font-body text-primary-600">
        {user.name?.[0]?.toUpperCase() || '?'}
      </span>
    </div>
  )
}

// Shimmer animation component
function Shimmer({ className }: { className: string }) {
  return (
    <div 
      className={`bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded ${className}`}
      style={{
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s infinite linear'
      }}
    />
  )
}

// Message loading skeleton
function MessageSkeleton({ isOwn = false }: { isOwn?: boolean }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${isOwn ? 'bg-orange-100' : 'bg-gray-100'} rounded-lg px-4 py-2 shadow-sm`}>
        <Shimmer className="h-3 w-16 mb-2" />
        <Shimmer className="h-4 w-32 mb-1" />
        <Shimmer className="h-4 w-24 mb-2" />
        <Shimmer className="h-2 w-12" />
      </div>
    </div>
  )
}

// Conversation loading skeleton
function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-gray-100">
      <Shimmer className="w-10 h-10 rounded-full" />
      <div className="flex-1">
        <Shimmer className="h-4 w-24 mb-2" />
        <Shimmer className="h-3 w-32" />
      </div>
    </div>
  )
}

// Messages loading component
function MessagesLoading() {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <MessageSkeleton />
      <MessageSkeleton isOwn />
      <MessageSkeleton />
      <MessageSkeleton />
      <MessageSkeleton isOwn />
      <MessageSkeleton />
    </div>
  )
}

export function TeamChatScreen() {
  // Add shimmer animation styles
  React.useEffect(() => {
    const styleSheet = document.createElement('style')
    styleSheet.textContent = `
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `
    document.head.appendChild(styleSheet)
    
    return () => {
      document.head.removeChild(styleSheet)
    }
  }, [])
  const { user } = useAuth()
  const { socket, isConnected } = useSocket()
  const [chatMode, setChatMode] = useState<'team' | 'dm'>('team')
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [selectedDMUser, setSelectedDMUser] = useState<DMUser | DMConversation | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [searchResults, setSearchResults] = useState<DMUser[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false)
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([])
  const [isMobileThreadView, setIsMobileThreadView] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
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

  // Load conversations when component mounts
  useEffect(() => {
    loadDMConversations()
  }, [])

  // Clear messages and load new ones when mode or selection changes
  useEffect(() => {
    // Clear messages immediately when switching
    setMessages([])
    
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
      // Always update the conversation list when a DM is received
      loadDMConversations()
      
      // If we're in DM mode and viewing the conversation this message belongs to, add it to messages
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
    setIsLoadingMessages(true)
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
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const loadDMMessages = async (otherUserId: string) => {
    setIsLoadingMessages(true)
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
    } finally {
      setIsLoadingMessages(false)
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

  const loadDMConversations = async () => {
    setIsLoadingConversations(true)
    try {
      const response = await api.request('/chat/conversations')
      if (response.data) {
        setDmConversations(response.data)
      }
    } catch (error) {
      console.error('Error loading DM conversations:', error)
      toast.error('Failed to load conversations')
    } finally {
      setIsLoadingConversations(false)
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
      // Refresh conversation list to update the last message preview
      setTimeout(() => loadDMConversations(), 100)
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
          <h1 className="text-3xl lg:text-4xl font-bold font-heading text-text-primary">Chat</h1>
        </div>
        
        {/* Connection status */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-body ${
          isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* New Chat Mode Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-4">
          {/* Team Dropdown on Left */}
          <div className="flex-1 relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors font-body"
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-600" />
                <span className="font-medium font-body">
                  {selectedTeam ? selectedTeam.name : 'Select Team'}
                </span>
              </div>
              <ChevronDown className="w-5 h-5 text-gray-400" />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
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
                        setIsMobileThreadView(false)
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
            )}
          </div>

          {/* Direct Messages Button on Right */}
          <button
            onClick={() => {
              setChatMode('dm')
              setSelectedTeam(null)
              setIsMobileThreadView(false)
            }}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors font-body ${
              chatMode === 'dm'
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="hidden sm:inline">Direct Messages</span>
            <span className="sm:hidden">DMs</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex">
        {chatMode === 'team' ? (
          /* Team Chat View */
          <div className="flex-1 flex flex-col">
            {/* Messages Area */}
            {isLoadingMessages ? (
              <MessagesLoading />
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
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
            )}

            {/* Team Message Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder={selectedTeam ? `Message ${selectedTeam.name}...` : 'Select a team to start messaging...'}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={!isConnected || !selectedTeam}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-50 disabled:text-gray-400 font-body"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || !isConnected || !selectedTeam}
                  className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-body"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* DM View */
          <div className="flex-1 flex">
            {/* DM Conversations List - Hidden on mobile when in thread view */}
            <div className={`w-full md:w-1/3 lg:w-1/4 border-r border-gray-200 ${isMobileThreadView ? 'hidden md:block' : 'block'}`}>
              <div className="p-4 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value)
                      searchUsers(e.target.value)
                      setIsUserSearchOpen(true)
                    }}
                    onFocus={() => setIsUserSearchOpen(true)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-body text-sm"
                  />
                </div>

                {isUserSearchOpen && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          const dmUser: DMUser = {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            avatarUrl: user.avatarUrl
                          }
                          setSelectedDMUser(dmUser)
                          setUserSearch('')
                          setIsUserSearchOpen(false)
                          setSearchResults([])
                          setIsMobileThreadView(true)
                        }}
                        className="flex items-center gap-3 w-full p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 font-body"
                      >
                        <UserAvatar user={user} size="sm" />
                        <div className="text-left">
                          <div className="font-medium font-body text-gray-900">{user.name}</div>
                          <div className="text-xs font-body text-gray-500">{user.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="overflow-y-auto">
                {isLoadingConversations ? (
                  <div>
                    <ConversationSkeleton />
                    <ConversationSkeleton />
                    <ConversationSkeleton />
                    <ConversationSkeleton />
                    <ConversationSkeleton />
                  </div>
                ) : dmConversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-body">No conversations yet. Search for users above to start chatting!</p>
                  </div>
                ) : (
                  dmConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => {
                        setSelectedDMUser(conversation)
                        setIsMobileThreadView(true)
                      }}
                      className={`flex items-center gap-3 w-full p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left ${
                        selectedDMUser?.id === conversation.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <UserAvatar user={conversation} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium font-body text-gray-900 truncate">{conversation.name}</div>
                        <div className="text-sm font-body text-gray-500 truncate">
                          <span className="font-medium">{conversation.lastMessageSenderName}:</span>{' '}
                          {conversation.lastMessageContent.length > 30 
                            ? conversation.lastMessageContent.substring(0, 30) + '...'
                            : conversation.lastMessageContent
                          }
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* DM Chat Content - Full width on mobile when in thread view */}
            <div className={`flex-1 flex flex-col ${!selectedDMUser && !isMobileThreadView ? 'hidden md:flex' : 'flex'}`}>
              {selectedDMUser ? (
                <>
                  {/* DM Header with back button on mobile */}
                  <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                    <button
                      onClick={() => setIsMobileThreadView(false)}
                      className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <UserAvatar user={selectedDMUser} size="sm" />
                    <div>
                      <h3 className="font-medium font-body text-gray-900">{selectedDMUser.name}</h3>
                      <p className="text-sm font-body text-gray-500">{selectedDMUser.email}</p>
                    </div>
                  </div>

                  {/* DM Messages */}
                  {isLoadingMessages ? (
                    <MessagesLoading />
                  ) : (
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
                  )}

                  {/* DM Message Input */}
                  <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder={`Message ${selectedDMUser.name}...`}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={!isConnected}
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-50 disabled:text-gray-400 font-body"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || !isConnected}
                        className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-body"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="font-body">Select a conversation to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}