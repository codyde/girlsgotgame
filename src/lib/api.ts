// API client to replace Supabase calls
const API_BASE_URL = (import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://api.girlsgotgame.app' : 'http://localhost:3001')
) + '/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include', // Include cookies for auth
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Don't log 401 errors as they're expected when user isn't authenticated
        if (response.status !== 401) {
          console.error(`API request failed [${response.status}]:`, errorData.error || `HTTP ${response.status}`);
        }
        
        return { error: errorData.error || `HTTP ${response.status}` };
      }

      // Handle 204 No Content responses (successful DELETE operations)
      if (response.status === 204) {
        return { data: null as T };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      console.error('API request failed:', error);
      return { error: 'Network error' };
    }
  }

  // Auth endpoints
  async getCurrentSession() {
    return this.request('/me');
  }

  async signInWithGoogle() {
    // This will redirect to Google OAuth using Better Auth format
    window.location.href = `${this.baseUrl}/auth/sign-in/social/google`;
  }

  async signOut() {
    return this.request('/auth/sign-out', { method: 'POST' });
  }

  // Profile endpoints
  async getProfile() {
    return this.request('/profiles/me');
  }

  async createProfile(profile: any) {
    return this.request('/profiles', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  }

  async updateProfile(updates: any) {
    return this.request('/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async getLeaderboard() {
    return this.request('/profiles/leaderboard');
  }

  async getPlayerProfiles() {
    return this.request('/profiles/players');
  }

  async getMyChildren() {
    return this.request('/profiles/my-children');
  }

  async getProfileById(id: string) {
    return this.request(`/profiles/${id}`);
  }

  // Workout endpoints
  async getWorkouts(limit = 20, offset = 0) {
    return this.request(`/workouts?limit=${limit}&offset=${offset}`);
  }

  async getWorkoutsByUserId(userId: string, limit = 20, offset = 0) {
    return this.request(`/workouts/user/${userId}?limit=${limit}&offset=${offset}`);
  }

  async createWorkout(workout: any) {
    return this.request('/workouts', {
      method: 'POST',
      body: JSON.stringify(workout),
    });
  }

  async getWorkoutById(id: string) {
    return this.request(`/workouts/${id}`);
  }

  async deleteWorkout(id: string) {
    return this.request(`/workouts/${id}`, { method: 'DELETE' });
  }

  async getWorkoutStats() {
    return this.request('/workouts/stats/summary');
  }

  // Post endpoints
  async getFeed(limit = 20, offset = 0) {
    return this.request(`/posts/feed?limit=${limit}&offset=${offset}`);
  }

  async getUserPosts(limit = 20, offset = 0) {
    return this.request(`/posts/my-posts?limit=${limit}&offset=${offset}`);
  }

  async createPost(post: any) {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(post),
    });
  }

  async updatePost(id: string, updates: any) {
    return this.request(`/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deletePost(id: string) {
    return this.request(`/posts/${id}`, { method: 'DELETE' });
  }

  async toggleLike(postId: string) {
    return this.request(`/posts/${postId}/like`, { method: 'POST' });
  }

  async addComment(postId: string, comment: any) {
    return this.request(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(comment),
    });
  }

  async getComments(postId: string, limit = 20, offset = 0) {
    return this.request(`/posts/${postId}/comments?limit=${limit}&offset=${offset}`);
  }

  async deleteComment(commentId: string) {
    return this.request(`/posts/comments/${commentId}`, { method: 'DELETE' });
  }

  // File upload endpoints
  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/upload/file', {
      method: 'POST',
      body: formData,
      headers: {}, // Remove Content-Type to let browser set it with boundary
    });
  }

  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/upload/file', {
      method: 'POST',
      body: formData,
      headers: {}, // Remove Content-Type to let browser set it with boundary
    });
  }

  async getPresignedUrl(fileName: string, contentType: string) {
    return this.request('/upload/presigned-url', {
      method: 'POST',
      body: JSON.stringify({ fileName, contentType }),
    });
  }

  async deleteFile(key: string) {
    return this.request(`/upload/file/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  }

  // Admin endpoints
  async getAllWorkouts() {
    return this.request('/workouts/admin/all');
  }

  async getAllProfiles() {
    return this.request('/profiles/admin/all');
  }

  async getParentChildRelations() {
    return this.request('/profiles/admin/relations');
  }

  async updateChildAssignment(parentId: string, childId: string | null) {
    return this.request(`/profiles/admin/${parentId}/child`, {
      method: 'PATCH',
      body: JSON.stringify({ childId }),
    });
  }

  // New multi-child relationship endpoints
  async getParentChildRelationships() {
    return this.request('/profiles/admin/parent-child-relationships');
  }

  async addParentChildRelationship(parentId: string, childId: string) {
    return this.request('/profiles/admin/parent-child-relationships', {
      method: 'POST',
      body: JSON.stringify({ parentId, childId }),
    });
  }

  async removeParentChildRelationship(relationId: string) {
    return this.request(`/profiles/admin/parent-child-relationships/${relationId}`, {
      method: 'DELETE',
    });
  }

  // Team endpoints
  async getUserTeams() {
    return this.request('/chat/teams');
  }

  // Team management endpoints (admin only)
  async getAllTeamsAdmin() {
    return this.request('/chat/admin/teams');
  }

  async getTeamMembers(teamId: string) {
    return this.request(`/chat/teams/${teamId}/members`);
  }

  async addTeamMember(teamId: string, userId: string, role: string = 'member') {
    return this.request(`/chat/admin/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
  }

  async removeTeamMember(teamId: string, memberId: string) {
    return this.request(`/chat/admin/teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  async deleteTeam(teamId: string) {
    return this.request(`/chat/admin/teams/${teamId}`, {
      method: 'DELETE',
    });
  }

  async createTeam(name: string, description?: string) {
    return this.request('/chat/teams', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  // Invite endpoints
  async createInviteCode(inviteData: { code: string; maxUses?: number; expiresAt?: Date }) {
    return this.request('/invites/codes', {
      method: 'POST',
      body: JSON.stringify(inviteData),
    });
  }

  async validateInviteCode(code: string) {
    return this.request('/invites/validate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async useInviteCode(inviteCodeId: string) {
    return this.request('/invites/use', {
      method: 'POST',
      body: JSON.stringify({ inviteCodeId }),
    });
  }

  // User verification endpoints  
  async approveUser(userId: string) {
    return this.request(`/profiles/admin/approve/${userId}`, {
      method: 'PATCH',
    });
  }

  // Games endpoints
  async getGames() {
    return this.request('/games');
  }

  async createGame(teamName: string, isHome: boolean, opponentTeam: string, gameDate: string) {
    return this.request('/games', {
      method: 'POST',
      body: JSON.stringify({ teamName, isHome, opponentTeam, gameDate }),
    });
  }

  async updateGameScore(gameId: string, homeScore: number, awayScore: number) {
    return this.request(`/games/${gameId}/score`, {
      method: 'PATCH',
      body: JSON.stringify({ homeScore, awayScore }),
    });
  }

  async deleteGame(gameId: string) {
    return this.request(`/games/${gameId}`, {
      method: 'DELETE',
    });
  }

  async getGameDetails(gameId: string) {
    return this.request(`/games/${gameId}`);
  }

  async addGameComment(gameId: string, content: string) {
    return this.request(`/games/${gameId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async updateGameStatus(gameId: string, status: string, notes?: string) {
    return this.request(`/games/${gameId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  }

  async shareGameToFeed(gameId: string) {
    return this.request(`/games/${gameId}/share-to-feed`, {
      method: 'POST',
    });
  }

  // Game Players endpoints
  async getGamePlayers(gameId: string) {
    return this.request(`/games/${gameId}/players`);
  }

  async addRegisteredPlayerToGame(gameId: string, userId: string, jerseyNumber?: number, isStarter?: boolean) {
    return this.request(`/games/${gameId}/players`, {
      method: 'POST',
      body: JSON.stringify({ userId, jerseyNumber, isStarter }),
    });
  }

  async addManualPlayerToGame(gameId: string, name: string, jerseyNumber?: number, isStarter?: boolean, notes?: string) {
    return this.request(`/games/${gameId}/manual-players`, {
      method: 'POST',
      body: JSON.stringify({ name, jerseyNumber, isStarter, notes }),
    });
  }

  async searchManualPlayers(query: string) {
    return this.request(`/games/manual-players/search?q=${encodeURIComponent(query)}`);
  }

  async getAllManualPlayers() {
    return this.request('/games/admin/manual-players');
  }

  async linkManualPlayer(manualPlayerId: string, userId: string) {
    return this.request(`/games/admin/manual-players/${manualPlayerId}/link`, {
      method: 'PATCH',
      body: JSON.stringify({ userId }),
    });
  }

  async unlinkManualPlayer(manualPlayerId: string) {
    return this.request(`/games/admin/manual-players/${manualPlayerId}/unlink`, {
      method: 'PATCH',
    });
  }

  async linkManualPlayerToParent(manualPlayerId: string, parentId: string) {
    return this.request(`/games/admin/manual-players/${manualPlayerId}/link-parent`, {
      method: 'PATCH',
      body: JSON.stringify({ parentId }),
    });
  }

  async unlinkManualPlayerFromParent(manualPlayerId: string) {
    return this.request(`/games/admin/manual-players/${manualPlayerId}/unlink-parent`, {
      method: 'PATCH',
    });
  }

  async getMyManualPlayers() {
    return this.request('/profiles/my-manual-players');
  }

  // Game Stats endpoints
  async addPlayerStat(gameId: string, playerId: string, statType: string, value?: number, quarter?: number, timeMinute?: number) {
    return this.request(`/games/${gameId}/players/${playerId}/stats`, {
      method: 'POST',
      body: JSON.stringify({ statType, value, quarter, timeMinute }),
    });
  }

  async removePlayerStat(gameId: string, statId: string) {
    return this.request(`/games/${gameId}/stats/${statId}`, {
      method: 'DELETE',
    });
  }

  // Get games for a specific user with their stats
  async getUserGames(userId: string) {
    return this.request(`/games/user/${userId}`);
  }

  // Game Activities endpoint
  async getGameActivities(gameId: string) {
    return this.request(`/games/${gameId}/activities`);
  }

  // AI Chat endpoint with tool calling and streaming support
  async sendAIMessage(message: string, onChunk?: (chunk: string) => void, conversationId?: string): Promise<{ error?: string; data?: any }> {
    try {
      const url = `${this.baseUrl}/chat/ai`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ message, conversationId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { error: errorData.error || `HTTP ${response.status}` };
      }

      // Check if response is JSON (tool calling) or streaming
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        // Handle JSON response (tool calling)
        const data = await response.json();
        return { data, error: undefined };
      } else {
        // Handle streaming response
        if (!onChunk) {
          const text = await response.text();
          return { data: { response: text }, error: undefined };
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          return { error: 'Failed to get response reader' };
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            onChunk(chunk);
          }
          return { error: undefined };
        } finally {
          reader.releaseLock();
        }
      }
    } catch (error) {
      console.error('AI chat error:', error);
      return { error: 'Network error' };
    }
  }

  // Audio transcription endpoint
  async transcribeAudio(audioBlob: Blob) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      return this.request('/chat/transcribe', {
        method: 'POST',
        body: formData,
        headers: {}, // Remove Content-Type to let browser set it with boundary
      });
    } catch (error) {
      console.error('Transcription error:', error);
      return { error: 'Network error' };
    }
  }
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);
export default api;