import type { ImgBBImageData } from '~/entities/ImgBB.schema'

/**
 * Upload options for ImgBB
 */
export interface ImgBBUploadOptions {
  /** Custom filename (optional, auto-detected from base64) */
  name?: string
  /** Auto-delete expiration in seconds (60-15552000, optional) */
  expiration?: number
}

/**
 * Result of image upload operation
 */
export type ImageUploadResult =
  | { success: true; data: ImgBBImageData }
  | { success: false; error: string; status?: number }

/**
 * Repository for uploading images to ImgBB hosting service
 * @see https://api.imgbb.com/
 */
export class ImageUploadRepository {
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.imgbb.com/1/upload'

  constructor(apiKey: string) {
    if (!apiKey || apiKey.length === 0) {
      throw new Error('ImgBB API key is required')
    }
    this.apiKey = apiKey
  }

  /**
   * Upload image using base64 encoded data
   * @param base64Data - Base64 encoded image data (with or without data:image prefix)
   * @param options - Upload options (name, expiration)
   */
  async uploadBase64(base64Data: string, options?: ImgBBUploadOptions): Promise<ImageUploadResult> {
    try {
      // Strip data:image/...;base64, prefix if present
      const base64String = base64Data.includes(',')
        ? (base64Data.split(',')[1] ?? base64Data)
        : base64Data

      // Build form data
      const formData = new FormData()
      formData.append('key', this.apiKey)
      formData.append('image', base64String)

      if (options?.name) {
        formData.append('name', options.name)
      }

      if (options?.expiration) {
        if (options.expiration < 60 || options.expiration > 15_552_000) {
          return {
            success: false,
            error: 'Expiration must be between 60 and 15552000 seconds'
          }
        }
        formData.append('expiration', options.expiration.toString())
      }

      // Execute upload
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status
        }
      }

      const rawResponse = await response.json()

      // Validate response structure
      if (!rawResponse.success) {
        return {
          success: false,
          error: rawResponse.data?.error?.message || 'Upload failed',
          status: rawResponse.status
        }
      }

      return {
        success: true,
        data: rawResponse.data as ImgBBImageData
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Upload image from a URL
   * @param imageUrl - Public URL of the image to upload
   * @param options - Upload options (name, expiration)
   */
  async uploadFromUrl(imageUrl: string, options?: ImgBBUploadOptions): Promise<ImageUploadResult> {
    try {
      // Validate URL format
      new URL(imageUrl)

      const formData = new FormData()
      formData.append('key', this.apiKey)
      formData.append('image', imageUrl)

      if (options?.name) {
        formData.append('name', options.name)
      }

      if (options?.expiration) {
        if (options.expiration < 60 || options.expiration > 15_552_000) {
          return {
            success: false,
            error: 'Expiration must be between 60 and 15552000 seconds'
          }
        }
        formData.append('expiration', options.expiration.toString())
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status
        }
      }

      const rawResponse = await response.json()

      if (!rawResponse.success) {
        return {
          success: false,
          error: rawResponse.data?.error?.message || 'Upload failed',
          status: rawResponse.status
        }
      }

      return {
        success: true,
        data: rawResponse.data as ImgBBImageData
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}
