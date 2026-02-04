import { describe, it, expect } from 'vitest'
import { imgbbResponseSchema } from './ImgBB.schema'

describe('ImgBB Schema', () => {
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
})
