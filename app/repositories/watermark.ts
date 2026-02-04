import type { WatermarkResponse, WatermarkRequest } from '~/entities/Watermark.schema'

/**
 * Result of watermark application operation
 */
export type WatermarkResult =
  | { success: true; data: WatermarkResponse }
  | { success: false; error: string; status?: number }

/**
 * Request options for watermark application
 */
export interface WatermarkOptions {
  /** Position of watermark (optional, e.g., 'bottom-right', 'center') */
  position?: string
  /** Opacity of watermark (optional, 0-100) */
  opacity?: number
}

/**
 * Repository for applying watermarks via watermark microservice
 * @see http://localhost:8005/water-mark
 */
export class WatermarkRepository {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly endpoint = '/water-mark'

  constructor(baseUrl: string, apiKey: string) {
    if (!apiKey || apiKey.length === 0) {
      throw new Error('API key is required')
    }
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = apiKey
  }

  /**
   * Apply watermark to an image URL
   * @param request - Object containing image_url
   * @param options - Optional watermark settings (position, opacity)
   */
  async applyWatermark(request: WatermarkRequest, options?: WatermarkOptions): Promise<WatermarkResult> {
    try {
      // Validate URL format
      new URL(request.image_url)

      // Build request body
      const requestBody: Record<string, unknown> = {
        image_url: request.image_url,
      }

      if (options?.position) {
        requestBody.position = options.position
      }

      if (options?.opacity !== undefined) {
        requestBody.opacity = options.opacity
      }

      // Execute API call
      const response = await fetch(`${this.baseUrl}${this.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        // Try to parse error response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = await response.json() as { error?: string }
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          // Use default error message if JSON parsing fails
        }
        return {
          success: false,
          error: errorMessage,
          status: response.status,
        }
      }

      const data = await response.json() as WatermarkResponse

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }
}
