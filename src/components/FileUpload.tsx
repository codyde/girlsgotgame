import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, X, Image, Video } from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

interface FileUploadProps {
  onUploadComplete: (url: string) => void
  onClose: () => void
  accept?: string
  maxSize?: number // in MB
}

export function FileUpload({ 
  onUploadComplete, 
  onClose, 
  accept = "image/*,video/*", 
  maxSize = 10 
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`File size must be less than ${maxSize}MB`)
      return
    }

    uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    try {
      setUploading(true)
      setProgress(0)

      // Use appropriate endpoint based on file type
      const isImage = file.type.startsWith('image/')
      const { data, error } = isImage 
        ? await api.uploadImage(file)
        : await api.uploadFile(file)

      if (error) {
        throw new Error(error)
      }

      toast.success('File uploaded successfully!')
      onUploadComplete(data.url)
      onClose()
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error('Upload failed: ' + error.message)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) {
      uploadFile(file)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 lg:pl-4 pl-16 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Upload File</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {uploading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Uploading...</p>
            {progress > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div 
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-500 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary-100 rounded-full">
                <Upload className="w-6 h-6 text-primary-600" />
              </div>
            </div>
            
            <h4 className="text-lg font-medium mb-2">Choose files or drag here</h4>
            <p className="text-gray-500 text-sm mb-4">
              Images and videos up to {maxSize}MB
            </p>
            
            <div className="flex justify-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <Image className="w-4 h-4" />
                JPG, PNG, GIF
              </div>
              <div className="flex items-center gap-1">
                <Video className="w-4 h-4" />
                MP4, MOV
              </div>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 py-2 px-4 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            Choose File
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}