const API_URL = import.meta.env.DEV ? 'http://localhost:3001' : 'https://api.girlsgotgame.app';

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  type: string;
  mediaId?: string; // New field for media tracking
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export async function uploadFile(
  file: File, 
  endpoint: 'single' | 'avatar' | 'media' = 'single',
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress: UploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100)
          };
          onProgress(progress);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve(result);
        } catch (error) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.message || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.open('POST', `${API_URL}/api/upload/${endpoint}`);
    xhr.withCredentials = true; // Include cookies for authentication
    xhr.send(formData);
  });
}

// Convenience functions
export const uploadAvatar = (file: File, onProgress?: (progress: UploadProgress) => void) => 
  uploadFile(file, 'avatar', onProgress);

export const uploadMedia = (file: File, onProgress?: (progress: UploadProgress) => void) => 
  uploadFile(file, 'media', onProgress);

// Validation helpers
export function validateFileSize(file: File, maxSizeMB: number): boolean {
  return file.size <= maxSizeMB * 1024 * 1024;
}

export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}