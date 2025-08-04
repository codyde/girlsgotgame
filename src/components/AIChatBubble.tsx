import React, { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Mic, Square, Bot, Headphones } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

type TabType = 'chat' | 'voice'

export function AIChatBubble() {
  const { profile } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [currentTab, setCurrentTab] = useState<TabType>('chat')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [transcribedText, setTranscribedText] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Only show for admin users
  if (profile?.isAdmin !== true) {
    return null
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || message.trim()
    if (!textToSend || isLoading) return

    setMessage('')
    setIsLoading(true)

    // Add user message to chat
    const timestamp = new Date().toISOString()
    setMessages(prev => [...prev, { role: 'user', content: textToSend, timestamp }])

    try {
      // Check if it's a streaming or JSON response
      const result = await api.sendAIMessage(textToSend)
      
      if (result.error) {
        toast.error(`AI Error: ${result.error}`)
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Sorry, I encountered an error: ${result.error}`, 
          timestamp: new Date().toISOString() 
        }])
      } else if (result.data) {
        // Handle JSON response (tool calling)
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: result.data.response, 
          timestamp: result.data.timestamp || new Date().toISOString() 
        }])
      }
    } catch (error) {
      console.error('Chat error:', error)
      toast.error('Failed to send message')
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request.', 
        timestamp: new Date().toISOString() 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setAudioStream(stream)
      
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' })
        await transcribeAndSendToChat(audioBlob)
        
        // Clean up
        stream.getTracks().forEach(track => track.stop())
        setAudioStream(null)
        setMediaRecorder(null)
      }
      
      setMediaRecorder(recorder)
      recorder.start()
      setIsRecording(true)
      
      // Auto-stop recording after 60 seconds as a safety measure
      recordingTimeoutRef.current = setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop()
          setIsRecording(false)
          toast.error('Recording stopped automatically after 60 seconds')
        }
      }, 60000)
      
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Could not access microphone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
      setIsRecording(false)
      
      // Clear the timeout
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current)
        recordingTimeoutRef.current = null
      }
    }
  }

  const transcribeAndSendToChat = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true)
      const result = await api.transcribeAudio(audioBlob)
      
      if (result.error) {
        toast.error(`Transcription error: ${result.error}`)
      } else if (result.data?.text) {
        const transcribedText = result.data.text
        setTranscribedText(transcribedText)
        
        // Switch to chat tab
        setCurrentTab('chat')
        
        // Set the transcribed text in the message input and send it
        setMessage(transcribedText)
        
        // Small delay to ensure UI updates, then send
        setTimeout(() => {
          sendMessage(transcribedText)
        }, 100)
        
        toast.success('Audio transcribed and sent!')
      }
    } catch (error) {
      console.error('Transcription error:', error)
      toast.error('Failed to transcribe audio')
    } finally {
      setIsTranscribing(false)
    }
  }

  const clearTranscription = () => {
    setTranscribedText('')
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50"
        title="AI Assistant"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[36rem] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-xl">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <h3 className="font-semibold">AI Assistant</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white hover:text-gray-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setCurrentTab('chat')}
          className={`flex-1 py-3 px-4 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
            currentTab === 'chat'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Chat
        </button>
        <button
          onClick={() => setCurrentTab('voice')}
          className={`flex-1 py-3 px-4 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
            currentTab === 'voice'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Headphones className="w-4 h-4" />
          Voice
        </button>
      </div>

      {/* Chat Tab Content */}
      {currentTab === 'chat' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Bot className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Ask me anything about the app!</p>
                <p className="text-sm mt-1">I can help create games, answer questions, and more.</p>
              </div>
            )}
            
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  msg.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <div className="text-sm">{msg.content}</div>
                  <div className={`text-xs mt-1 ${
                    msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-gray-600">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-end gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!message.trim() || isLoading}
                className="bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Voice Tab Content */}
      {currentTab === 'voice' && (
        <div className="flex-1 p-6 space-y-6">
          {/* Recording Controls */}
          <div className="text-center">
            <div className="mb-4">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
                isRecording ? 'bg-red-100 animate-pulse' : 'bg-blue-100'
              }`}>
                {isRecording ? (
                  <Square className="w-8 h-8 text-red-500" />
                ) : (
                  <Mic className="w-8 h-8 text-blue-500" />
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              {/* Hold-to-Record Button */}
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={isTranscribing || isLoading}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed ${
                  isRecording 
                    ? 'bg-red-500 text-white hover:bg-red-600 scale-105' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {isRecording ? 'Release to Send' : isTranscribing ? 'Transcribing...' : 'Hold to Record'}
              </button>
              
              {isRecording && (
                <p className="text-sm text-red-600 flex items-center justify-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  Recording... will send when released
                </p>
              )}
            </div>
          </div>


          {/* Instructions */}
          <div className="text-center text-gray-500 text-sm">
            <p><strong>Hold to Record:</strong> Press and hold the button to record.</p>
            <p>Release to automatically transcribe and send to chat.</p>
          </div>
        </div>
      )}
    </div>
  )
}