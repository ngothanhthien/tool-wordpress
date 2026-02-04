import type { WatermarkRequest } from '~/entities/Watermark.schema'

/**
 * POST /api/watermark
 *
 * Server-side watermark application endpoint
 *
 * Request body:
 * - image_url: string (public URL of image to watermark)
 * - position?: string (optional watermark position)
 * - opacity?: number (optional watermark opacity 0-100)
 *
 * Response:
 * - success: boolean
 * - data?: { watermarked_url, original_url }
 * - error?: string
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Validate required field
    const imageUrl = body.image_url as string | undefined

    if (!imageUrl) {
      setResponseStatus(event, 400)
      return {
        success: false,
        error: 'image_url is required'
      }
    }

    // Validate URL format
    try {
      new URL(imageUrl)
    } catch {
      setResponseStatus(event, 400)
      return {
        success: false,
        error: 'image_url must be a valid URL'
      }
    }

    // Get API config from runtime config
    const config = useRuntimeConfig()
    const apiKey = config.watermarkApiKey as string | undefined
    const baseUrl = config.watermarkBaseUrl as string | undefined || 'http://localhost:8005'

    if (!apiKey) {
      setResponseStatus(event, 500)
      return {
        success: false,
        error: 'Watermark API key not configured'
      }
    }

    // Import repository and apply watermark
    const { WatermarkRepository } = await import('~/repositories/watermark')
    const repository = new WatermarkRepository(baseUrl, apiKey)

    // Optional parameters
    const options = {
      position: body.position as string | undefined,
      opacity: body.opacity as number | undefined,
    }

    const request: WatermarkRequest = { image_url: imageUrl }
    const result = await repository.applyWatermark(request, options)

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
