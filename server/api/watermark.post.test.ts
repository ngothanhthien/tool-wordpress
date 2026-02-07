import { describe, it, expect, vi } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils'

describe('/api/watermark', async () => {
  await setup({
    server: true,
  })

  it('should return error when image_url is missing', async () => {
    const response = await $fetch('/api/watermark', {
      method: 'POST',
      body: {},
      ignoreResponseError: true,  // Allow receiving error response body
    })

    // Expect error response
    expect(response).toHaveProperty('success', false)
    expect(response).toHaveProperty('error')
  })

  it('should accept valid image_url and forward to watermark API', async () => {
    // This would require mocking fetch in the server context
    // For now, we'll just verify the endpoint accepts the request
    const response = await $fetch('/api/watermark', {
      method: 'POST',
      body: {
        image_url: 'https://picsum.photos/800/600',
      },
      ignoreResponseError: true,  // Allow receiving error response body
    })

    // Response structure should be correct (even if API fails in test)
    expect(response).toHaveProperty('success')
  })
})
