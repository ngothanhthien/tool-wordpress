import { z } from 'zod'

// WordPress API response types (subset we use)
export const wpPostSchema = z.object({
  id: z.number(),
  title: z.object({ rendered: z.string() }),
  content: z.object({ rendered: z.string() }),
  excerpt: z.object({ rendered: z.string() }).nullable().optional(),
  slug: z.string(),
  link: z.string(),
  status: z.string(),
  date: z.string().datetime({ offset: true }),
  modified: z.string().datetime({ offset: true }),
  author: z.number(),
  featured_media: z.number().nullable().optional(),
  categories: z.array(z.number()),
  tags: z.array(z.number()),
  yoast_meta: z.record(z.string(), z.any()).optional(),
})

export type WpPost = z.infer<typeof wpPostSchema>
export type WpPostInsert = z.input<typeof wpPostSchema>

// Supabase post schema
export const postSchema = z.object({
  id: z.string().uuid(),
  wordpress_id: z.number(),
  title: z.string(),
  slug: z.string(),
  content: z.string(),
  excerpt: z.string().nullable(),
  featured_image_url: z.string().nullable(),
  featured_image_alt: z.string().nullable(),
  status: z.string(),
  wordpress_url: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  wordpress_date: z.string().datetime().nullable(),
  wordpress_modified: z.string().datetime().nullable(),
  last_synced_at: z.string().datetime(),
  author_id: z.number().nullable(),
  author_name: z.string().nullable(),
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  seo_focus_keyword: z.string().nullable(),
  categories: z.array(z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
  })),
  tags: z.array(z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
  })),
})

export type Post = z.infer<typeof postSchema>
export type PostInsert = z.input<typeof postSchema>
export type PostUpdate = Partial<PostInsert>

// Sync progress schema
export const syncProgressSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('idle') }),
  z.object({ status: z.literal('started'), message: z.string() }),
  z.object({
    status: z.literal('progress'),
    total: z.number(),
    processed: z.number(),
    message: z.string().optional(),
  }),
  z.object({
    status: z.literal('complete'),
    total: z.number(),
    processed: z.number(),
    message: z.string(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
])

export type SyncProgress = z.infer<typeof syncProgressSchema>
