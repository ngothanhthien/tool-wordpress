import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WatermarkRepository } from './watermark'

describe('WatermarkRepository', () => {
  let repository: WatermarkRepository
  const mockApiKey = 'test-api-key-12345'

  beforeEach(() => {
    repository = new WatermarkRepository('http://localhost:8005', mockApiKey)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should throw error if API key is empty', () => {
    expect(() => new WatermarkRepository('http://localhost:8005', '')).toThrow('API key is required')
  })

  it('should successfully apply watermark to image URL', async () => {
    const mockResponse = {
      success: true,
      watermarked_url: 'https://example.com/watermarked.jpg',
      original_url: 'https://picsum.photos/800/600',
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    ) as any

    const result = await repository.applyWatermark({
      image_url: 'https://picsum.photos/800/600',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.watermarked_url).toBe('https://example.com/watermarked.jpg')
    }
  })

  it('should return error on API failure', async () => {
    const mockErrorResponse = {
      success: false,
      error: 'Invalid image URL',
      code: 400,
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve(mockErrorResponse),
      })
    ) as any

    const result = await repository.applyWatermark({
      image_url: 'https://example.com/invalid.jpg',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Invalid image URL')
    }
  })

  it('should handle network errors gracefully', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    ) as any

    const result = await repository.applyWatermark({
      image_url: 'https://example.com/image.jpg',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Network error')
    }
  })

  it('should accept optional watermark options', async () => {
    const mockResponse = {
      success: true,
      watermarked_url: 'https://example.com/watermarked-custom.jpg',
      original_url: 'https://picsum.photos/800/600',
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    ) as any

    const result = await repository.applyWatermark(
      { image_url: 'https://picsum.photos/800/600' },
      { position: 'bottom-right', opacity: 80 }
    )

    expect(result.success).toBe(true)
    expect(global.fetch).toHaveBeenCalled()
  })
})
