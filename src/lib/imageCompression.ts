/**
 * Image compression utility for reducing file sizes before upload
 * Compresses images to JPEG format with configurable quality and max dimensions
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.7,
  mimeType: 'image/jpeg',
};

/**
 * Compresses an image file to reduce file size
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<Blob> - The compressed image as a Blob
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          // Calculate new dimensions maintaining aspect ratio
          let { width, height } = img;
          const maxWidth = opts.maxWidth!;
          const maxHeight = opts.maxHeight!;
          
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;
            
            if (width > height) {
              width = maxWidth;
              height = Math.round(width / aspectRatio);
            } else {
              height = maxHeight;
              width = Math.round(height * aspectRatio);
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw image on canvas
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log(`[ImageCompression] Compressed from ${(file.size / 1024).toFixed(1)}KB to ${(blob.size / 1024).toFixed(1)}KB (${((1 - blob.size / file.size) * 100).toFixed(0)}% reduction)`);
                resolve(blob);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            opts.mimeType,
            opts.quality
          );
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a Blob to a File object
 * @param blob - The blob to convert
 * @param fileName - The name for the new file
 * @returns File
 */
export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type });
}

/**
 * Gets the file extension for a given mime type
 * @param mimeType - The mime type
 * @returns string - The file extension
 */
export function getExtensionForMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  return extensions[mimeType] || '.jpg';
}
