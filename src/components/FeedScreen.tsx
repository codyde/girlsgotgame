import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, MessageCircle, Share, Plus, Trophy, Clock, Camera, X, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Post } from '../types'
import toast from 'react-hot-toast'

interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: {
    name: string | null
    avatar_url: string | null
  }
}

interface Like {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export function FeedScreen() {
  const { user, profile } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [newPost, setNewPost] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showNewPost, setShowNewPost] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [likes, setLikes] = useState<Record<string, Like[]>>({})
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [showComments, setShowComments] = useState<Record<string, boolean>>({})
  const [newComment, setNewComment] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (name, avatar_url),
          workouts:workout_id (exercise_type, points_earned, duration_minutes)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPosts(data || [])
      
      // Fetch likes and comments for each post
      if (data) {
        await Promise.all(data.map(post => Promise.all([
          fetchLikes(post.id),
          fetchComments(post.id)
        ])))
      }
    } catch (error: any) {
      toast.error('Error loading posts: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchLikes = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('*')
        .eq('post_id', postId)

      if (error) throw error
      setLikes(prev => ({ ...prev, [postId]: data || [] }))
    } catch (error: any) {
      console.error('Error fetching likes:', error)
    }
  }

  const fetchComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (name, avatar_url)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setComments(prev => ({ ...prev, [postId]: data || [] }))
    } catch (error: any) {
      console.error('Error fetching comments:', error)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Image must be less than 5MB')
        return
      }
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => setImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user!.id}-${Date.now()}.${fileExt}`
      const filePath = `posts/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error: any) {
      toast.error('Error uploading image: ' + error.message)
      return null
    }
  }

  const createPost = async () => {
    if (!user || (!newPost.trim() && !selectedImage)) return

    try {
      setUploading(true)
      let imageUrl = null

      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage)
        if (!imageUrl) return
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: newPost.trim() || '',
          image_url: imageUrl
        })

      if (error) throw error

      setNewPost('')
      setSelectedImage(null)
      setImagePreview(null)
      setShowNewPost(false)
      fetchPosts()
      toast.success('Post shared!')
    } catch (error: any) {
      toast.error('Error creating post: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const toggleLike = async (postId: string) => {
    if (!user) return

    try {
      const postLikes = likes[postId] || []
      const existingLike = postLikes.find(like => like.user_id === user.id)

      if (existingLike) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('id', existingLike.id)

        if (error) throw error
        setLikes(prev => ({
          ...prev,
          [postId]: postLikes.filter(like => like.id !== existingLike.id)
        }))
      } else {
        // Like
        const { data, error } = await supabase
          .from('likes')
          .insert({ post_id: postId, user_id: user.id })
          .select()
          .single()

        if (error) throw error
        setLikes(prev => ({
          ...prev,
          [postId]: [...postLikes, data]
        }))
      }
    } catch (error: any) {
      toast.error('Error updating like: ' + error.message)
    }
  }

  const addComment = async (postId: string) => {
    if (!user || !newComment[postId]?.trim()) return

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: newComment[postId].trim()
        })
        .select(`
          *,
          profiles:user_id (name, avatar_url)
        `)
        .single()

      if (error) throw error

      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data]
      }))
      setNewComment(prev => ({ ...prev, [postId]: '' }))
    } catch (error: any) {
      toast.error('Error adding comment: ' + error.message)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const getUserInitials = (name: string | null, email: string) => {
    if (name) return name[0].toUpperCase()
    return email[0].toUpperCase()
  }

  const getUserAvatar = (userProfile: any, email: string) => {
    if (userProfile?.avatar_url) {
      return (
        <img
          src={userProfile.avatar_url}
          alt="Profile"
          className="w-10 h-10 rounded-full object-cover"
        />
      )
    }
    return (
      <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
        {getUserInitials(userProfile?.name, email)}
      </div>
    )
  }

  const isLikedByUser = (postId: string) => {
    if (!user) return false
    const postLikes = likes[postId] || []
    return postLikes.some(like => like.user_id === user.id)
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
              </div>
            </div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="pb-20 lg:pb-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 lg:p-6 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Team Feed</h1>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNewPost(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* New post modal */}
      <AnimatePresence>
        {showNewPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Share with the Team</h3>
                <button
                  onClick={() => {
                    setShowNewPost(false)
                    setSelectedImage(null)
                    setImagePreview(null)
                    setNewPost('')
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Image preview */}
              {imagePreview && (
                <div className="mb-4 relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setSelectedImage(null)
                      setImagePreview(null)
                    }}
                    className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-70 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Share your training progress, achievements, or motivate your teammates..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                rows={4}
              />

              <div className="flex items-center gap-3 mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Photo
                </button>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowNewPost(false)
                    setSelectedImage(null)
                    setImagePreview(null)
                    setNewPost('')
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createPost}
                  disabled={(!newPost.trim() && !selectedImage) || uploading}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-lg font-medium disabled:opacity-50 hover:shadow-lg transition-all"
                >
                  {uploading ? 'Sharing...' : 'Share'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posts */}
      <div className="max-w-2xl lg:mx-auto">
        {posts.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="text-4xl mb-4">🏀</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No posts yet!</h3>
            <p className="text-gray-500">Be the first to share your training progress</p>
          </div>
        ) : (
          posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white border-b border-gray-100"
            >
              {/* Post header */}
              <div className="flex items-center gap-3 p-4">
                {getUserAvatar(post.profiles, profile?.email || '')}
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {(post.profiles as any)?.name || 'Team Member'}
                  </p>
                  <p className="text-sm text-gray-500">{formatTime(post.created_at)}</p>
                </div>
              </div>

              {/* Workout badge */}
              {post.workouts && (
                <div className="px-4 pb-2">
                  <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-sm">
                    <Trophy className="w-4 h-4" />
                    <span className="capitalize">{(post.workouts as any).exercise_type}</span>
                    <span>•</span>
                    <span>+{(post.workouts as any).points_earned} pts</span>
                    <Clock className="w-3 h-3 ml-1" />
                    <span>{(post.workouts as any).duration_minutes}m</span>
                  </div>
                </div>
              )}

              {/* Post image */}
              {post.image_url && (
                <div className="w-full">
                  <img
                    src={post.image_url}
                    alt="Post content"
                    className="w-full h-auto max-h-96 object-cover"
                  />
                </div>
              )}

              {/* Post content */}
              {post.content && (
                <div className="px-4 py-3">
                  <p className="text-gray-800">{post.content}</p>
                </div>
              )}

              {/* Post actions */}
              <div className="px-4 py-3 border-t border-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-4">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center gap-2 transition-colors ${
                        isLikedByUser(post.id) 
                          ? 'text-red-500' 
                          : 'text-gray-500 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${isLikedByUser(post.id) ? 'fill-current' : ''}`} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                      className="flex items-center gap-2 text-gray-500 hover:text-blue-500 transition-colors"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 text-gray-500 hover:text-green-500 transition-colors"
                    >
                      <Share className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>

                {/* Like count */}
                {likes[post.id]?.length > 0 && (
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    {likes[post.id].length} {likes[post.id].length === 1 ? 'like' : 'likes'}
                  </p>
                )}

                {/* Comments section */}
                <AnimatePresence>
                  {showComments[post.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-gray-100 pt-3 mt-3"
                    >
                      {/* Existing comments */}
                      <div className="space-y-3 mb-3">
                        {comments[post.id]?.map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            {(comment.profiles as any)?.avatar_url ? (
                              <img
                                src={(comment.profiles as any).avatar_url}
                                alt="Profile"
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {getUserInitials((comment.profiles as any)?.name, profile?.email || '')}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="bg-gray-50 rounded-lg px-3 py-2">
                                <p className="font-semibold text-sm text-gray-900">
                                  {(comment.profiles as any)?.name || 'Team Member'}
                                </p>
                                <p className="text-gray-800">{comment.content}</p>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{formatTime(comment.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add comment */}
                      <div className="flex gap-3">
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt="Profile"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {getUserInitials(profile?.name, profile?.email || '')}
                          </div>
                        )}
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={newComment[post.id] || ''}
                            onChange={(e) => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="Add a comment..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addComment(post.id)
                              }
                            }}
                          />
                          <button
                            onClick={() => addComment(post.id)}
                            disabled={!newComment[post.id]?.trim()}
                            className="p-2 bg-orange-500 text-white rounded-full disabled:opacity-50 hover:bg-orange-600 transition-colors"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}