import React from 'react'
import { Calendar, MessageCircle, Trophy, MapPin } from 'lucide-react'
import { Game } from '../types'

interface GameCardProps {
  game: Game
  commentCount?: number
  onClick?: () => void
}

export function GameCard({ game, commentCount = 0, onClick }: GameCardProps) {
  const isHomeGame = game.isHome
  const homeTeamName = isHomeGame ? game.teamName : game.opponentTeam
  const awayTeamName = isHomeGame ? game.opponentTeam : game.teamName
  const isCompleted = game.homeScore !== null && game.awayScore !== null

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div 
      className="bg-white rounded-xl shadow-md border border-gray-100 p-4 cursor-pointer hover:shadow-lg transition-shadow duration-200"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {formatTime(game.gameDate)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isCompleted && (
            <Trophy className="w-4 h-4 text-yellow-500" />
          )}
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            isCompleted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {isCompleted ? 'Final' : 'Scheduled'}
          </span>
        </div>
      </div>

      {/* Teams and Score */}
      <div className="flex items-center justify-center mb-4">
        <div className="flex items-center w-full max-w-md">
          {/* Home Team */}
          <div className="flex-1 text-center">
            <div className="font-bold text-lg text-gray-900 mb-1">
              {homeTeamName}
            </div>
            {isCompleted && (
              <div className="text-2xl font-bold text-primary-600">
                {game.homeScore}
              </div>
            )}
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Home
            </div>
          </div>

          {/* VS */}
          <div className="px-4">
            <div className="text-lg font-bold text-gray-400">VS</div>
          </div>

          {/* Away Team */}
          <div className="flex-1 text-center">
            <div className="font-bold text-lg text-gray-900 mb-1">
              {awayTeamName}
            </div>
            {isCompleted && (
              <div className="text-2xl font-bold text-primary-600">
                {game.awayScore}
              </div>
            )}
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Away
            </div>
          </div>
        </div>
      </div>

      {/* Game Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <MapPin className="w-4 h-4" />
          <span>{isHomeGame ? 'Home Game' : 'Away Game'}</span>
        </div>
        
        {/* Comment Count */}
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <MessageCircle className="w-4 h-4" />
          <span>{commentCount} comment{commentCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Status Text */}
      {!isCompleted && (
        <div className="mt-3 text-center">
          <span className="text-sm text-primary-600 font-medium">
            🏀 Come support the team!
          </span>
        </div>
      )}
    </div>
  )
}