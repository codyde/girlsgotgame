import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Heart, MessageCircle, Share, Plus, Trophy, Clock, Camera, X, Send, Home, RefreshCw, ZoomIn, MoreVertical, Trash2, Flag } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../hooks/useSocket'
import { Post } from '../types'
import toast from 'react-hot-toast'
import { uploadMedia, validateFileSize } from '../lib/upload'
import { GameCard } from './GameCard'

interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  createdAt?: string
  user?: {
    name: string | null
    avatarUrl: string | null
    email: string
  }
}

interface Like {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

// Helper function to detect video URLs
const isVideoUrl = (url: string): boolean => {
  // Check for common video file extensions
  const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.3gp'];
  const lowercaseUrl = url.toLowerCase();
  
  // Check file extensions
  if (videoExtensions.some(ext => lowercaseUrl.includes(ext))) {
    return true;
  }
  
  // Check MIME type if available in URL (some services include it)
  if (lowercaseUrl.includes('video/')) {
    return true;
  }
  
  return false;
};

// Component to handle media rendering with content type detection
const MediaRenderer = ({ 
  url, 
  isOptimisticVideo, 
  onImageClick 
}: { 
  url: string, 
  isOptimisticVideo?: boolean,
  onImageClick?: () => void 
}) => {
  const [mediaType, setMediaType] = useState<'video' | 'image' | 'unknown'>(
    isOptimisticVideo ? 'video' : isVideoUrl(url) ? 'video' : 'unknown'
  );

  useEffect(() => {
    // If we don't know the type, check the content type via HEAD request
    if (mediaType === 'unknown') {
      fetch(url, { method: 'HEAD' })
        .then(response => {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.startsWith('video/')) {
            setMediaType('video');
          } else {
            setMediaType('image');
          }
        })
        .catch(() => {
          // If HEAD request fails, assume it's an image
          setMediaType('image');
        });
    }
  }, [url, mediaType]);

  if (mediaType === 'video') {
    return (
      <video
        src={url}
        className="w-full h-auto max-h-96 object-contain rounded-none bg-black"
        controls
        preload="metadata"
        playsInline
        controlsList="nodownload"
      >
        Your browser does not support the video tag.
      </video>
    );
  }

  if (mediaType === 'image') {
    return (
      <div className="relative group cursor-pointer" onClick={onImageClick}>
        <img
          src={url}
          alt="Post content"
          className="w-full h-auto object-contain transition-transform duration-200 hover:scale-[1.02]"
          loading="lazy"
          style={{ 
            imageRendering: 'high-quality',
            colorInterpolation: 'sRGB'
          }}
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-50 rounded-full p-2">
            <ZoomIn className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
    );
  }

  // Loading state while determining media type
  return (
    <div className="w-full h-48 bg-gray-200 animate-pulse flex items-center justify-center">
      <span className="text-gray-500">Loading media...</span>
    </div>
  );
};

interface FeedScreenProps {
  onGameClick?: (gameId: string) => void
  onNavigate?: (tab: string) => void
  showNewPost?: boolean
  setShowNewPost?: (show: boolean) => void
}

export function FeedScreen({ onGameClick, onNavigate, showNewPost: externalShowNewPost, setShowNewPost: externalSetShowNewPost }: FeedScreenProps = {}) {
  const { user, profile } = useAuth()
  const { socket, isConnected } = useSocket()
  const isAdmin = user?.email === 'codydearkland@gmail.com'
  const [posts, setPosts] = useState<Post[]>([])
  const [newPost, setNewPost] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null)
  const [loading, setLoading] = useState(true)
  const [likes, setLikes] = useState<Record<string, Like[]>>({})
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [showComments, setShowComments] = useState<Record<string, boolean>>({})
  const [newComment, setNewComment] = useState<Record<string, string>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({})
  const [showReportDialog, setShowReportDialog] = useState<{ postId: string; type: 'post' | 'media' } | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [showLikesDialog, setShowLikesDialog] = useState<string | null>(null)
  const [likesDialogUsers, setLikesDialogUsers] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use external state if provided, otherwise use internal state
  const showNewPost = externalShowNewPost ?? false
  const setShowNewPost = externalSetShowNewPost ?? (() => {})

  // Helper function to close modal and reset state
  const closeModal = useCallback(() => {
    setShowNewPost(false)
    setSelectedFile(null)
    setFilePreview(null)
    setFileType(null)
    setNewPost('')
  }, [setShowNewPost])

  const [isUploading, setIsUploading] = useState(false)


  const fetchingPosts = useRef(false)

  const fetchPosts = useCallback(async () => {
    if (fetchingPosts.current) return // Prevent duplicate calls
    
    try {
      fetchingPosts.current = true
      const { data: postsData, error: postsError } = await api.getFeed()

      if (postsError) throw new Error(postsError)
      
      // The new API returns posts with likes and comments included
      setPosts(postsData || [])
      
      // Extract likes and comments from the response
      if (postsData && postsData.length > 0) {
        const likesByPost: Record<string, Like[]> = {}
        const commentsByPost: Record<string, Comment[]> = {}
        
        postsData.forEach(post => {
          if (post.likes) {
            likesByPost[post.id] = post.likes
          }
          if (post.comments) {
            commentsByPost[post.id] = post.comments
          }
        })
        
        // Merge with existing likes to preserve optimistic updates
        setLikes(currentLikes => {
          const mergedLikes = { ...likesByPost }
          
          // For each post, if we have existing optimistic likes (temp-*), preserve them
          Object.keys(currentLikes).forEach(postId => {
            const existingLikes = currentLikes[postId] || []
            const serverLikes = mergedLikes[postId] || []
            const optimisticLikes = existingLikes.filter(like => like.id.startsWith('temp-'))
            
            if (optimisticLikes.length > 0) {
              // Keep server likes and add any optimistic likes that aren't duplicates
              const serverUserIds = new Set(serverLikes.map(like => like.user_id))
              const uniqueOptimisticLikes = optimisticLikes.filter(like => !serverUserIds.has(like.user_id))
              mergedLikes[postId] = [...serverLikes, ...uniqueOptimisticLikes]
            }
          })
          
          return mergedLikes
        })
        setComments(commentsByPost)
      }
    } catch (error) {
      toast.error('Error loading posts: ' + String(error))
    } finally {
      setLoading(false)
      fetchingPosts.current = false
    }
  }, [])


  // Manual refresh function
  const handleManualRefresh = async () => {
    setRefreshing(true)
    await fetchPosts()
    setRefreshing(false)
  }

  // Set up feed loading
  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // Set up websocket listeners for real-time updates
  useEffect(() => {
    if (!socket) return

    const handlePostCreated = (post: Post) => {
      setPosts(prev => {
        // Check if this is our own post replacing an optimistic one
        const optimisticPost = prev.find(p => 
          p.id.startsWith('temp-') && 
          p.userId === post.userId && 
          p.content === post.content &&
          p.imageUrl === post.imageUrl
        )
        
        if (optimisticPost) {
          // Replace the optimistic post with the real one
          const updated = prev.map(p => p.id === optimisticPost.id ? post : p)
          
          // Clean up old likes/comments data for temporary ID
          setLikes(prevLikes => {
            const { [optimisticPost.id]: _, ...rest } = prevLikes
            return { ...rest, [post.id]: prevLikes[optimisticPost.id] || [] }
          })
          setComments(prevComments => {
            const { [optimisticPost.id]: _, ...rest } = prevComments
            return { ...rest, [post.id]: prevComments[optimisticPost.id] || [] }
          })
          
          return updated
        } else {
          // Add new post from other users
          setLikes(prev => ({ ...prev, [post.id]: [] }))
          setComments(prev => ({ ...prev, [post.id]: [] }))
          return [post, ...prev]
        }
      })
    }

    const handlePostUpdated = (updatedPost: Post) => {
      setPosts(prev => prev.map(post => 
        post.id === updatedPost.id ? updatedPost : post
      ))
    }

    const handlePostDeleted = (postId: string) => {
      setPosts(prev => prev.filter(post => post.id !== postId))
      setLikes(prev => {
        const { [postId]: _, ...rest } = prev
        return rest
      })
      setComments(prev => {
        const { [postId]: _, ...rest } = prev
        return rest
      })
    }

    socket.on('post_created', handlePostCreated)
    socket.on('post_updated', handlePostUpdated)
    socket.on('post_deleted', handlePostDeleted)

    return () => {
      socket.off('post_created', handlePostCreated)
      socket.off('post_updated', handlePostUpdated)
      socket.off('post_deleted', handlePostDeleted)
    }
  }, [socket])

  // Handle keyboard events for lightbox
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && lightboxImage) {
        setLightboxImage(null)
      }
    }

    if (lightboxImage) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when lightbox is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [lightboxImage])

  // Handle click outside to close dropdown menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (Object.keys(openMenus).some(key => openMenus[key])) {
        setOpenMenus({})
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [openMenus])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Check file size - 128MB for videos, 32MB for images
      const maxSize = file.type.startsWith('video/') ? 128 * 1024 * 1024 : 32 * 1024 * 1024
      if (file.size > maxSize) {
        toast.error(file.type.startsWith('video/') ? 'Video must be less than 128MB' : 'Image must be less than 32MB')
        return
      }
      
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      
      if (!isVideo && !isImage) {
        toast.error('Please select an image or video file')
        return
      }
      
      setSelectedFile(file)
      setFileType(isVideo ? 'video' : 'image')
      
      const reader = new FileReader()
      reader.onload = (e) => setFilePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const uploadFileToR2 = async (file: File): Promise<{ url: string; mediaId?: string } | null> => {
    try {
      setIsUploading(true)
      
      const result = await uploadMedia(file);
      
      return { url: result.url, mediaId: result.mediaId };
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Error uploading file: ' + String(error));
      return null;
    } finally {
      setIsUploading(false)
    }
  }

  const toggleMenu = (postId: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }))
  }

  const deletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return

    try {
      const response = await api.request(`/posts/${postId}`, {
        method: 'DELETE'
      })
      
      if (response.error) {
        throw new Error(response.error)
      }

      // Remove from local state
      setPosts(prev => prev.filter(post => post.id !== postId))
      setLikes(prev => {
        const { [postId]: _, ...rest } = prev
        return rest
      })
      setComments(prev => {
        const { [postId]: _, ...rest } = prev
        return rest
      })
      
      toast.success('Post deleted successfully')
    } catch (error) {
      console.error('Error deleting post:', error)
      toast.error('Failed to delete post')
    }
  }

  const reportContent = async () => {
    if (!showReportDialog || !reportReason.trim()) return

    try {
      const response = await api.request('/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportType: showReportDialog.type,
          reportedItemId: showReportDialog.postId,
          reason: reportReason.trim()
        })
      })
      
      if (response.error) {
        throw new Error(response.error)
      }

      toast.success('Report submitted successfully')
      setShowReportDialog(null)
      setReportReason('')
    } catch (error) {
      console.error('Error submitting report:', error)
      toast.error('Failed to submit report')
    }
  }

  const createPost = async () => {
    if (!user || (!newPost.trim() && !selectedFile)) return

    const postContent = newPost.trim() || ''
    const selectedFileData = selectedFile
    const filePreviewUrl = filePreview
    
    // Optimistic update: immediately add post to UI
    const optimisticPost = {
      id: `temp-${Date.now()}`,
      userId: user.id,
      content: postContent,
      imageUrl: filePreview, // Use preview URL temporarily
      isVideo: fileType === 'video', // Track if this is a video for optimistic rendering
      workoutId: null,
      createdAt: new Date().toISOString(),
      user: {
        name: profile?.name || null,
        avatarUrl: profile?.avatarUrl || null,
        email: profile?.email || ''
      },
      workout: null
    }

    // Add to posts immediately
    setPosts(current => [optimisticPost, ...current])
    
    // Initialize empty likes and comments for optimistic post
    setLikes(current => ({ ...current, [optimisticPost.id]: [] }))
    setComments(current => ({ ...current, [optimisticPost.id]: [] }))

    // Clear form and close modal immediately
    setNewPost('')
    setSelectedFile(null)
    setFilePreview(null)
    setFileType(null)
    setShowNewPost(false)

    try {
      let imageUrl = null
      let mediaId = null

      if (selectedFileData) {
        const uploadResult = await uploadFileToR2(selectedFileData)
        if (!uploadResult) {
          throw new Error('Failed to upload image')
        }
        
        imageUrl = uploadResult.url
        mediaId = uploadResult.mediaId
        
        // Update the optimistic post with real image URL
        setPosts(current => 
          current.map(post => 
            post.id === optimisticPost.id 
              ? { ...post, imageUrl: imageUrl, isVideo: undefined } // Remove temporary flag
              : post
          )
        )
      }

      const { error } = await api.createPost({
        content: postContent,
        imageUrl: imageUrl,
        mediaId: mediaId
      })

      if (error) throw new Error(error)

      toast.success('Post shared!')
      // Note: Realtime will replace our optimistic post with the real one
      
      // Fallback: Remove optimistic post after 10 seconds if not replaced
      setTimeout(() => {
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
      }, 10000)
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
      setSelectedFile(selectedFileData)
      setFilePreview(filePreviewUrl)
      setShowNewPost(true)
      
      toast.error('Error creating post: ' + String(error))
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
      // Use API to toggle like
      const { error } = await api.toggleLike(postId)
      
      if (error) {
        console.error('Error toggling like:', error)
        throw new Error(error)
      }
      
      console.log(hasLike ? '👎 Like removed successfully' : '👍 Like added successfully')
      
      // Fetch updated likes for this post to ensure consistency
      try {
        const { data: likesData } = await api.getLikes(postId)
        if (likesData) {
          setLikes(currentLikes => ({
            ...currentLikes,
            [postId]: likesData
          }))
        }
      } catch (likesError) {
        console.warn('Could not fetch updated likes:', likesError)
        // Don't throw here, the optimistic update is probably fine
      }
    } catch (error: unknown) {
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
      
      toast.error('Error updating like: ' + (error instanceof Error ? error.message : String(error)))
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
      user: {
        name: profile?.name || null,
        avatarUrl: profile?.avatarUrl || null,
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
      const { error } = await api.addComment(postId, {
        content: commentContent
      })

      if (error) throw new Error(error)

      console.log('💬 Comment added successfully')
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
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '' // Return empty string for invalid dates
    }
    
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    // Handle negative differences (future dates)
    if (diffInMinutes < 0) return 'now'
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const getUserInitials = (name: string | null, email: string) => {
    if (name && name.length > 0) return name[0].toUpperCase()
    if (email && email.length > 0) return email[0].toUpperCase()
    return ''
  }

  const getUserAvatar = (userProfile: unknown, email: string) => {
    const profileData = userProfile as { avatarUrl?: string; name?: string } | null
    if (profileData?.avatarUrl) {
      return (
        <img
          src={profileData.avatarUrl}
          alt="User Avatar"
          className="w-10 h-10 rounded-full object-cover"
          style={{ 
            imageRendering: 'high-quality',
            colorInterpolation: 'sRGB'
          }}
        />
      )
    }
    return (
      <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
        {getUserInitials(profileData?.name || null, email)}
      </div>
    )
  }

  const isLikedByUser = (postId: string) => {
    if (!user) return false
    const postLikes = likes[postId] || []
    return postLikes.some(like => like.user_id === user.id)
  }

  const showWhoLiked = async (postId: string) => {
    try {
      const { data, error } = await api.getLikes(postId)
      if (error) {
        toast.error('Error loading likes: ' + error)
        return
      }
      setLikesDialogUsers(data || [])
      setShowLikesDialog(postId)
    } catch (error) {
      toast.error('Error loading likes: ' + String(error))
    }
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

  // Show verification pending message for unverified users
  if (!profile?.isVerified) {
    return (
      <div className="h-full flex flex-col bg-bg-secondary">
        {/* Fixed Header */}
        <div className="bg-bg-primary border-b border-border-primary p-3 lg:p-6 flex-shrink-0 z-40">
          <div className="max-w-2xl lg:mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-6 h-6 lg:w-8 lg:h-8 text-primary-600" />
              <h1 className="text-xl lg:text-4xl font-bold font-heading text-text-primary">Feed</h1>
            </div>
            <p className="font-body text-text-secondary hidden lg:block">Connect with your team and share your progress</p>
          </div>
        </div>

        {/* Verification Pending Message */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-orange-100 rounded-full flex items-center justify-center">
              <Clock className="w-10 h-10 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold font-heading text-gray-900 mb-4">Account Pending Verification</h2>
            <p className="text-gray-600 font-body mb-6 leading-relaxed">
              Your account is pending verification. You will have limited access until an admin approves your access.
            </p>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-700 font-body">
                <strong>What's next?</strong> An admin will review your account soon. Once approved, you'll have full access to post, comment, and see all team activity.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      {/* Fixed Header */}
      <div className="bg-bg-primary border-b border-border-primary p-3 lg:p-6 flex-shrink-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="w-6 h-6 lg:w-8 lg:h-8 text-primary-600" />
            <h1 className="text-xl lg:text-4xl font-heading font-bold text-text-primary">Team Feed</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              className="bg-bg-tertiary text-text-secondary p-2 lg:p-3 rounded-full hover:bg-secondary-100 transition-all disabled:opacity-50"
              title={isConnected ? "Refresh feed (Connected)" : "Refresh feed (Offline - Manual only)"}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 lg:w-5 lg:h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0">

      {/* New post modal */}
      {showNewPost && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 lg:pl-4 pl-16 z-50"
            onClick={(e) => {
              // Close modal when clicking on overlay
              if (e.target === e.currentTarget) {
                closeModal()
              }
            }}
          >
            <div
              className="bg-bg-primary rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-heading font-bold text-text-primary">Share with the Team</h3>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-bg-tertiary rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* File preview */}
              {filePreview && (
                <div className="mb-4 relative">
                  {fileType === 'image' ? (
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg"
                      style={{ 
                        imageRendering: 'high-quality',
                        colorInterpolation: 'sRGB'
                      }}
                    />
                  ) : fileType === 'video' ? (
                    <video
                      src={filePreview}
                      className="w-full h-48 object-contain rounded-lg bg-black"
                      controls
                      preload="metadata"
                      playsInline
                      controlsList="nodownload"
                    />
                  ) : null}
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                      setFilePreview(null)
                      setFileType(null)
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none font-body"
                rows={4}
              />

              <div className="flex items-center gap-3 mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-body"
                >
                  <Camera className="w-4 h-4" />
                  Photo/Video
                </button>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors font-body"
                >
                  Cancel
                </button>
                <button
                  onClick={createPost}
                  disabled={(!newPost.trim() && !selectedFile) || isUploading}
                  className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 rounded-lg font-medium disabled:opacity-50 hover:shadow-lg transition-all font-body"
                >
                  {isUploading ? 'Sharing...' : 'Share'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox for image viewing */}
        {lightboxImage && (
          <div
            className="fixed inset-0 flex items-center justify-center p-4 lg:pl-4 pl-16 z-50 animate-in fade-in duration-300"
            onClick={() => setLightboxImage(null)}
            style={{
              background: 'rgba(0, 0, 0, 0.95)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          >
            <div className="relative w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-300">
              <img
                src={lightboxImage}
                alt="Enlarged view"
                className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{ 
                  imageRendering: 'high-quality',
                  colorInterpolation: 'sRGB'
                }}
              />
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute top-4 right-4 bg-white text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-110"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Posts */}
        <div className="max-w-2xl lg:mx-auto px-4 pt-6 pb-60 lg:pb-6" style={{ paddingBottom: 'clamp(15rem, 25vh, 20rem)' }}>
          {posts.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="text-4xl mb-4">🏀</div>
              <h3 className="text-lg font-heading font-semibold text-gray-700 mb-2">No posts yet!</h3>
              <p className="text-gray-500 font-body">Be the first to share your training progress</p>
            </div>
          ) : (
          posts.map((post, index) => {
            const postUser = post.user as { name?: string; avatarUrl?: string; email?: string } | null
            const postWorkouts = post.workout as { exerciseType?: string; pointsEarned?: number; durationMinutes?: number } | null
            const isOptimistic = post.id.startsWith('temp-')
            
            return (
              <div
                key={post.id}
                className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 border mb-4 overflow-hidden ${
                  isOptimistic ? 'border-primary-200 bg-primary-50/30' : 'border-gray-100'
                }`}
                style={{ backgroundColor: isOptimistic ? undefined : '#fff' }}
              >
                {/* Post header */}
                <div className="flex items-center gap-3 p-4">
                  {getUserAvatar(post.user, (post.user as any)?.email || '')}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 font-heading text-lg">
                      {postUser?.name || postUser?.email?.split('@')[0] || 'Unknown User'}
                    </p>
                    <p className="text-sm text-gray-500 font-body">
                      {formatTime(post.createdAt)}
                      {isOptimistic && <span className="ml-1 text-primary-500">• Sharing...</span>}
                    </p>
                  </div>
                  
                  {/* 3-dot menu */}
                  {!isOptimistic && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleMenu(post.id)
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {openMenus[post.id] && (
                        <div 
                          className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(post.userId === user?.id || isAdmin) && (
                            <button
                              onClick={() => {
                                deletePost(post.id)
                                setOpenMenus(prev => ({ ...prev, [post.id]: false }))
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          )}
                          {post.userId !== user?.id && (
                            <button
                              onClick={() => {
                                setShowReportDialog({ postId: post.id, type: 'post' })
                                setOpenMenus(prev => ({ ...prev, [post.id]: false }))
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Flag className="w-4 h-4" />
                              Report
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Workout badge */}
                {post.workout && (
                  <div className="px-4 pb-2">
                    <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-sm font-body">
                      <Trophy className="w-4 h-4" />
                      <span className="capitalize">{postWorkouts?.exerciseType}</span>
                      <span>•</span>
                      <span>+{postWorkouts?.pointsEarned} pts</span>
                      <Clock className="w-3 h-3 ml-1" />
                      <span>{postWorkouts?.durationMinutes}m</span>
                    </div>
                  </div>
                )}

                {/* Game card */}
                {post.postType === 'game' && post.game && (
                  <div className="px-4 pb-2">
                    <GameCard 
                      game={post.game}
                      commentCount={(post as any).commentsCount || 0}
                      onClick={() => onGameClick?.(post.game!.id)}
                    />
                  </div>
                )}

                {/* Post media */}
                {post.imageUrl && (
                  <div className="w-full bg-gray-50 overflow-hidden">
                    <MediaRenderer 
                      url={post.imageUrl} 
                      isOptimisticVideo={post.isVideo}
                      onImageClick={() => setLightboxImage(post.imageUrl)}
                    />
                  </div>
                )}

                {/* Post content */}
                {post.content && (
                  <div className="px-4 py-3">
                    <p className="text-gray-800 font-body">{post.content}</p>
                  </div>
                )}

                {/* Post actions */}
                <div className="px-4 py-3 border-t border-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleLike(post.id)}
                        className={`flex items-center gap-2 transition-colors ${
                          isLikedByUser(post.id) 
                            ? 'text-red-500' 
                            : 'text-gray-500 hover:text-red-500'
                        }`}
                      >
                        <Heart className={`w-5 h-5 ${isLikedByUser(post.id) ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => setShowComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                        className="flex items-center gap-2 text-gray-500 hover:text-blue-500 transition-colors relative"
                      >
                        <MessageCircle className="w-5 h-5" />
                        {comments[post.id]?.length > 0 && (
                          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {comments[post.id].length}
                          </span>
                        )}
                      </button>
                      <button
                        className="flex items-center gap-2 text-gray-500 hover:text-green-500 transition-colors"
                      >
                        <Share className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Like count */}
                  {likes[post.id]?.length > 0 && (
                    <button
                      onClick={() => showWhoLiked(post.id)}
                      className="text-sm font-semibold text-gray-900 mb-2 font-body hover:text-primary-600 transition-colors"
                    >
                      {likes[post.id].length} {likes[post.id].length === 1 ? 'like' : 'likes'}
                    </button>
                  )}

                  {/* Most recent comment preview */}
                  {comments[post.id]?.length > 0 && !showComments[post.id] && (
                    <div className="mb-3">
                      {(() => {
                        const mostRecentComment = comments[post.id][comments[post.id].length - 1]
                        const commentUser = mostRecentComment.user as { name?: string; avatarUrl?: string; email?: string } | null
                        const isOptimistic = mostRecentComment.id.startsWith('temp-')
                        
                        return (
                          <div className={`flex gap-3 ${isOptimistic ? 'opacity-75' : ''}`}>
                            {commentUser?.avatarUrl ? (
                              <img
                                src={commentUser.avatarUrl}
                                alt="User Avatar"
                                className="w-6 h-6 rounded-full object-cover"
                                style={{ 
                                  imageRendering: 'high-quality',
                                  colorInterpolation: 'sRGB'
                                }}
                              />
                            ) : (
                              <div className="w-6 h-6 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                {getUserInitials(commentUser?.name || null, commentUser?.email || '')}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-body">
                                <span className="font-semibold text-gray-900 font-heading text-lg">
                                  {commentUser?.name || commentUser?.email?.split('@')[0] || 'Unknown User'}
                                </span>
                                <span className="text-gray-700 ml-2 font-body">{mostRecentComment.content}</span>
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-gray-500 font-body">
                                  {formatTime(mostRecentComment.createdAt)}
                                  {isOptimistic && <span className="ml-1 text-primary-500">• Sending...</span>}
                                </p>
                                {comments[post.id].length > 1 && (
                                  <button
                                    onClick={() => setShowComments(prev => ({ ...prev, [post.id]: true }))}
                                    className="text-xs text-gray-500 hover:text-gray-700 font-medium font-body"
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
                  {showComments[post.id] && (
                    <div className="border-t border-gray-100 pt-3 mt-3">
                        {/* Existing comments */}
                        <div className="space-y-3 mb-3">
                          {comments[post.id]?.map((comment) => {
                            const commentUser = comment.user as { name?: string; avatarUrl?: string; email?: string } | null
                            const isOptimistic = comment.id.startsWith('temp-')
                            return (
                              <div key={comment.id} className={`flex gap-3 ${isOptimistic ? 'opacity-75' : ''}`}>
                                {commentUser?.avatarUrl ? (
                                  <img
                                    src={commentUser.avatarUrl}
                                    alt="User Avatar"
                                    className="w-8 h-8 rounded-full object-cover"
                                    style={{ 
                                      imageRendering: 'high-quality',
                                      colorInterpolation: 'sRGB'
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {getUserInitials(commentUser?.name || null, commentUser?.email || '')}
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div className={`rounded-lg px-3 py-2 ${isOptimistic ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50'}`}>
                                    <p className="font-semibold text-base text-gray-900 font-heading">
                                      {commentUser?.name || commentUser?.email?.split('@')[0] || 'Unknown User'}
                                    </p>
                                    <p className="text-gray-800 font-body">{comment.content}</p>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1 font-body">
                                    {formatTime(comment.createdAt)}
                                    {isOptimistic && <span className="ml-1 text-primary-500">• Sending...</span>}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Add comment */}
                        <div className="flex gap-3">
                          {profile?.avatarUrl ? (
                            <img
                              src={profile.avatarUrl}
                              alt="User Avatar"
                              className="w-8 h-8 rounded-full object-cover"
                              style={{ 
                                imageRendering: 'high-quality',
                                colorInterpolation: 'sRGB'
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {getUserInitials(profile?.name || null, profile?.email || '')}
                            </div>
                          )}
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              value={newComment[post.id] || ''}
                              onChange={(e) => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                              placeholder="Add a comment..."
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm font-body"
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
                    </div>
                  )}
                </div>
              </div>
            )
          })
          )}
        </div>
      </div>

      {/* Likes Dialog */}
      {showLikesDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:pl-4 pl-16">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold font-heading text-text-primary">Likes</h3>
              <button
                onClick={() => {
                  setShowLikesDialog(null)
                  setLikesDialogUsers([])
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-3">
              {likesDialogUsers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No likes yet</p>
              ) : (
                likesDialogUsers.map((like) => (
                  <div key={like.id} className="flex items-center gap-3">
                    {like.user?.avatarUrl ? (
                      <img
                        src={like.user.avatarUrl}
                        alt="User Avatar"
                        className="w-10 h-10 rounded-full object-cover"
                        style={{ 
                          imageRendering: 'high-quality',
                          colorInterpolation: 'sRGB'
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                        {getUserInitials(like.user?.name || null, like.user?.email || '')}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 font-heading">
                        {like.user?.name || like.user?.email?.split('@')[0] || 'Unknown User'}
                      </p>
                      <p className="text-sm text-gray-500 font-body">
                        {formatTime(like.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Dialog */}
      {showReportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:pl-4 pl-16">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold font-heading text-text-primary">Report Content</h3>
              <button
                onClick={() => {
                  setShowReportDialog(null)
                  setReportReason('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Why are you reporting this {showReportDialog.type}?
                </label>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Please describe why you're reporting this content..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={4}
                />
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowReportDialog(null)
                    setReportReason('')
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={reportContent}
                  disabled={!reportReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}