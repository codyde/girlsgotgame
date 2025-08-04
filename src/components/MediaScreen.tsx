import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Filter, Tag, Trash2, X, Play, Download, Calendar, MoreVertical, Flag, Edit2, FileVideo, FileImage, Plus, Maximize } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { uploadMedia } from '../lib/upload'
import { MediaUpload } from '../types'

type MediaItem = MediaUpload

interface MediaScreenProps {}

export function MediaScreen({}: MediaScreenProps) {
  const { user, profile } = useAuth()
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [filteredItems, setFilteredItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all')
  const [searchTags, setSearchTags] = useState('')
  const [debouncedSearchTags, setDebouncedSearchTags] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({})
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({})
  const [showReportDialog, setShowReportDialog] = useState<{ itemId: string; type: 'media' } | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [renamingItem, setRenamingItem] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [generatedThumbnails, setGeneratedThumbnails] = useState<{ [key: string]: string }>({})
  const [activeGenerations, setActiveGenerations] = useState<Set<string>>(new Set())
  const [playingItem, setPlayingItem] = useState<MediaItem | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const timeoutRefs = useRef<{ [key: string]: NodeJS.Timeout }>({})
  const cleanupRefs = useRef<{ [key: string]: () => void }>({})

  const isAdmin = profile?.isAdmin === true

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
      const isSmallScreen = window.innerWidth <= 768
      setIsMobile(isMobileDevice || isSmallScreen)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Download function
  const downloadMedia = useCallback(async (item: MediaItem) => {
    try {
      // Use the backend download endpoint for proper authentication and headers
      const link = document.createElement('a')
      link.href = `/api/media/download/${item.id}`
      link.download = item.originalName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Download failed:', error)
      setError('Failed to download file')
    }
  }, [])

  // Play media function
  const playMedia = useCallback((item: MediaItem) => {
    if (item.mediaType === 'video') {
      setPlayingItem(item)
    } else {
      setSelectedItem(item)
    }
  }, [])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTags(searchTags)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchTags])

  // Load media items only when debounced search or filter type changes
  useEffect(() => {
    loadMediaItems()
  }, [filterType, debouncedSearchTags])

  // Create a stylized thumbnail for videos we can't process due to CORS
  const createStylizedVideoThumbnail = useCallback((itemId: string, videoUrl: string) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return
    
    canvas.width = 320
    canvas.height = 180 // 16:9 aspect ratio
    
    // Create a modern gradient background
    const gradient = ctx.createLinearGradient(0, 0, 320, 180)
    gradient.addColorStop(0, '#1f2937') // Dark gray
    gradient.addColorStop(0.5, '#374151') // Medium gray
    gradient.addColorStop(1, '#4b5563') // Light gray
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 320, 180)
    
    // Add some visual texture with subtle lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    for (let i = 0; i < 320; i += 20) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, 180)
      ctx.stroke()
    }
    
    // Draw a large centered play button
    const centerX = 160
    const centerY = 90
    const playSize = 30
    
    // Play button background circle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.beginPath()
    ctx.arc(centerX, centerY, playSize + 10, 0, Math.PI * 2)
    ctx.fill()
    
    // Play triangle
    ctx.fillStyle = '#1f2937'
    ctx.beginPath()
    ctx.moveTo(centerX - playSize * 0.6, centerY - playSize * 0.8)
    ctx.lineTo(centerX + playSize * 0.8, centerY)
    ctx.lineTo(centerX - playSize * 0.6, centerY + playSize * 0.8)
    ctx.closePath()
    ctx.fill()
    
    // Add "VIDEO" badge in top left
    ctx.fillStyle = '#dc2626' // Red background
    ctx.fillRect(8, 8, 50, 20)
    ctx.fillStyle = 'white'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('VIDEO', 33, 22)
    
    // Add file name at bottom (truncated)
    const fileName = videoUrl.split('/').pop()?.split('.')[0] || 'Video'
    const truncatedName = fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 150, 320, 30)
    ctx.fillStyle = 'white'
    ctx.font = '11px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(truncatedName, 160, 168)
    
    const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.9)
    console.log('🎨 Created stylized thumbnail for R2 video:', itemId)
    
    setGeneratedThumbnails(prev => ({
      ...prev,
      [itemId]: thumbnailUrl
    }))
  }, [])

  // Generate thumbnail from video client-side with memory leak prevention
  const generateVideoThumbnail = useCallback((videoUrl: string, itemId: string) => {
    // Avoid generating if already in progress or done
    if (generatedThumbnails[itemId] || activeGenerations.has(itemId)) {
      console.log('Thumbnail already exists or in progress for:', itemId)
      return
    }

    // Mark as active to prevent duplicate generations
    setActiveGenerations(prev => new Set([...prev, itemId]))
    
    console.log('🎬 Starting thumbnail generation for:', itemId, videoUrl)
    
    // Enhanced mobile detection
    const userAgent = navigator.userAgent
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
    const isIOS = /iPad|iPhone|iPod/.test(userAgent)
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent) || isIOS
    
    if (isMobile) {
      console.log('📱 Mobile device detected:', { isIOS, isSafari })
    }
    
    const video = document.createElement('video')
    
    // Enhanced mobile video setup
    if (isMobile || isSafari) {
      video.setAttribute('webkit-playsinline', 'true')
      video.setAttribute('playsinline', 'true')
      video.setAttribute('muted', 'true')
      video.setAttribute('controls', 'false')
      video.muted = true
      video.playsInline = true
      video.autoplay = false
      video.preload = 'metadata'
      video.volume = 0
      
      if (isIOS) {
        video.setAttribute('x-webkit-airplay', 'allow')
      }
    } else {
      video.muted = true
      video.playsInline = true
      video.preload = 'metadata'
    }
    
    video.style.display = 'none'
    video.style.position = 'absolute'
    video.style.top = '-9999px'
    video.style.left = '-9999px'
    video.style.width = '1px'
    video.style.height = '1px'
    
    // Set crossOrigin for external videos
    if (!videoUrl.startsWith('/') && !videoUrl.includes(window.location.hostname)) {
      video.crossOrigin = 'anonymous'
      console.log('🌐 Cross-origin video, using anonymous CORS')
    }
    
    // Add to DOM (required for mobile browsers)
    document.body.appendChild(video)
    
    let hasGenerated = false
    let hasLoadedMetadata = false
    let mainTimeoutId: NodeJS.Timeout
    let seekTimeoutId: NodeJS.Timeout
    
    const cleanup = () => {
      console.log('🧹 Cleaning up video element for:', itemId)
      
      // Clear timeouts
      if (mainTimeoutId) clearTimeout(mainTimeoutId)
      if (seekTimeoutId) clearTimeout(seekTimeoutId)
      
      // Remove event listeners
      video.onloadedmetadata = null
      video.oncanplay = null
      video.onseeked = null
      video.onloadeddata = null
      video.onerror = null
      video.onloadstart = null
      
      // Remove from DOM
      try {
        if (video.parentNode) {
          document.body.removeChild(video)
        }
        // Explicitly clear video source to release memory
        video.src = ''
        video.load()
      } catch (e) {
        console.warn('Cleanup error:', e)
      }
      
      // Mark generation as complete
      setActiveGenerations(prev => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
      
      // Clean up refs
      delete cleanupRefs.current[itemId]
      delete timeoutRefs.current[itemId]
    }
    
    // Store cleanup function for external cleanup
    cleanupRefs.current[itemId] = cleanup
    
    // Reduced timeout for better memory management
    const timeoutDuration = isMobile ? 8000 : 5000
    mainTimeoutId = setTimeout(() => {
      console.warn('⏰ Timeout generating thumbnail for:', itemId)
      if (!hasGenerated) {
        console.log('💡 Creating stylized thumbnail due to timeout')
        createStylizedVideoThumbnail(itemId, videoUrl)
      }
      cleanup()
    }, timeoutDuration)
    
    timeoutRefs.current[itemId] = mainTimeoutId
    
    const attemptThumbnailGeneration = () => {
      if (hasGenerated || !hasLoadedMetadata) return
      hasGenerated = true
      
      console.log('🎯 Attempting thumbnail generation for:', itemId)
      
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          console.warn('❌ Could not get canvas context for:', itemId)
          createStylizedVideoThumbnail(itemId, videoUrl)
          cleanup()
          return
        }
        
        const width = video.videoWidth || 320
        const height = video.videoHeight || 240
        
        if (width === 0 || height === 0) {
          console.warn('❌ Invalid video dimensions for:', itemId)
          createStylizedVideoThumbnail(itemId, videoUrl)
          cleanup()
          return
        }
        
        // Limit canvas size to prevent memory issues
        const maxSize = 400
        let canvasWidth = width
        let canvasHeight = height
        
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          canvasWidth = Math.floor(width * ratio)
          canvasHeight = Math.floor(height * ratio)
        }
        
        canvas.width = canvasWidth
        canvas.height = canvasHeight
        
        console.log('🎨 Drawing canvas:', canvasWidth, 'x', canvasHeight)
        ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight)
        
        try {
          // Use lower quality to reduce memory usage
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.6)
          
          if (thumbnailUrl.length > 1000) {
            console.log('✅ Generated thumbnail for:', itemId, 'Size:', Math.round(thumbnailUrl.length / 1024), 'KB')
            
            setGeneratedThumbnails(prev => {
              // Limit total cached thumbnails to prevent memory buildup
              const entries = Object.entries(prev)
              if (entries.length >= 20) {
                // Remove oldest entries
                const newCache = Object.fromEntries(entries.slice(-15))
                return { ...newCache, [itemId]: thumbnailUrl }
              }
              return { ...prev, [itemId]: thumbnailUrl }
            })
          } else {
            console.warn('⚠️ Generated thumbnail too small, using fallback')
            createStylizedVideoThumbnail(itemId, videoUrl)
          }
        } catch (canvasError) {
          console.warn('🚫 Canvas error for:', itemId, 'using fallback')
          createStylizedVideoThumbnail(itemId, videoUrl)
        }
        
        cleanup()
      } catch (error) {
        console.warn('❌ Failed to generate thumbnail for:', itemId, error)
        createStylizedVideoThumbnail(itemId, videoUrl)
        cleanup()
      }
    }
    
    video.onloadedmetadata = () => {
      hasLoadedMetadata = true
      console.log('📊 Video metadata loaded for:', itemId)
      
      let seekTime = isMobile ? 0.1 : Math.min(video.duration * 0.1, 1)
      if (video.duration < 1) seekTime = 0.1
      
      video.currentTime = seekTime
    }
    
    video.oncanplay = () => {
      if (isMobile && hasLoadedMetadata && !hasGenerated) {
        seekTimeoutId = setTimeout(attemptThumbnailGeneration, 100)
      }
    }
    
    video.onseeked = attemptThumbnailGeneration
    
    video.onloadeddata = () => {
      if (isMobile && hasLoadedMetadata && !hasGenerated) {
        seekTimeoutId = setTimeout(attemptThumbnailGeneration, 200)
      }
    }
    
    video.onerror = () => {
      console.warn('❌ Video load error for:', itemId)
      createStylizedVideoThumbnail(itemId, videoUrl)
      cleanup()
    }
    
    // Set source and load
    video.src = videoUrl
    if (isMobile) video.load()
    
  }, [generatedThumbnails, activeGenerations, createStylizedVideoThumbnail])

  // Client-side filtering
  useEffect(() => {
    let filtered = [...mediaItems]

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.mediaType === filterType)
    }

    // Apply search filter (search in name and tags)
    if (debouncedSearchTags.trim()) {
      const searchLower = debouncedSearchTags.toLowerCase()
      filtered = filtered.filter(item => {
        const nameMatch = item.originalName.toLowerCase().includes(searchLower)
        const tagsMatch = item.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        return nameMatch || tagsMatch
      })
    }

    setFilteredItems(filtered)
  }, [mediaItems, filterType, debouncedSearchTags])

  // Auto-generate thumbnails for videos without them - optimized for mobile
  useEffect(() => {
    const videosNeedingThumbnails = filteredItems.filter(item => 
      item.mediaType === 'video' && 
      !item.thumbnailUrl && 
      !generatedThumbnails[item.id] &&
      !activeGenerations.has(item.id)
    )

    console.log('Videos needing thumbnails:', videosNeedingThumbnails.length)

    // Clear any existing timeouts
    Object.values(timeoutRefs.current).forEach(timeout => clearTimeout(timeout))
    timeoutRefs.current = {}

    // On mobile, only generate 1 thumbnail at a time and limit to first 5 videos
    // On desktop, generate 2 at a time for first 10 videos
    const maxVideos = isMobile ? 5 : 10
    const maxConcurrent = isMobile ? 1 : 2
    const videosToProcess = videosNeedingThumbnails.slice(0, maxVideos).slice(0, maxConcurrent)
    
    videosToProcess.forEach((item, index) => {
      const delay = isMobile ? index * 2000 : index * 1000 // Longer delays on mobile
      const timeoutId = setTimeout(() => {
        console.log('Starting thumbnail generation for:', item.id)
        generateVideoThumbnail(item.uploadUrl, item.id)
      }, delay)
      
      timeoutRefs.current[`auto-${item.id}`] = timeoutId
    })

    // Cleanup function
    return () => {
      Object.values(timeoutRefs.current).forEach(timeout => clearTimeout(timeout))
      timeoutRefs.current = {}
    }
  }, [filteredItems, generatedThumbnails, activeGenerations, generateVideoThumbnail, isMobile])

  // Cleanup all active generations when component unmounts
  useEffect(() => {
    return () => {
      console.log('🧹 MediaScreen unmounting, cleaning up all thumbnail generations')
      
      // Clear all timeouts
      Object.values(timeoutRefs.current).forEach(timeout => clearTimeout(timeout))
      
      // Call all cleanup functions
      Object.values(cleanupRefs.current).forEach(cleanup => cleanup())
      
      // Clear refs
      timeoutRefs.current = {}
      cleanupRefs.current = {}
    }
  }, [])

  // Handle click outside to close dropdown menus and keyboard shortcuts
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (Object.keys(openMenus).some(key => openMenus[key])) {
        setOpenMenus({})
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (playingItem) {
          setPlayingItem(null)
        } else if (selectedItem) {
          setSelectedItem(null)
        } else if (showUpload) {
          setShowUpload(false)
          setSelectedFiles([])
          setUploadProgress({})
          setError(null)
        } else if (showReportDialog) {
          setShowReportDialog(null)
          setReportReason('')
        } else if (Object.keys(openMenus).some(key => openMenus[key])) {
          setOpenMenus({})
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenus, playingItem, selectedItem, showUpload, showReportDialog])

  const loadMediaItems = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (isAdmin) params.append('includeHidden', 'true')
      
      const queryString = params.toString()
      const endpoint = queryString ? `/media?${queryString}` : '/media'
      
      const response = await api.request(endpoint)
      if (response.error) {
        throw new Error(response.error)
      }
      setMediaItems(response.data || [])
    } catch (err) {
      console.error('Error loading media:', err)
      setError('Failed to load media items')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelection = (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles = fileArray.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type.startsWith('video/')
      const isValidSize = file.size <= 128 * 1024 * 1024 // 128MB limit
      return isValidType && isValidSize
    })
    
    if (validFiles.length !== fileArray.length) {
      setError('Some files were excluded (invalid type or too large)')
    }
    
    setSelectedFiles(validFiles)
  }

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleFileUpload = async () => {
    if (!selectedFiles.length) return

    setIsUploading(true)
    setUploadProgress({})
    
    try {
      const uploadedItems: MediaItem[] = []
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const fileId = `file-${i}-${Date.now()}`
        
        // Update progress
        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))
        
        try {
          const result = await uploadMedia(file)
          if (!result || !result.mediaId) {
            throw new Error(`Upload failed for ${file.name}`)
          }
          
          // Update progress to 100%
          setUploadProgress(prev => ({ ...prev, [fileId]: 100 }))
          
          // Create a temporary media item for immediate display
          const tempMediaItem: MediaItem = {
            id: result.mediaId,
            uploadedBy: user!.id,
            uploaderName: profile?.name || 'You',
            fileName: result.name,
            originalName: file.name,
            fileSize: file.size,
            mimeType: result.type,
            mediaType: result.type.startsWith('video/') ? 'video' : 'image',
            uploadUrl: result.url,
            thumbnailUrl: null,
            width: null,
            height: null,
            duration: null,
            tags: [],
            description: null,
            isVisible: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          uploadedItems.push(tempMediaItem)
        } catch (fileError) {
          console.error(`Error uploading ${file.name}:`, fileError)
          setError(`Failed to upload ${file.name}`)
        }
      }
      
      // Optimistically add new items to the list
      if (uploadedItems.length > 0) {
        setMediaItems(prevItems => [...uploadedItems, ...prevItems])
      }
      
      // Reset upload state
      setSelectedFiles([])
      setUploadProgress({})
      setShowUpload(false)
    } catch (err) {
      console.error('Error uploading files:', err)
      setError('Failed to upload files')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelection(files)
    }
  }, [])

  const toggleVisibility = async (itemId: string, currentVisible: boolean) => {
    if (!isAdmin) return

    try {
      const response = await api.request(`/media/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isVisible: !currentVisible
        })
      })
      if (response.error) {
        throw new Error(response.error)
      }
      await loadMediaItems()
    } catch (err) {
      console.error('Error updating visibility:', err)
      setError('Failed to update visibility')
    }
  }

  const deleteMedia = async (itemId: string) => {
    const mediaItem = mediaItems.find(item => item.id === itemId)
    const canDelete = mediaItem && (mediaItem.uploadedBy === user?.id || isAdmin)
    
    if (!canDelete) return

    if (!confirm('Are you sure you want to delete this media item?')) return

    // Optimistic update - remove from UI immediately
    setMediaItems(prevItems => prevItems.filter(item => item.id !== itemId))
    setSelectedItem(null)

    try {
      const response = await api.request(`/media/${itemId}`, {
        method: 'DELETE'
      })
      if (response.error) {
        throw new Error(response.error)
      }
      // Success - item already removed from UI
    } catch (err) {
      console.error('Error deleting media:', err)
      setError('Failed to delete media')
      
      // Revert optimistic update on failure
      if (mediaItem) {
        setMediaItems(prevItems => [...prevItems, mediaItem])
      }
    }
  }

  const updateTags = async (itemId: string, tags: string[]) => {
    if (!isAdmin) return

    const mediaItem = mediaItems.find(item => item.id === itemId)
    const oldTags = mediaItem?.tags || []

    // Optimistic update
    setMediaItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId 
          ? { ...item, tags }
          : item
      )
    )

    try {
      const response = await api.request(`/media/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tags })
      })
      if (response.error) {
        throw new Error(response.error)
      }
      // Success - optimistic update already applied
    } catch (err) {
      console.error('Error updating tags:', err)
      setError('Failed to update tags')
      
      // Revert optimistic update on failure
      setMediaItems(prevItems => 
        prevItems.map(item => 
          item.id === itemId 
            ? { ...item, tags: oldTags }
            : item
        )
      )
    }
  }

  const renameMedia = async (itemId: string, newOriginalName: string) => {
    const mediaItem = mediaItems.find(item => item.id === itemId)
    const canRename = mediaItem && (mediaItem.uploadedBy === user?.id || isAdmin)
    
    if (!canRename || !newOriginalName.trim()) {
      setRenamingItem(null)
      setNewName('')
      return
    }

    // If name hasn't changed, just exit rename mode
    if (newOriginalName.trim() === mediaItem?.originalName) {
      setRenamingItem(null)
      setNewName('')
      return
    }

    const oldName = mediaItem.originalName

    // Optimistic update - update UI immediately
    setMediaItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId 
          ? { ...item, originalName: newOriginalName.trim() }
          : item
      )
    )
    setRenamingItem(null)
    setNewName('')

    try {
      const response = await api.request(`/media/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ originalName: newOriginalName.trim() })
      })
      
      if (response.error) {
        throw new Error(response.error)
      }
      
      // Success - no need to reload, optimistic update already applied
    } catch (err) {
      console.error('Error renaming media:', err)
      setError('Failed to rename media: ' + (err instanceof Error ? err.message : String(err)))
      
      // Revert optimistic update on failure
      setMediaItems(prevItems => 
        prevItems.map(item => 
          item.id === itemId 
            ? { ...item, originalName: oldName }
            : item
        )
      )
    }
  }

  const startRename = (item: MediaItem) => {
    setRenamingItem(item.id)
    setNewName(item.originalName)
  }

  const toggleMenu = (itemId: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }))
  }

  const reportMedia = async () => {
    if (!showReportDialog || !reportReason.trim()) return

    try {
      const response = await api.request('/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportType: showReportDialog.type,
          reportedItemId: showReportDialog.itemId,
          reason: reportReason.trim()
        })
      })
      
      if (response.error) {
        throw new Error(response.error)
      }

      // Success - you could show a toast here
      setShowReportDialog(null)
      setReportReason('')
    } catch (err) {
      console.error('Error submitting report:', err)
      setError('Failed to submit report')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return ''
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="font-body text-gray-600">Loading media...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-bg-secondary">
      {/* Header */}
      <div className="bg-bg-primary border-b border-border-primary p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl lg:text-4xl font-bold font-heading text-text-primary">Media Gallery</h1>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-heading"
            >
              <Upload className="w-4 h-4" />
              Upload Media
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <div className="flex gap-2">
            {(['all', 'image', 'video'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 rounded-full text-sm font-heading transition-colors ${
                  filterType === type
                    ? 'bg-primary-600 text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:bg-primary-50 hover:text-primary-600'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by tags..."
              value={searchTags}
              onChange={(e) => setSearchTags(e.target.value)}
              className="w-full px-3 py-1 rounded-lg border border-border-primary bg-bg-primary text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-500 font-body"
            />
          </div>
        </div>
      </div>

      {/* Media Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 font-body">
            {error}
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📷</div>
            <h3 className="text-xl font-heading text-text-primary mb-2">
              {mediaItems.length === 0 ? 'No media found' : 'No matching media'}
            </h3>
            <p className="text-text-secondary font-body">
              {mediaItems.length === 0 
                ? 'Upload some photos or videos to get started!' 
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={`bg-bg-primary rounded-lg overflow-hidden shadow-sm border border-border-primary cursor-pointer hover:shadow-md transition-shadow ${
                  !item.isVisible && isAdmin ? 'opacity-50' : ''
                }`}
                onClick={() => playMedia(item)}
              >
                <div className="relative">
                  {item.mediaType === 'video' ? (
                    <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-700">
                      {/* Video thumbnail with auto-generation */}
                      {generatedThumbnails[item.id] ? (
                        <img
                          src={generatedThumbnails[item.id]}
                          alt={item.originalName}
                          className="w-full h-full object-cover"
                        />
                      ) : item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.originalName}
                          className="w-full h-full object-cover"
                          onError={() => generateVideoThumbnail(item.uploadUrl, item.id)}
                        />
                      ) : (
                        <div 
                          className="w-full h-full flex items-center justify-center cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            console.log('Manual thumbnail generation triggered for:', item.id, item.uploadUrl)
                            generateVideoThumbnail(item.uploadUrl, item.id)
                          }}
                        >
                          <div className="text-center">
                            <div className="animate-pulse">
                              <div className="w-16 h-16 bg-white/20 rounded-full mx-auto mb-2 flex items-center justify-center">
                                <Play className="w-8 h-8 text-white/70" />
                              </div>
                            </div>
                            <div className="text-white/90 text-xs font-medium">Click to generate preview</div>
                            <div className="text-white/60 text-xs font-mono mt-1">
                              {item.uploadUrl.split('/').pop()?.substring(0, 20)}...
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Video overlay with play button */}
                      <div className="absolute inset-0 bg-black/20 hover:bg-black/30 transition-colors flex items-center justify-center group">
                        <div className="bg-white/90 hover:bg-white rounded-full p-4 shadow-lg transform group-hover:scale-110 transition-transform">
                          <Play className="w-8 h-8 text-gray-800 ml-1" />
                        </div>
                      </div>
                      
                      {/* Video badge */}
                      <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded font-bold">
                        VIDEO
                      </div>
                      
                      {/* Duration badge */}
                      {item.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded font-mono">
                          {formatDuration(item.duration)}
                        </div>
                      )}
                      
                      {/* File size for videos */}
                      <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                        {formatFileSize(item.fileSize)}
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={item.uploadUrl}
                        alt={item.originalName}
                        className="w-full h-auto object-cover"
                        style={{ aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : 'auto' }}
                      />
                      {/* Image badge */}
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded font-bold">
                        IMAGE
                      </div>
                      {/* Image dimensions */}
                      {item.width && item.height && (
                        <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                          {item.width} × {item.height}
                        </div>
                      )}
                      {/* File size */}
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                        {formatFileSize(item.fileSize)}
                      </div>
                    </div>
                  )}
                  
                  {/* 3-dot menu */}
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleMenu(item.id)
                      }}
                      className="p-1 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {openMenus[item.id] && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadMedia(item)
                            setOpenMenus(prev => ({ ...prev, [item.id]: false }))
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                        {(item.uploadedBy === user?.id || isAdmin) && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                startRename(item)
                                setOpenMenus(prev => ({ ...prev, [item.id]: false }))
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                              Rename
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedItem(item)
                                setOpenMenus(prev => ({ ...prev, [item.id]: false }))
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Tag className="w-4 h-4" />
                              Edit
                            </button>
                            {isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleVisibility(item.id, item.isVisible)
                                  setOpenMenus(prev => ({ ...prev, [item.id]: false }))
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <Tag className="w-4 h-4" />
                                {item.isVisible ? 'Hide' : 'Show'}
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteMedia(item.id)
                                setOpenMenus(prev => ({ ...prev, [item.id]: false }))
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </>
                        )}
                        {item.uploadedBy !== user?.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowReportDialog({ itemId: item.id, type: 'media' })
                              setOpenMenus(prev => ({ ...prev, [item.id]: false }))
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
                </div>
                
                <div className="p-3">
                  {renamingItem === item.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation()
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            renameMedia(item.id, newName)
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            setRenamingItem(null)
                            setNewName('')
                          }
                        }}
                        onBlur={(e) => {
                          e.stopPropagation()
                          renameMedia(item.id, newName)
                        }}
                        autoFocus
                        className="flex-1 text-sm font-heading text-text-primary bg-transparent border border-primary-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <div className="text-sm font-heading text-text-primary truncate">
                      {item.originalName}
                    </div>
                  )}
                  <div className="text-xs text-text-secondary font-body mt-1">
                    {formatFileSize(item.fileSize)} • {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                  
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs bg-primary-50 text-primary-600 px-2 py-1 rounded font-body"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="text-xs text-text-secondary font-body">
                          +{item.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:pl-4 pl-16">
          <div className="bg-bg-primary rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold font-heading text-text-primary">Upload Media</h3>
              <button
                onClick={() => {
                  setShowUpload(false)
                  setSelectedFiles([])
                  setUploadProgress({})
                  setError(null)
                }}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Drag and Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragOver
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-border-primary hover:border-primary-300'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragOver ? 'text-primary-500' : 'text-text-secondary'}`} />
                <p className="text-text-primary font-heading mb-2">
                  {isDragOver ? 'Drop files here!' : 'Drop files here or click to browse'}
                </p>
                <p className="text-sm text-text-secondary font-body mb-4">
                  Supports images and videos (max 128MB each)
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors cursor-pointer font-heading"
                >
                  Choose Files
                </label>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-heading text-text-primary">Selected Files ({selectedFiles.length})</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg">
                        <div className="flex-shrink-0">
                          {file.type.startsWith('video/') ? (
                            <FileVideo className="w-8 h-8 text-red-500" />
                          ) : (
                            <FileImage className="w-8 h-8 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                          <p className="text-xs text-text-secondary">
                            {formatFileSize(file.size)} • {file.type.split('/')[1].toUpperCase()}
                          </p>
                        </div>
                        <button
                          onClick={() => removeSelectedFile(index)}
                          className="flex-shrink-0 p-1 text-text-secondary hover:text-red-500 transition-colors"
                          disabled={isUploading}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && Object.keys(uploadProgress).length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-heading text-text-primary">Uploading...</h4>
                  {Object.entries(uploadProgress).map(([fileId, progress]) => (
                    <div key={fileId} className="bg-bg-tertiary rounded-lg p-3">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-text-primary">File {fileId.split('-')[1]}</span>
                        <span className="text-text-secondary">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-border-primary">
                <button
                  onClick={() => {
                    setShowUpload(false)
                    setSelectedFiles([])
                    setUploadProgress({})
                    setError(null)
                  }}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleFileUpload}
                  disabled={selectedFiles.length === 0 || isUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-heading"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {playingItem && playingItem.mediaType === 'video' && (
        <div 
          className={`fixed inset-0 bg-black z-50 flex items-center justify-center ${isMobile ? '' : 'bg-opacity-90'}`}
          onClick={() => setPlayingItem(null)}
        >
          <div 
            className={`relative ${isMobile ? 'w-full h-full' : 'w-full max-w-5xl mx-4'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setPlayingItem(null)}
              className={`absolute top-4 right-4 z-10 p-2 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-75 transition-colors ${isMobile ? 'top-8 right-8' : ''}`}
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* Download button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                downloadMedia(playingItem)
              }}
              className={`absolute top-4 right-16 z-10 p-2 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-75 transition-colors ${isMobile ? 'top-8 right-20' : ''}`}
            >
              <Download className="w-6 h-6" />
            </button>
            
            {/* Video player */}
            <video
              src={playingItem.uploadUrl}
              controls
              autoPlay
              muted={false}
              playsInline
              preload="metadata"
              controlsList={isMobile ? "nodownload" : ""}
              className={`w-full ${isMobile ? 'h-full object-contain' : 'max-h-[80vh] object-contain'} bg-black rounded-lg`}
              onError={(e) => {
                console.error('Video playback error:', e)
                setError('Failed to play video')
              }}
              onLoadStart={() => console.log('Video loading started')}
              onCanPlay={() => console.log('Video can play')}
            >
              <source src={playingItem.uploadUrl} type={playingItem.mimeType} />
              Your browser does not support the video tag.
            </video>
            
            {/* Video info overlay */}
            {!isMobile && (
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded-lg max-w-md">
                <h3 className="font-semibold text-sm mb-1">{playingItem.originalName}</h3>
                <div className="text-xs text-gray-300 space-y-1">
                  <div>Size: {formatFileSize(playingItem.fileSize)}</div>
                  {playingItem.duration && <div>Duration: {formatDuration(playingItem.duration)}</div>}
                  {playingItem.width && playingItem.height && (
                    <div>Resolution: {playingItem.width} × {playingItem.height}</div>
                  )}
                  <div>Uploaded: {new Date(playingItem.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Media Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 lg:pl-4 pl-16">
          <div className="bg-bg-primary rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-border-primary">
              <h3 className="text-lg font-bold font-heading text-text-primary">
                {selectedItem.originalName}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadMedia(selectedItem)}
                  className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
                >
                  <Download className="w-5 h-5" />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => deleteMedia(selectedItem.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-4">
              <div className="mb-4">
                {selectedItem.mediaType === 'video' ? (
                  <video
                    src={selectedItem.uploadUrl}
                    controls
                    autoPlay
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full max-h-[60vh] object-contain bg-black rounded-lg"
                    onError={(e) => {
                      console.error('Video playback error:', e);
                    }}
                  >
                    <source src={selectedItem.uploadUrl} type={selectedItem.mimeType} />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <img
                    src={selectedItem.uploadUrl}
                    alt={selectedItem.originalName}
                    className="w-full max-h-[60vh] object-contain rounded-lg"
                  />
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-body">
                <div>
                  <div className="text-text-secondary">File Size</div>
                  <div className="text-text-primary">{formatFileSize(selectedItem.fileSize)}</div>
                </div>
                <div>
                  <div className="text-text-secondary">Uploaded</div>
                  <div className="text-text-primary">
                    {new Date(selectedItem.createdAt).toLocaleDateString()} by {selectedItem.uploaderName || 'Unknown'}
                  </div>
                </div>
                {selectedItem.width && selectedItem.height && (
                  <div>
                    <div className="text-text-secondary">Dimensions</div>
                    <div className="text-text-primary">{selectedItem.width} × {selectedItem.height}</div>
                  </div>
                )}
                {selectedItem.duration && (
                  <div>
                    <div className="text-text-secondary">Duration</div>
                    <div className="text-text-primary">{formatDuration(selectedItem.duration)}</div>
                  </div>
                )}
              </div>
              
              {isAdmin && (
                <div className="mt-4 pt-4 border-t border-border-primary">
                  <TagEditor
                    tags={selectedItem.tags || []}
                    onUpdate={(tags) => updateTags(selectedItem.id, tags)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Dialog */}
      {showReportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:pl-4 pl-16">
          <div className="bg-bg-primary rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold font-heading text-text-primary">Report Media</h3>
              <button
                onClick={() => {
                  setShowReportDialog(null)
                  setReportReason('')
                }}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Why are you reporting this media?
                </label>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Please describe why you're reporting this content..."
                  className="w-full px-3 py-2 border border-border-primary rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none bg-bg-primary text-text-primary"
                  rows={4}
                />
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowReportDialog(null)
                    setReportReason('')
                  }}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={reportMedia}
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

// Tag Editor Component for Admin
interface TagEditorProps {
  tags: string[]
  onUpdate: (tags: string[]) => void
}

function TagEditor({ tags, onUpdate }: TagEditorProps) {
  const [newTag, setNewTag] = useState('')
  const [suggestions] = useState([
    'basketball', 'training', 'game', 'practice', 'drills', 'highlight', 
    'skills', 'team', 'shot', 'defense', 'offense', 'workout'
  ])

  const addTag = () => {
    const trimmedTag = newTag.trim().toLowerCase()
    if (trimmedTag && !tags.map(t => t.toLowerCase()).includes(trimmedTag)) {
      onUpdate([...tags, trimmedTag])
      setNewTag('')
    }
  }

  const addSuggestion = (suggestion: string) => {
    if (!tags.map(t => t.toLowerCase()).includes(suggestion.toLowerCase())) {
      onUpdate([...tags, suggestion])
    }
  }

  const removeTag = (tagToRemove: string) => {
    onUpdate(tags.filter(tag => tag !== tagToRemove))
  }

  const filteredSuggestions = suggestions.filter(suggestion => 
    !tags.map(t => t.toLowerCase()).includes(suggestion.toLowerCase()) &&
    suggestion.toLowerCase().includes(newTag.toLowerCase())
  )

  return (
    <div>
      <div className="text-text-secondary font-body mb-2">Tags {!tags.length && '(click suggestions below to add)'}</div>
      
      {/* Current tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="flex items-center gap-1 bg-primary-50 text-primary-600 px-2 py-1 rounded text-xs font-body"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-primary-400 hover:text-primary-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      
      {/* Add new tag */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Add custom tag..."
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag()
            }
          }}
          className="flex-1 px-3 py-1 rounded border border-border-primary bg-bg-primary text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-body"
        />
        <button
          onClick={addTag}
          disabled={!newTag.trim()}
          className="px-3 py-1 bg-primary-600 text-white rounded text-sm font-heading hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>
      
      {/* Tag suggestions */}
      <div>
        <div className="text-xs text-text-secondary mb-2">Quick tags:</div>
        <div className="flex flex-wrap gap-1">
          {(newTag ? filteredSuggestions : suggestions.filter(s => !tags.map(t => t.toLowerCase()).includes(s.toLowerCase()))).slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => addSuggestion(suggestion)}
              className="px-2 py-1 text-xs bg-bg-tertiary text-text-secondary hover:bg-primary-100 hover:text-primary-600 rounded transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}