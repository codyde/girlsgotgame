import React, { useState, useEffect } from 'react'
import { Upload, Filter, Tag, Trash2, X, Play, Download, Calendar, MoreVertical, Flag } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { uploadMedia } from '../lib/upload'
import { MediaUpload } from '../types'

type MediaItem = MediaUpload

interface MediaScreenProps {}

export function MediaScreen({}: MediaScreenProps) {
  const { user, profile } = useAuth()
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all')
  const [searchTags, setSearchTags] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({})
  const [showReportDialog, setShowReportDialog] = useState<{ itemId: string; type: 'media' } | null>(null)
  const [reportReason, setReportReason] = useState('')

  const isAdmin = user?.email === 'codydearkland@gmail.com'

  useEffect(() => {
    loadMediaItems()
  }, [filterType, searchTags])

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

  const loadMediaItems = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterType !== 'all') params.append('type', filterType)
      if (searchTags) params.append('tags', searchTags)
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

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const result = await uploadMedia(file)
        if (!result) {
          throw new Error('Upload failed')
        }
      }
      
      await loadMediaItems()
      setShowUpload(false)
    } catch (err) {
      console.error('Error uploading files:', err)
      setError('Failed to upload files')
    } finally {
      setIsUploading(false)
    }
  }

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

    try {
      const response = await api.request(`/media/${itemId}`, {
        method: 'DELETE'
      })
      if (response.error) {
        throw new Error(response.error)
      }
      await loadMediaItems()
      setSelectedItem(null)
    } catch (err) {
      console.error('Error deleting media:', err)
      setError('Failed to delete media')
    }
  }

  const updateTags = async (itemId: string, tags: string[]) => {
    if (!isAdmin) return

    try {
      const response = await api.request(`/media/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ tags })
      })
      if (response.error) {
        throw new Error(response.error)
      }
      await loadMediaItems()
    } catch (err) {
      console.error('Error updating tags:', err)
      setError('Failed to update tags')
    }
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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-lg text-text-secondary">Loading media...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-bg-secondary">
      {/* Header */}
      <div className="bg-bg-primary border-b border-border-primary p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold font-heading text-text-primary">Media Gallery</h1>
            <p className="text-text-secondary font-body mt-1">
              Browse and manage uploaded photos and videos
            </p>
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

        {mediaItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📷</div>
            <h3 className="text-xl font-heading text-text-primary mb-2">No media found</h3>
            <p className="text-text-secondary font-body">Upload some photos or videos to get started!</p>
          </div>
        ) : (
          <div className="masonry-grid">
            {mediaItems.map((item) => (
              <div
                key={item.id}
                className={`masonry-item bg-bg-primary rounded-lg overflow-hidden shadow-sm border border-border-primary cursor-pointer hover:shadow-md transition-shadow ${
                  !item.isVisible && isAdmin ? 'opacity-50' : ''
                }`}
                onClick={() => setSelectedItem(item)}
              >
                <div className="relative">
                  {item.mediaType === 'video' ? (
                    <div className="relative aspect-video bg-gray-100">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.originalName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                          <Play className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black bg-opacity-50 rounded-full p-3">
                          <Play className="w-6 h-6 text-white fill-current" />
                        </div>
                      </div>
                      {item.duration && (
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded font-body">
                          {formatDuration(item.duration)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <img
                      src={item.uploadUrl}
                      alt={item.originalName}
                      className="w-full h-auto object-cover"
                      style={{ aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : 'auto' }}
                    />
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
                        {(item.uploadedBy === user?.id || isAdmin) && (
                          <>
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
                  <div className="text-sm font-heading text-text-primary truncate">
                    {item.originalName}
                  </div>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-primary rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold font-heading text-text-primary">Upload Media</h3>
              <button
                onClick={() => setShowUpload(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border-primary rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                <p className="text-text-primary font-heading mb-2">Drop files here or click to browse</p>
                <p className="text-sm text-text-secondary font-body">Supports images and videos</p>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors cursor-pointer font-heading"
                >
                  Choose Files
                </label>
              </div>
              
              {isUploading && (
                <div className="text-center text-text-secondary font-body">
                  Uploading files...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Media Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-primary rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-border-primary">
              <h3 className="text-lg font-bold font-heading text-text-primary">
                {selectedItem.originalName}
              </h3>
              <div className="flex gap-2">
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
                    className="w-full max-h-[60vh] object-contain bg-black rounded-lg"
                  />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      onUpdate([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    onUpdate(tags.filter(tag => tag !== tagToRemove))
  }

  return (
    <div>
      <div className="text-text-secondary font-body mb-2">Tags (Admin)</div>
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
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add tag..."
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTag()}
          className="flex-1 px-3 py-1 rounded border border-border-primary bg-bg-primary text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-body"
        />
        <button
          onClick={addTag}
          className="px-3 py-1 bg-primary-600 text-white rounded text-sm font-heading hover:bg-primary-700 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}