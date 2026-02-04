import { describe, it, expect } from 'vitest'
import { imgbbResponseSchema, imgbbErrorSchema, imgbbApiResponseSchema } from './ImgBB.schema'

describe('ImgBB Schema', () => {
  describe('Success Response', () => {
    it('should validate successful ImgBB response', () => {
      const mockResponse = {
        data: {
          url: 'https://i.ibb.co/example/image.jpg',
          display_url: 'https://ibb.co/example',
          size: 12345,
          title: 'test.jpg',
          expiration: '2026-02-11 12:00:00',
          delete_url: 'https://ibb.co/example/delete',
          thumb: { url: 'https://i.ibb.co/example/thumb.jpg', width: 160, height: 160 },
          medium: { url: 'https://i.ibb.co/example/medium.jpg', width: 600, height: 600 }
        },
        success: true,
        status: 200
      }

      const result = imgbbResponseSchema.safeParse(mockResponse)
      expect(result.success).toBe(true)
    })

    it('should accept response with only required fields', () => {
      const minimalResponse = {
        data: {
          url: 'https://i.ibb.co/example/image.jpg',
          display_url: 'https://ibb.co/example',
        },
        success: true,
        status: 200
      }
      const result = imgbbResponseSchema.safeParse(minimalResponse)
      expect(result.success).toBe(true)
    })

    it('should reject invalid response with missing url', () => {
      const invalidResponse = {
        data: {
          // url missing
          display_url: 'https://ibb.co/example'
        },
        success: true,
        status: 200
      }

      const result = imgbbResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('should reject invalid URL format', () => {
      const invalidResponse = {
        data: {
          url: 'not-a-valid-url',
          display_url: 'https://ibb.co/example',
        },
        success: true,
        status: 200
      }
      const result = imgbbResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('should reject invalid image dimensions (zero width)', () => {
      const invalidResponse = {
        data: {
          url: 'https://i.ibb.co/example/image.jpg',
          display_url: 'https://ibb.co/example',
          thumb: { url: 'https://i.ibb.co/thumb.jpg', width: 0, height: 160 }
        },
        success: true,
        status: 200
      }
      const result = imgbbResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('should reject success=false for success schema', () => {
      const invalidResponse = {
        data: {
          url: 'https://i.ibb.co/example/image.jpg',
          display_url: 'https://ibb.co/example',
        },
        success: false,
        status: 200
      }
      const result = imgbbResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })

  describe('Error Response', () => {
    it('should validate error response', () => {
      const errorResponse = {
        data: {
          error: {
            message: 'Invalid API key',
            code: 401,
          }
        },
        success: false,
        status: 401
      }

      const result = imgbbErrorSchema.safeParse(errorResponse)
      expect(result.success).toBe(true)
    })

    it('should validate error response with all fields', () => {
      const errorResponse = {
        data: {
          error: {
            message: 'File too large',
            code: 413,
            context: 'max_upload_size: 32MB'
          }
        },
        success: false,
        status: 413
      }

      const result = imgbbErrorSchema.safeParse(errorResponse)
      expect(result.success).toBe(true)
    })

    it('should reject error response with missing message', () => {
      const invalidResponse = {
        data: {
          error: {
            code: 500,
          }
        },
        success: false,
        status: 500
      }

      const result = imgbbErrorSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('should reject success=true for error schema', () => {
      const invalidResponse = {
        data: {
          error: {
            message: 'Some error',
          }
        },
        success: true,
        status: 400
      }
      const result = imgbbErrorSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })

  describe('API Response Union', () => {
    it('should accept valid success response', () => {
      const successResponse = {
        data: {
          url: 'https://i.ibb.co/example/image.jpg',
          display_url: 'https://ibb.co/example',
        },
        success: true,
        status: 200
      }

      const result = imgbbApiResponseSchema.safeParse(successResponse)
      expect(result.success).toBe(true)
    })

    it('should accept valid error response', () => {
      const errorResponse = {
        data: {
          error: {
            message: 'Invalid API key',
          }
        },
        success: false,
        status: 401
      }

      const result = imgbbApiResponseSchema.safeParse(errorResponse)
      expect(result.success).toBe(true)
    })
  })
})
