import type { ImgBBUploadOptions } from '~/repositories/imgbb'

/**
 * POST /api/upload-image
 *
 * Server-side image upload endpoint using ImgBB
 *
 * Request body:
 * - image: string (base64 data or image URL)
 * - name?: string (optional filename)
 * - expiration?: number (optional expiration in seconds)
 *
 * Response:
 * - success: boolean
 * - data?: { url, display_url, size, ... }
 * - error?: string
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Validate request body
    const image = body.image as string | undefined
    const options: ImgBBUploadOptions = {
      name: body.name as string | undefined,
      expiration: body.expiration as number | undefined,
    }

    if (!image) {
      setResponseStatus(event, 400)
      return {
        success: false,
        error: 'Image data (base64 or URL) is required'
      }
    }

    // Get API key from runtime config
    const config = useRuntimeConfig()
    const apiKey = config.imgbbApiKey as string | undefined

    if (!apiKey) {
      setResponseStatus(event, 500)
      return {
        success: false,
        error: 'ImgBB API key not configured'
      }
    }

    // Import repository and upload
    const { ImageUploadRepository } = await import('~/repositories/imgbb')
    const repository = new ImageUploadRepository(apiKey)

    // Determine upload method based on image format
    let result
    if (image.startsWith('data:image') || image.includes(';base64,')) {
      result = await repository.uploadBase64(image, options)
    } else if (image.startsWith('http://') || image.startsWith('https://')) {
      result = await repository.uploadFromUrl(image, options)
    } else {
      // Treat as base64 without prefix
      result = await repository.uploadBase64(image, options)
    }

    if (!result.success) {
      setResponseStatus(event, result.status || 500)
    }

    return result
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown server error'
    }
  }
})
