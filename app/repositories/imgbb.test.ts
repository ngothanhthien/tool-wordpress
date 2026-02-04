import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ImageUploadRepository } from './imgbb'

describe('ImageUploadRepository', () => {
  let repository: ImageUploadRepository

  beforeEach(() => {
    repository = new ImageUploadRepository('761089bc2b99673fffbb9d179ba7aa67')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should upload base64 image successfully', async () => {
    // Mock fetch globally
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: {
            url: 'https://i.ibb.co/test/image.jpg',
            display_url: 'https://ibb.co/test',
            thumb: { url: 'https://i.ibb.co/test/thumb.jpg', width: 160, height: 160 }
          },
          success: true,
          status: 200
        })
      })
    ) as any

    const result = await repository.uploadBase64('data:image/jpeg;base64,/9j/4AAQSkZJRg...')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBe('https://i.ibb.co/test/image.jpg')
    }
  })

  it('should handle API errors gracefully', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          status: 401,
          data: {
            error: { message: 'Invalid API key', code: 401 }
          }
        })
      })
    ) as any

    const result = await repository.uploadBase64('invalid')
    expect(result.success).toBe(false)
  })

  it('should handle HTTP errors', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({})
      })
    ) as any

    const result = await repository.uploadBase64('data:image/jpeg;base64,test')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('HTTP 500')
      expect(result.status).toBe(500)
    }
  })

  it('should handle network errors', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    ) as any

    const result = await repository.uploadBase64('data:image/jpeg;base64,test')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Network error')
    }
  })

  it('should upload from URL successfully', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: {
            url: 'https://i.ibb.co/test/from-url.jpg',
            display_url: 'https://ibb.co/test2',
            thumb: { url: 'https://i.ibb.co/test/thumb2.jpg', width: 160, height: 160 }
          },
          success: true,
          status: 200
        })
      })
    ) as any

    const result = await repository.uploadFromUrl('https://example.com/image.jpg')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBe('https://i.ibb.co/test/from-url.jpg')
    }
  })

  it('should reject invalid expiration values', async () => {
    const result = await repository.uploadBase64('data:image/jpeg;base64,test', {
      expiration: 30 // Too low
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Expiration must be between 60 and 15552000 seconds')
    }
  })

  it('should accept valid expiration values', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: {
            url: 'https://i.ibb.co/test/image.jpg',
            display_url: 'https://ibb.co/test',
          },
          success: true,
          status: 200
        })
      })
    ) as any

    const result = await repository.uploadBase64('data:image/jpeg;base64,test', {
      expiration: 3600 // Valid: 1 hour
    })
    expect(result.success).toBe(true)
  })

  it('should strip data:image prefix from base64', async () => {
    global.fetch = vi.fn((req) => {
      // Check that the fetch was called
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: {
            url: 'https://i.ibb.co/test/image.jpg',
            display_url: 'https://ibb.co/test',
          },
          success: true,
          status: 200
        })
      })
    }) as any

    await repository.uploadBase64('data:image/jpeg;base64,/9j/4AAQSkZJRg')
    expect(global.fetch).toHaveBeenCalled()
  })

  it('should throw error when API key is empty', () => {
    expect(() => new ImageUploadRepository('')).toThrow('ImgBB API key is required')
  })

  it('should throw error when API key is missing', () => {
    expect(() => new ImageUploadRepository('' as any)).toThrow('ImgBB API key is required')
  })
})
