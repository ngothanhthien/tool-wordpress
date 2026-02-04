import { describe, it, expect } from 'vitest'
import { watermarkResponseSchema, watermarkErrorSchema, watermarkApiResponseSchema } from './Watermark.schema'

describe('Watermark Schema', () => {
  it('should validate successful watermark response', () => {
    const successResponse = {
      success: true,
      watermarked_url: 'https://example.com/watermarked.jpg',
      original_url: 'https://example.com/original.jpg',
    }
    const result = watermarkResponseSchema.safeParse(successResponse)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.watermarked_url).toBe('https://example.com/watermarked.jpg')
    }
  })

  it('should validate error response', () => {
    const errorResponse = {
      success: false,
      error: 'Failed to process image',
      code: 400,
    }
    const result = watermarkErrorSchema.safeParse(errorResponse)
    expect(result.success).toBe(true)
  })

  it('should reject invalid success response (missing watermarked_url)', () => {
    const invalidResponse = {
      success: true,
      original_url: 'https://example.com/original.jpg',
    }
    const result = watermarkResponseSchema.safeParse(invalidResponse)
    expect(result.success).toBe(false)
  })
})
