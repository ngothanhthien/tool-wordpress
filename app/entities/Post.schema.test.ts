import { describe, it, expect } from 'vitest'
import { wpPostSchema, postSchema, syncProgressSchema } from './Post.schema'

describe('Post.schema', () => {
  describe('wpPostSchema', () => {
    it('validates WordPress API response', () => {
      const wpPost = {
        id: 123,
        title: { rendered: 'Test Post' },
        content: { rendered: '<p>Test content</p>' },
        excerpt: { rendered: 'Test excerpt' },
        slug: 'test-post',
        link: 'https://example.com/test-post',
        status: 'publish',
        date: '2024-01-01T00:00:00Z',
        modified: '2024-01-01T00:00:00Z',
        author: 1,
        featured_media: 456,
        categories: [1, 2],
        tags: [3, 4],
      }

      const result = wpPostSchema.safeParse(wpPost)
      expect(result.success).toBe(true)
    })

    it('rejects invalid datetime format', () => {
      const wpPost = {
        id: 123,
        title: { rendered: 'Test Post' },
        content: { rendered: '<p>Test content</p>' },
        slug: 'test-post',
        link: 'https://example.com/test-post',
        status: 'publish',
        date: 'not-a-datetime',  // Invalid format
        modified: '2024-01-01T00:00:00Z',
        author: 1,
        categories: [1],
        tags: [],
      }
      const result = wpPostSchema.safeParse(wpPost)
      expect(result.success).toBe(false)
    })
  })

  describe('syncProgressSchema', () => {
    it('validates progress event', () => {
      const progress = { status: 'progress' as const, total: 100, processed: 45 }
      const result = syncProgressSchema.safeParse(progress)
      expect(result.success).toBe(true)
    })

    it('rejects invalid sync progress status', () => {
      const invalid = { status: 'invalid' }
      const result = syncProgressSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('postSchema', () => {
    it('validates a complete post object', () => {
      const post = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        wordpress_id: 123,
        title: 'Test Post',
        slug: 'test-post',
        content: '<p>Content</p>',
        excerpt: 'Excerpt',
        featured_image_url: 'https://example.com/img.jpg',
        featured_image_alt: 'Alt text',
        status: 'publish',
        wordpress_url: 'https://example.com/post',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        wordpress_date: '2024-01-01T00:00:00Z',
        wordpress_modified: '2024-01-01T00:00:00Z',
        last_synced_at: '2024-01-01T00:00:00Z',
        author_id: 1,
        author_name: 'Author Name',
        seo_title: 'SEO Title',
        seo_description: 'SEO Desc',
        seo_focus_keyword: 'keyword',
        categories: [{ id: 1, name: 'Cat', slug: 'cat' }],
        tags: [{ id: 2, name: 'Tag', slug: 'tag' }],
      }
      const result = postSchema.safeParse(post)
      expect(result.success).toBe(true)
    })

    it('validates with nullable fields', () => {
      const minimalPost = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        wordpress_id: 123,
        title: 'Test Post',
        slug: 'test-post',
        content: '<p>Content</p>',
        excerpt: null,
        featured_image_url: null,
        featured_image_alt: null,
        status: 'publish',
        wordpress_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        wordpress_date: null,
        wordpress_modified: null,
        last_synced_at: '2024-01-01T00:00:00Z',
        author_id: null,
        author_name: null,
        seo_title: null,
        seo_description: null,
        seo_focus_keyword: null,
        categories: [],
        tags: [],
      }
      const result = postSchema.safeParse(minimalPost)
      expect(result.success).toBe(true)
    })
  })
})
