import React, { useState, useEffect, useRef, useCallback } from 'react'
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
    email: string
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

  const fetchAllLikes = useCallback(async (postIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('*')
        .in('post_id', postIds)

      if (error) throw error
      
      // Group likes by post_id
      const likesByPost: Record<string, Like[]> = {}
      data?.forEach(like => {
        if (!likesByPost[like.post_id]) {
          likesByPost[like.post_id] = []
        }
        likesByPost[like.post_id].push(like)
      })
      
      setLikes(likesByPost)
    } catch (error) {
      console.error('Error fetching likes:', error)
    }
  }, [])

  const fetchAllComments = useCallback(async (postIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (name, avatar_url, email)
        `)
        .in('post_id', postIds)
        .order('created_at', { ascending: true })

      if (error) throw error
      
      // Group comments by post_id
      const commentsByPost: Record<string, Comment[]> = {}
      data?.forEach(comment => {
        if (!commentsByPost[comment.post_id]) {
          commentsByPost[comment.post_id] = []
        }
        commentsByPost[comment.post_id].push(comment)
      })
      
      setComments(commentsByPost)
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }, [])

  const fetchPosts = useCallback(async () => {
    try {
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (name, avatar_url, email),
          workouts:workout_id (exercise_type, points_earned, duration_minutes)
        `)
        .order('created_at', { ascending: false })

      if (postsError) throw postsError
      setPosts(postsData || [])
      
      // Batch fetch likes and comments for all posts if we have any
      if (postsData && postsData.length > 0) {
        const postIds = postsData.map(post => post.id)
        await Promise.all([
          fetchAllLikes(postIds),
          fetchAllComments(postIds)
        ])
      }
    } catch (error) {
      toast.error('Error loading posts: ' + String(error))
    } finally {
      setLoading(false)
    }
  }, [fetchAllLikes, fetchAllComments])


  // Set up realtime subscriptions
  useEffect(() => {
    fetchPosts()

    console.log('🔄 Setting up realtime subscriptions...')

    // Create a helper function to fetch single post within the useEffect scope
    const fetchSinglePostLocal = async (postId: string) => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id (name, avatar_url, email),
            workouts:workout_id (exercise_type, points_earned, duration_minutes)
          `)
          .eq('id', postId)
          .single()

        if (error) throw error
        return data
      } catch (error) {
        console.error('Error fetching single post:', error)
        return null
      }
    }

    // Subscribe to posts changes
    const postsChannel = supabase
      .channel('public:posts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts'
        },
        async (payload) => {
          console.log('📝 Posts change received:', payload)
          
          if (payload.eventType === 'INSERT') {
            // New post added - fetch full post data and add to top
            const newPost = await fetchSinglePostLocal(payload.new.id)
            if (newPost) {
              setPosts(current => [newPost, ...current])
              // Initialize empty likes and comments for new post
              setLikes(current => ({ ...current, [newPost.id]: [] }))
              setComments(current => ({ ...current, [newPost.id]: [] }))
              console.log('✅ New post added to feed')
            }
          } else if (payload.eventType === 'DELETE') {
            // Post deleted - remove from posts
            setPosts(current => current.filter(post => post.id !== payload.old.id))
            // Clean up likes and comments
            setLikes(current => {
              const updated = { ...current }
              delete updated[payload.old.id]
              return updated
            })
            setComments(current => {
              const updated = { ...current }
              delete updated[payload.old.id]
              return updated
            })
            console.log('🗑️ Post removed from feed')
          } else if (payload.eventType === 'UPDATE') {
            // Post updated - refetch the updated post
            const updatedPost = await fetchSinglePostLocal(payload.new.id)
            if (updatedPost) {
              setPosts(current => 
                current.map(post => 
                  post.id === updatedPost.id ? updatedPost : post
                )
              )
              console.log('📝 Post updated in feed')
            }
          }
        }
      )
      .subscribe()

    // Subscribe to likes changes
    const likesChannel = supabase
      .channel('public:likes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes'
        },
        (payload) => {
          console.log('❤️ Likes change received:', payload)
          
          if (payload.eventType === 'INSERT') {
            // New like added
            const newLike = payload.new as Like
            setLikes(current => ({
              ...current,
              [newLike.post_id]: [...(current[newLike.post_id] || []), newLike]
            }))
            console.log('👍 Like added')
          } else if (payload.eventType === 'DELETE') {
            // Like removed
            const deletedLike = payload.old as Like
            setLikes(current => ({
              ...current,
              [deletedLike.post_id]: (current[deletedLike.post_id] || []).filter(
                like => like.id !== deletedLike.id
              )
            }))
            console.log('👎 Like removed')
          }
        }
      )
      .subscribe()

    // Subscribe to comments changes
    const commentsChannel = supabase
      .channel('public:comments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments'
        },
        async (payload) => {
          console.log('💬 Comments change received:', payload)
          
          if (payload.eventType === 'INSERT') {
            // New comment added - fetch with profile data
            try {
              const { data, error } = await supabase
                .from('comments')
                .select(`
                  *,
                  profiles:user_id (name, avatar_url, email)
                `)
                .eq('id', payload.new.id)
                .single()

              if (!error && data) {
                const comment = data as Comment
                setComments(current => ({
                  ...current,
                  [comment.post_id]: [...(current[comment.post_id] || []), comment]
                }))
                console.log('💬 Comment added')
              }
            } catch (error) {
              console.error('Error fetching new comment:', error)
            }
          } else if (payload.eventType === 'DELETE') {
            // Comment removed
            const deletedComment = payload.old as Comment
            setComments(current => ({
              ...current,
              [deletedComment.post_id]: (current[deletedComment.post_id] || []).filter(
                comment => comment.id !== deletedComment.id
              )
            }))
            console.log('🗑️ Comment removed')
          } else if (payload.eventType === 'UPDATE') {
            // Comment updated
            const updatedComment = payload.new as Comment
            setComments(current => ({
              ...current,
              [updatedComment.post_id]: (current[updatedComment.post_id] || []).map(
                comment => comment.id === updatedComment.id ? updatedComment : comment
              )
            }))
            console.log('📝 Comment updated')
          }
        }
      )
      .subscribe()

    // Cleanup subscriptions
    return () => {
      console.log('🔌 Cleaning up realtime subscriptions...')
      postsChannel.unsubscribe()
      likesChannel.unsubscribe()
      commentsChannel.unsubscribe()
    }
  }, [fetchPosts])

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
    } catch (error) {
      toast.error('Error uploading image: ' + String(error))
      return null
    }
  }

  const createPost = async () => {
    if (!user || (!newPost.trim() && !selectedImage)) return

    const postContent = newPost.trim() || ''
    const selectedImageFile = selectedImage
    const imagePreviewUrl = imagePreview
    
    // Optimistic update: immediately add post to UI
    const optimisticPost = {
      id: `temp-${Date.now()}`,
      user_id: user.id,
      content: postContent,
      image_url: imagePreviewUrl, // Use preview URL temporarily
      workout_id: null,
      created_at: new Date().toISOString(),
      profiles: {
        name: profile?.name || null,
        avatar_url: profile?.avatar_url || null,
        email: profile?.email || ''
      },
      workouts: null
    }

    // Add to posts immediately
    setPosts(current => [optimisticPost, ...current])
    
    // Initialize empty likes and comments for optimistic post
    setLikes(current => ({ ...current, [optimisticPost.id]: [] }))
    setComments(current => ({ ...current, [optimisticPost.id]: [] }))

    // Clear form and close modal immediately
    setNewPost('')
    setSelectedImage(null)
    setImagePreview(null)
    setShowNewPost(false)

    try {
      setUploading(true)
      let imageUrl = null

      if (selectedImageFile) {
        imageUrl = await uploadImage(selectedImageFile)
        if (!imageUrl) {
          throw new Error('Failed to upload image')
        }
        
        // Update the optimistic post with real image URL
        setPosts(current => 
          current.map(post => 
            post.id === optimisticPost.id 
              ? { ...post, image_url: imageUrl }
              : post
          )
        )
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: postContent,
          image_url: imageUrl
        })

      if (error) throw error

      toast.success('Post shared!')
      // Note: Realtime will replace our optimistic post with the real one
    } catch (error) {
      // Revert optimistic update on error
      setPosts(current => current.filter(post => post.id !== optimisticPost.id))
      setLikes(current => {
        const updated = { ...current }
        delete updated[optimisticPost.id]
        return updated
      })
      setComments(current => {
        const updated = { ...current }
        delete updated[optimisticPost.id]
        return updated
      })
      
      // Restore form state
      setNewPost(postContent)
      setSelectedImage(selectedImageFile)
      setImagePreview(imagePreviewUrl)
      setShowNewPost(true)
      
      toast.error('Error creating post: ' + String(error))
    } finally {
      setUploading(false)
    }
  }

  const toggleLike = async (postId: string) => {
    if (!user) return

    // Optimistic update: immediately update UI
    const currentLikes = likes[postId] || []
    const hasLike = currentLikes.some(like => like.user_id === user.id)
    
    if (hasLike) {
      // Optimistically remove like
      setLikes(current => ({
        ...current,
        [postId]: currentLikes.filter(like => like.user_id !== user.id)
      }))
    } else {
      // Optimistically add like
      const optimisticLike: Like = {
        id: `temp-${Date.now()}`,
        post_id: postId,
        user_id: user.id,
        created_at: new Date().toISOString()
      }
      setLikes(current => ({
        ...current,
        [postId]: [...currentLikes, optimisticLike]
      }))
    }

    try {
      // Check the actual database state to avoid 409 conflicts
      const { data: existingLikes, error: fetchError } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)

      if (fetchError) {
        console.error('Error fetching existing likes:', fetchError)
        throw fetchError
      }

      const hasExistingLike = existingLikes && existingLikes.length > 0

      if (hasExistingLike) {
        // Unlike - delete the existing like
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)

        if (error) {
          console.error('Error removing like:', error)
          throw error
        }
        console.log('👎 Like removed successfully')
      } else {
        // Like - insert new like
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: postId, user_id: user.id })

        if (error) {
          console.error('Error adding like:', error)
          throw error
        }
        console.log('👍 Like added successfully')
      }
    } catch (error: any) {
      console.error('toggleLike error:', error)
      
      // Revert optimistic update on error
      if (hasLike) {
        // Restore the like that was optimistically removed
        const revertLike: Like = {
          id: `revert-${Date.now()}`,
          post_id: postId,
          user_id: user.id,
          created_at: new Date().toISOString()
        }
        setLikes(current => ({
          ...current,
          [postId]: [...(current[postId] || []), revertLike]
        }))
      } else {
        // Remove the like that was optimistically added
        setLikes(current => ({
          ...current,
          [postId]: (current[postId] || []).filter(like => like.user_id !== user.id)
        }))
      }
      
      toast.error('Error updating like: ' + (error.message || error.toString() || 'Unknown error'))
    }
  }

  const addComment = async (postId: string) => {
    if (!user || !newComment[postId]?.trim()) return

    const commentContent = newComment[postId].trim()
    
    // Optimistic update: immediately add comment to UI
    const optimisticComment: Comment = {
      id: `temp-${Date.now()}`,
      post_id: postId,
      user_id: user.id,
      content: commentContent,
      created_at: new Date().toISOString(),
      profiles: {
        name: profile?.name || null,
        avatar_url: profile?.avatar_url || null,
        email: profile?.email || ''
      }
    }

    setComments(current => ({
      ...current,
      [postId]: [...(current[postId] || []), optimisticComment]
    }))

    // Clear input immediately for better UX
    setNewComment(prev => ({ ...prev, [postId]: '' }))

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: commentContent
        })

      if (error) throw error

      // Note: Realtime will replace our optimistic comment with the real one
    } catch (error) {
      // Revert optimistic update on error
      setComments(current => ({
        ...current,
        [postId]: (current[postId] || []).filter(comment => comment.id !== optimisticComment.id)
      }))
      
      // Restore the comment text
      setNewComment(prev => ({ ...prev, [postId]: commentContent }))
      
      toast.error('Error adding comment: ' + String(error))
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

  const getUserAvatar = (userProfile: unknown, email: string) => {
    const profileData = userProfile as { avatar_url?: string; name?: string } | null
    if (profileData?.avatar_url) {
      return (
        <img
          src={profileData.avatar_url}
          alt="Profile"
          className="w-10 h-10 rounded-full object-cover"
        />
      )
    }
    return (
      <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
        {getUserInitials(profileData?.name || null, email)}
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
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                console.log('🔄 Manual refresh triggered')
                fetchPosts()
              }}
              className="bg-gray-100 text-gray-600 p-3 rounded-full hover:bg-gray-200 transition-all"
              title="Refresh feed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNewPost(true)}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all"
            >
              <Plus className="w-5 h-5" />
            </motion.button>
          </div>
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
      <div className="max-w-2xl lg:mx-auto px-4 pt-6">
        {posts.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="text-4xl mb-4">🏀</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No posts yet!</h3>
            <p className="text-gray-500">Be the first to share your training progress</p>
          </div>
        ) : (
          posts.map((post, index) => {
            const postProfiles = post.profiles as { name?: string; avatar_url?: string; email?: string } | null
            const postWorkouts = post.workouts as { exercise_type?: string; points_earned?: number; duration_minutes?: number } | null
            const isOptimistic = post.id.startsWith('temp-')
            
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 border mb-4 overflow-hidden ${
                  isOptimistic ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100'
                }`}
              >
                {/* Post header */}
                <div className="flex items-center gap-3 p-4">
                  {getUserAvatar(post.profiles, profile?.email || '')}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {postProfiles?.name || postProfiles?.email?.split('@')[0] || 'Unknown User'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatTime(post.created_at)}
                      {isOptimistic && <span className="ml-1 text-orange-500">• Sharing...</span>}
                    </p>
                  </div>
                </div>

                {/* Workout badge */}
                {post.workouts && (
                  <div className="px-4 pb-2">
                    <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-sm">
                      <Trophy className="w-4 h-4" />
                      <span className="capitalize">{postWorkouts?.exercise_type}</span>
                      <span>•</span>
                      <span>+{postWorkouts?.points_earned} pts</span>
                      <Clock className="w-3 h-3 ml-1" />
                      <span>{postWorkouts?.duration_minutes}m</span>
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

                  {/* Most recent comment preview */}
                  {comments[post.id]?.length > 0 && !showComments[post.id] && (
                    <div className="mb-3">
                      {(() => {
                        const mostRecentComment = comments[post.id][comments[post.id].length - 1]
                        const commentProfiles = mostRecentComment.profiles as { name?: string; avatar_url?: string; email?: string } | null
                        const isOptimistic = mostRecentComment.id.startsWith('temp-')
                        
                        return (
                          <div className={`flex gap-3 ${isOptimistic ? 'opacity-75' : ''}`}>
                            {commentProfiles?.avatar_url ? (
                              <img
                                src={commentProfiles.avatar_url}
                                alt="Profile"
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                {getUserInitials(commentProfiles?.name || null, profile?.email || '')}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                <span className="font-semibold text-gray-900">
                                  {commentProfiles?.name || commentProfiles?.email?.split('@')[0] || 'Unknown User'}
                                </span>
                                <span className="text-gray-700 ml-2">{mostRecentComment.content}</span>
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-gray-500">
                                  {formatTime(mostRecentComment.created_at)}
                                  {isOptimistic && <span className="ml-1 text-orange-500">• Sending...</span>}
                                </p>
                                {comments[post.id].length > 1 && (
                                  <button
                                    onClick={() => setShowComments(prev => ({ ...prev, [post.id]: true }))}
                                    className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                                  >
                                    View all {comments[post.id].length} comments
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
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
                          {comments[post.id]?.map((comment) => {
                            const commentProfiles = comment.profiles as { name?: string; avatar_url?: string; email?: string } | null
                            const isOptimistic = comment.id.startsWith('temp-')
                            return (
                              <div key={comment.id} className={`flex gap-3 ${isOptimistic ? 'opacity-75' : ''}`}>
                                {commentProfiles?.avatar_url ? (
                                  <img
                                    src={commentProfiles.avatar_url}
                                    alt="Profile"
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {getUserInitials(commentProfiles?.name || null, profile?.email || '')}
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div className={`rounded-lg px-3 py-2 ${isOptimistic ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
                                    <p className="font-semibold text-sm text-gray-900">
                                      {commentProfiles?.name || commentProfiles?.email?.split('@')[0] || 'Unknown User'}
                                    </p>
                                    <p className="text-gray-800">{comment.content}</p>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {formatTime(comment.created_at)}
                                    {isOptimistic && <span className="ml-1 text-orange-500">• Sending...</span>}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
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
            )
          })
        )}
      </div>
    </div>
  )
}