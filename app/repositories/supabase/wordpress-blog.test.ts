import { describe, it, expect, vi } from 'vitest'
import { WordPressBlogRepository } from './wordpress-blog'

describe('WordPressBlogRepository', () => {
  it('throws error when credentials missing', () => {
    expect(() => {
      new WordPressBlogRepository({
        wooCommerceUrl: '',
        wooCommerceConsumerKey: '',
        wooCommerceConsumerSecret: '',
      })
    }).toThrow('WordPress/WooCommerce credentials not configured')
  })

  it('constructs auth header correctly', () => {
    const repo = new WordPressBlogRepository({
      wooCommerceUrl: 'https://example.com',
      wooCommerceConsumerKey: 'key',
      wooCommerceConsumerSecret: 'secret',
    })

    const authHeader = (repo as any).getAuthHeader()
    expect(authHeader).toBe('Basic a2V5OnNlY3JldA==')
  })

  it('builds correct API URL with pagination', async () => {
    const repo = new WordPressBlogRepository({
      wooCommerceUrl: 'https://example.com',
      wooCommerceConsumerKey: 'key',
      wooCommerceConsumerSecret: 'secret',
    })

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
      headers: new Headers(),
    } as Response)

    await repo.listPosts({ page: 2, perPage: 50 })

    const expectedUrl = new URL('https://example.com/wp-json/wp/v2/posts')
    expectedUrl.searchParams.set('page', '2')
    expectedUrl.searchParams.set('per_page', '50')
    expectedUrl.searchParams.set('status', 'publish')
    expectedUrl.searchParams.set('_fields', 'id,title,content,excerpt,slug,link,status,date,modified,author,featured_media,categories,tags,yoast_meta')

    expect(fetchSpy).toHaveBeenCalledWith(
      expectedUrl.toString(),
      expect.objectContaining({
        headers: expect.any(Object),
      })
    )

    fetchSpy.mockRestore()
  })
})
