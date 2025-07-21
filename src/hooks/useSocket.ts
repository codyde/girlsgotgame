import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './useAuth'

export function useSocket() {
  const { user } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!user) {
      // Disconnect if user is not authenticated
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    // Don't create a new connection if one already exists
    if (socketRef.current?.connected) {
      return
    }

    // Create socket connection
    const serverUrl = import.meta.env.DEV 
      ? 'http://localhost:3001' 
      : 'https://api.girlsgotgame.app'

    const newSocket = io(serverUrl, {
      withCredentials: true, // Use session cookies for auth
      transports: ['websocket', 'polling'],
      timeout: 10000,
    })

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id)
      setIsConnected(true)
    })

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      setIsConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
    })

    // Handle authentication errors
    newSocket.on('error', (error) => {
      console.error('Socket error:', error)
      if (error.message?.includes('Authentication')) {
        // Token might be expired, disconnect
        newSocket.disconnect()
      }
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [user])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  return { socket, isConnected }
}