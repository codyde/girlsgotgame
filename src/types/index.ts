export interface User {
  id: string
  email: string
  name: string | null
  emailVerified: boolean
  image: string | null
  avatarUrl: string | null
  totalPoints: number
  role: 'parent' | 'player'
  isAdmin: boolean
  isOnboarded: boolean
  isVerified: boolean
  jerseyNumber: number | null
  createdBy?: 'oauth' | 'manual'
  createdAt: string
  updatedAt: string
}

// Keep Profile as alias for backwards compatibility during migration
export type Profile = User


export interface Post {
  id: string
  user_id: string
  content: string | null
  image_url: string | null
  media_id: string | null
  game_id: string | null
  post_type: 'text' | 'game'
  created_at: string
  user?: User
  media?: MediaUpload
  game?: Game
}


export interface Team {
  id: string
  name: string
  description: string | null
  createdBy: string
  createdAt: string
  role?: 'admin' | 'member'
}


export interface TeamMember {
  id: string
  userId: string
  role: 'admin' | 'member'
  joinedAt: string
  userName: string
  userEmail: string
  userAvatar: string | null
  userRole: 'parent' | 'player'
}

export interface TeamWithMemberCount extends Team {
  memberCount: number
}

export interface Game {
  id: string
  teamName: string
  isHome: boolean
  opponentTeam: string
  gameDate: string
  homeScore: number | null
  awayScore: number | null
  notes: string | null
  status: 'upcoming' | 'live' | 'completed'
  isSharedToFeed: boolean
  createdAt: string
  updatedAt: string
}

export interface GameWithUserStats extends Game {
  gamePlayerId: string
  jerseyNumber: number | null
  isStarter: boolean
  stats: GameStat[]
}

export interface GameComment {
  id: string
  gameId: string
  userId: string
  content: string
  createdAt: string
  user?: User
}

export interface MediaUpload {
  id: string
  uploadedBy: string
  uploaderName?: string
  fileName: string
  originalName: string
  fileSize: number
  mimeType: string
  mediaType: 'image' | 'video'
  uploadUrl: string
  thumbnailUrl?: string
  width?: number
  height?: number
  duration?: number
  tags?: string[]
  description?: string
  isVisible: boolean
  createdAt: string
  updatedAt: string
}

export interface ManualPlayer {
  id: string
  name: string
  jerseyNumber: number | null
  linkedUserId: string | null
  linkedBy: string | null
  linkedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  linkedUser?: User
}

export interface GamePlayer {
  id: string
  gameId: string
  userId: string | null
  manualPlayerId: string | null
  jerseyNumber: number | null
  isStarter: boolean
  minutesPlayed: number
  createdAt: string
  user?: User
  manualPlayer?: ManualPlayer
  stats?: GameStat[]
}

export interface GameStat {
  id: string
  gameId: string
  gamePlayerId: string
  statType: '2pt' | '3pt' | '1pt' | 'steal' | 'rebound'
  value: number
  quarter: number | null
  timeMinute: number | null
  createdAt: string
  createdBy: string
  gamePlayer?: GamePlayer
}

export interface GameActivity {
  id: string
  gameId: string
  activityType: string
  description: string
  metadata: string | null
  performedBy: string
  createdAt: string
  performedByUser?: User
}

export interface GameWithPlayers extends Game {
  players?: GamePlayer[]
  activities?: GameActivity[]
}