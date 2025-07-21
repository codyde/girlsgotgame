import React, { createContext, useContext, useState, useEffect } from 'react'

interface SessionData {
  userId: string
  email: string
  name?: string
}

interface SessionContextType {
  session: SessionData | null
  setSession: (session: SessionData | null) => void
  isLoading: boolean
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load session from localStorage on mount
    const savedSession = localStorage.getItem('session')
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession))
      } catch (error) {
        console.error('Error parsing saved session:', error)
        localStorage.removeItem('session')
      }
    }
    setIsLoading(false)
  }, [])

  const updateSession = (newSession: SessionData | null) => {
    setSession(newSession)
    if (newSession) {
      localStorage.setItem('session', JSON.stringify(newSession))
    } else {
      localStorage.removeItem('session')
    }
  }

  return (
    <SessionContext.Provider value={{ 
      session, 
      setSession: updateSession, 
      isLoading 
    }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}