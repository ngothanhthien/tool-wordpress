# WordPress Blog Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build feature to sync WordPress blog posts to Supabase with manual sync button on `/blogs` page.

**Architecture:** New `WordPressBlogRepository` fetches posts via WordPress REST API v2, stores in `posts` table with full content/metadata, sync API streams progress via SSE, frontend displays posts and triggers syncs.

**Tech Stack:** Nuxt 4, Supabase, Zod v4, TypeScript, Vue 3 Composition API, Server-Sent Events

---

## Task 1: Create Supabase Migration for posts Table

**Files:**
- Create: `supabase/migrations/YYYYMMDDxxxx_create_posts_table.sql`

**Step 1: Write migration SQL**

Create file with:

```sql
-- Create posts table for WordPress blog sync
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wordpress_id BIGINT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image_url TEXT,
  featured_image_alt TEXT,
  status TEXT NOT NULL,
  wordpress_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  wordpress_date TIMESTAMPTZ,
  wordpress_modified TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  author_id BIGINT,
  author_name TEXT,

  seo_title TEXT,
  seo_description TEXT,
  seo_focus_keyword TEXT,

  categories JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_posts_wordpress_id ON posts(wordpress_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_wordpress_date ON posts(wordpress_date DESC);

-- Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read posts
CREATE POLICY "Allow authenticated read" ON posts
  FOR SELECT TO authenticated
  USING (true);

-- Policy: Allow service role to insert/update posts
CREATE POLICY "Allow service role write" ON posts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
```

**Step 2: Run migration manually**

```bash
# Get Supabase connection details from env
source .env

# Run migration via psql or Supabase dashboard
# Or use: supabase db push (if using Supabase CLI)
```

**Step 3: Generate TypeScript types**

```bash
bun run gen:types
```

Expected: `app/types/database.types.ts` updated with `posts` table type

**Step 4: Verify table creation**

Check Supabase dashboard or query:

```sql
SELECT * FROM posts LIMIT 1;
```

Expected: Empty table, no error

**Step 5: Commit**

```bash
git add supabase/migrations/ app/types/database.types.ts
git commit -m "feat: add posts table migration"
```

---

## Task 2: Create Post Entity Schema (Zod)

**Files:**
- Create: `app/entities/Post.schema.ts`
- Create: `app/entities/Post.schema.test.ts`

**Step 1: Write the schema**

Create `app/entities/Post.schema.ts`:

```typescript
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
  date: z.string().datetime(),
  modified: z.string().datetime(),
  author: z.number(),
  featured_media: z.number().nullable().optional(),
  categories: z.array(z.number()),
  tags: z.array(z.number()),
  yoast_meta: z.record(z.string(), z.any()).optional(),
})

export type WpPost = z.infer<typeof wpPostSchema>

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
```

**Step 2: Write failing test**

Create `app/entities/Post.schema.test.ts`:

```typescript
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
        date: '2024-01-01T00:00:00',
        modified: '2024-01-01T00:00:00',
        author: 1,
        featured_media: 456,
        categories: [1, 2],
        tags: [3, 4],
      }

      const result = wpPostSchema.safeParse(wpPost)
      expect(result.success).toBe(true)
    })
  })

  describe('syncProgressSchema', () => {
    it('validates progress event', () => {
      const progress = { status: 'progress' as const, total: 100, processed: 45 }
      const result = syncProgressSchema.safeParse(progress)
      expect(result.success).toBe(true)
    })
  })
})
```

**Step 3: Run test to verify it fails**

```bash
bun run test app/entities/Post.schema.test.ts
```

Expected: FAIL - file not found

**Step 4: Run test to verify it passes**

```bash
bun run test app/entities/Post.schema.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/entities/Post.schema.ts app/entities/Post.schema.test.ts
git commit -m "feat: add Post entity schema with Zod validation"
```

---

## Task 3: Create WordPressBlogRepository

**Files:**
- Create: `app/repositories/supabase/wordpress-blog.ts`
- Create: `app/repositories/supabase/wordpress-blog.test.ts`

**Step 1: Write the repository**

Create `app/repositories/supabase/wordpress-blog.ts`:

```typescript
import type { NuxtRuntimeConfig } from 'nuxt/app'
import type { WpPost, Post } from '~/entities/Post.schema'

interface WordPressBlogRepositoryOptions {
  baseUrl: string
  consumerKey: string
  consumerSecret: string
}

export class WordPressBlogRepository {
  private options: WordPressBlogRepositoryOptions

  constructor(config: Pick<NuxtRuntimeConfig, 'wooCommerceUrl' | 'wooCommerceConsumerKey' | 'wooCommerceConsumerSecret'>) {
    this.options = {
      baseUrl: config.wooCommerceUrl!,
      consumerKey: config.wooCommerceConsumerKey!,
      consumerSecret: config.wooCommerceConsumerSecret!,
    }

    if (!this.options.baseUrl || !this.options.consumerKey || !this.options.consumerSecret) {
      throw new Error('WordPress/WooCommerce credentials not configured')
    }
  }

  private getAuthHeader(): string {
    const { consumerKey, consumerSecret } = this.options
    const token = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
    return `Basic ${token}`
  }

  async listPosts(options: { page?: number; perPage?: number; status?: string } = {}): Promise<WpPost[]> {
    const { page = 1, perPage = 20, status = 'publish' } = options
    const url = new URL(`${this.options.baseUrl}/wp-json/wp/v2/posts`)
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', String(perPage))
    url.searchParams.set('status', status)
    url.searchParams.set('_fields', 'id,title,content,excerpt,slug,link,status,date,modified,author,featured_media,categories,tags,yoast_meta')

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`WordPress API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return Array.isArray(data) ? data : []
  }

  async getTotalPosts(): Promise<number> {
    const url = new URL(`${this.options.baseUrl}/wp-json/wp/v2/posts`)
    url.searchParams.set('per_page', '1')
    url.searchParams.set('status', 'publish')

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': this.getAuthHeader() },
    })

    if (!response.ok) {
      throw new Error(`WordPress API error: ${response.status} ${response.statusText}`)
    }

    const totalHeader = response.headers.get('X-WP-Total')
    return totalHeader ? parseInt(totalHeader, 10) : 0
  }

  transformPost(wpPost: WpPost): Partial<Post> {
    return {
      wordpress_id: wpPost.id,
      title: wpPost.title.rendered,
      slug: wpPost.slug,
      content: wpPost.content.rendered,
      excerpt: wpPost.excerpt?.rendered || null,
      featured_image_url: wpPost.featured_media ? null : null, // TODO: fetch media URL
      featured_image_alt: null,
      status: wpPost.status,
      wordpress_url: wpPost.link,
      wordpress_date: wpPost.date,
      wordpress_modified: wpPost.modified,
      author_id: wpPost.author,
      seo_title: wpPost.yoast_meta?.yoast_title || null,
      seo_description: wpPost.yoast_meta?.yoast_description || null,
      seo_focus_keyword: wpPost.yoast_meta?.yoast_focuskw || null,
      categories: wpPost.categories.map(id => ({ id, name: '', slug: '' })),
      tags: wpPost.tags.map(id => ({ id, name: '', slug: '' })),
      last_synced_at: new Date().toISOString(),
    }
  }
}
```

**Step 2: Write failing test**

Create `app/repositories/supabase/wordpress-blog.test.ts`:

```typescript
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

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/wp-json/wp/v2/posts?page=2&per_page=50&status=publish&_fields=id,title,content,excerpt,slug,link,status,date,modified,author,featured_media,categories,tags,yoast_meta',
      expect.objectContaining({
        headers: expect.any(Object),
      })
    )

    fetchSpy.mockRestore()
  })
})
```

**Step 3: Run test to verify it fails**

```bash
bun run test app/repositories/supabase/wordpress-blog.test.ts
```

Expected: FAIL - file not found

**Step 4: Run test to verify it passes**

```bash
bun run test app/repositories/supabase/wordpress-blog.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/repositories/supabase/wordpress-blog.ts app/repositories/supabase/wordpress-blog.test.ts
git commit -m "feat: add WordPressBlogRepository"
```

---

## Task 4: Create Sync API Endpoint

**Files:**
- Create: `server/api/sync/wordpress/posts.post.ts`
- Create: `server/api/sync/wordpress/posts.post.test.ts`

**Step 1: Write the API endpoint**

Create `server/api/sync/wordpress/posts.post.ts`:

```typescript
import type { Database } from '~/types/database.types'

type PostRow = Database['public']['Tables']['posts']['Insert']

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabase = await useSupabaseClient(event)

  // Set up SSE for progress streaming
  setHeader(event, 'content-type', 'text/event-stream')
  setHeader(event, 'cache-control', 'no-cache')
  setHeader(event, 'connection', 'keep-alive')

  const sendProgress = (data: { status: string; total?: number; processed?: number; message?: string }) => {
    event.node.res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const { WordPressBlogRepository } = await import('~/repositories/supabase/wordpress-blog')
    const repo = new WordPressBlogRepository(config)

    sendProgress({ status: 'started', message: 'Starting sync...' })

    // Get total count
    const total = await repo.getTotalPosts()
    sendProgress({ status: 'progress', total, processed: 0 })

    let processed = 0
    let page = 1
    const perPage = 20

    while (true) {
      const wpPosts = await repo.listPosts({ page, perPage, status: 'publish' })

      if (wpPosts.length === 0) break

      for (const wpPost of wpPosts) {
        const transformed = repo.transformPost(wpPost)

        await supabase.from('posts').upsert({
          wordpress_id: transformed.wordpress_id!,
          title: transformed.title!,
          slug: transformed.slug!,
          content: transformed.content!,
          excerpt: transformed.excerpt,
          featured_image_url: transformed.featured_image_url,
          status: transformed.status!,
          wordpress_url: transformed.wordpress_url,
          wordpress_date: transformed.wordpress_date,
          wordpress_modified: transformed.wordpress_modified,
          author_id: transformed.author_id,
          seo_title: transformed.seo_title,
          seo_description: transformed.seo_description,
          seo_focus_keyword: transformed.seo_focus_keyword,
          categories: transformed.categories || [],
          tags: transformed.tags || [],
          last_synced_at: new Date().toISOString(),
        } as PostRow, { onConflict: 'wordpress_id' })

        processed++
        sendProgress({ status: 'progress', total, processed })
      }

      page++
    }

    sendProgress({ status: 'complete', total, processed, message: 'Sync complete!' })
  } catch (error: any) {
    sendProgress({ status: 'error', message: error.message })
  }

  event.node.res.end()
})
```

**Step 2: Write integration test**

Create `server/api/sync/wordpress/posts.post.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils'

await setup({
  server: true,
})

describe('/api/sync/wordpress/posts', () => {
  it('returns streaming response', async () => {
    const response = await $fetch('/api/sync/wordpress/posts', {
      method: 'POST',
      ignoreResponseError: true,
    })

    // SSE responses are text/event-stream, this test verifies endpoint exists
    expect(response).toBeDefined()
  })
})
```

**Step 3: Run test to verify it fails**

```bash
bun run test server/api/sync/wordpress/posts.post.test.ts
```

Expected: FAIL - endpoint not found

**Step 4: Run test to verify it passes**

```bash
bun run test server/api/sync/wordpress/posts.post.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add server/api/sync/wordpress/posts.post.ts server/api/sync/wordpress/posts.post.test.ts
git commit -m "feat: add WordPress sync API endpoint with SSE progress"
```

---

## Task 5: Create List Posts API Endpoint

**Files:**
- Create: `server/api/posts/index.get.ts`
- Create: `server/api/posts/index.get.test.ts`

**Step 1: Write the API endpoint**

Create `server/api/posts/index.get.ts`:

```typescript
export default defineEventHandler(async (event) => {
  const supabase = await useSupabaseClient(event)
  const query = getQuery(event)

  const page = Number(query.page || 0)
  const limit = Number(query.limit || 20)
  const from = page * limit
  const to = from + limit - 1

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'publish')
    .order('wordpress_date', { ascending: false })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return data
})
```

**Step 2: Write integration test**

Create `server/api/posts/index.get.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils'

await setup({
  server: true,
})

describe('/api/posts', () => {
  it('returns array of posts', async () => {
    const posts = await $fetch('/api/posts')

    expect(Array.isArray(posts)).toBe(true)
  })

  it('supports pagination', async () => {
    const page0 = await $fetch('/api/posts?page=0&limit=10')
    const page1 = await $fetch('/api/posts?page=1&limit=10')

    expect(Array.isArray(page0)).toBe(true)
    expect(Array.isArray(page1)).toBe(true)
  })
})
```

**Step 3: Run test to verify it fails**

```bash
bun run test server/api/posts/index.get.test.ts
```

Expected: FAIL - endpoint not found

**Step 4: Run test to verify it passes**

```bash
bun run test server/api/posts/index.get.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add server/api/posts/index.get.ts server/api/posts/index.get.test.ts
git commit -m "feat: add list posts API endpoint"
```

---

## Task 6: Create useWordPressSync Composable

**Files:**
- Create: `app/composables/useWordPressSync.ts`

**Step 1: Write the composable**

Create `app/composables/useWordPressSync.ts`:

```typescript
import type { SyncProgress } from '~/entities/Post.schema'

export function useWordPressSync() {
  const syncing = ref(false)
  const progress = ref<SyncProgress>({ status: 'idle' })

  const sync = async (onProgress?: (progress: SyncProgress) => void) => {
    syncing.value = true
    progress.value = { status: 'started', message: 'Starting sync...' }

    try {
      const response = await fetch('/api/sync/wordpress/posts', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            progress.value = data
            onProgress?.(data)

            if (data.status === 'complete' || data.status === 'error') {
              syncing.value = false
            }
          }
        }
      }
    } catch (error: any) {
      progress.value = { status: 'error', message: error.message }
      syncing.value = false
    }
  }

  return { syncing, progress, sync }
}
```

**Step 2: Commit**

```bash
git add app/composables/useWordPressSync.ts
git commit -m "feat: add useWordPressSync composable"
```

---

## Task 7: Create /blogs Page

**Files:**
- Create: `app/pages/blogs.vue`

**Step 1: Write the page component**

Create `app/pages/blogs.vue`:

```vue
<script setup lang="ts">
import type { Post } from '~/entities/Post.schema'

const posts = ref<Post[]>([])
const loading = ref(false)

const { syncing, progress, sync } = useWordPressSync()

onMounted(async () => {
  await fetchPosts()
})

async function fetchPosts() {
  loading.value = true
  try {
    posts.value = await $fetch<Post[]>('/api/posts')
  } finally {
    loading.value = false
  }
}

async function handleSync() {
  await sync(async (data) => {
    if (data.status === 'complete') {
      await fetchPosts()
    }
  })
}
</script>

<template>
  <div class="container mx-auto p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Blog Posts</h1>

      <UButton
        icon="i-heroicons-arrow-path"
        :loading="syncing"
        :disabled="syncing"
        @click="handleSync"
      >
        Sync from WordPress
      </UButton>
    </div>

    <UAlert
      v-if="syncing && progress.status !== 'idle'"
      :color="progress.status === 'error' ? 'red' : 'blue'"
      :title="progress.status === 'error' ? progress.message : 'Syncing...'"
      class="mb-4"
    >
      <template #description>
        <div v-if="progress.status === 'progress' && 'total' in progress">
          {{ progress.processed }} / {{ progress.total }} posts synced
          <UProgress :value="progress.processed / progress.total * 100" class="mt-2" />
        </div>
      </template>
    </UAlert>

    <UTable
      :rows="posts"
      :columns="[
        { key: 'title', label: 'Title' },
        { key: 'status', label: 'Status' },
        { key: 'wordpress_date', label: 'Date' },
        { key: 'last_synced_at', label: 'Last Synced' },
      ]"
      :loading="loading"
    >
      <template #title-data="{ row }">
        {{ row.title }}
      </template>
    </UTable>
  </div>
</template>
```

**Step 2: Verify page loads**

```bash
bun run dev
```

Visit http://localhost:3000/blogs

Expected: Page loads, "Sync from WordPress" button visible

**Step 3: Typecheck**

```bash
npx nuxt typecheck
```

Expected: No type errors

**Step 4: Commit**

```bash
git add app/pages/blogs.vue
git commit -m "feat: add /blogs page with sync button"
```

---

## Task 8: End-to-End Test

**Step 1: Configure environment**

Ensure `.env` has valid WordPress credentials:
```bash
WOOCOMMERCE_URL=https://your-wordpress-site.com
WOOCOMMERCE_CONSUMER_KEY=your_key
WOOCOMMERCE_CONSUMER_SECRET=your_secret
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

**Step 2: Run dev server**

```bash
bun run dev
```

**Step 3: Test sync flow**

1. Visit http://localhost:3000/blogs
2. Click "Sync from WordPress"
3. Observe progress bar
4. Verify posts appear in table

**Step 4: Verify Supabase**

Check Supabase dashboard > posts table:
- Posts inserted with correct data
- `wordpress_id` unique constraint works
- Categories/tags stored as JSONB

**Step 5: Test re-sync**

1. Click sync button again
2. Verify existing posts update (no duplicates created)

**Step 6: Final typecheck**

```bash
npx nuxt typecheck
```

Expected: No errors

**Step 7: Run all tests**

```bash
bun run test:run
```

Expected: All new tests pass

**Step 8: Final commit**

```bash
git add .
git commit -m "test: verify WordPress blog sync end-to-end"
```

---

## Task 9: Merge to Master

**Step 1: Switch to master**

```bash
cd ../..
git checkout master
```

**Step 2: Merge feature branch**

```bash
git merge feature/wordpress-blog-sync --no-ff
```

**Step 3: Prune worktree**

```bash
git worktree remove .worktrees/wordpress-blog-sync
git branch -d feature/wordpress-blog-sync
```

**Step 4: Push to remote**

```bash
git push origin master
```

---

## Summary

**9 Tasks | ~45 minutes | 9 commits**

Created:
- Supabase migration for `posts` table
- Post entity schema with Zod validation
- WordPressBlogRepository for API calls
- Sync API endpoint with SSE progress
- List posts API endpoint
- useWordPressSync composable
- /blogs page with sync button

**Next Steps:**
- Add individual post view at `/blogs/[slug]`
- Add category/tag filtering
- Add scheduled sync via cron
- Add post editing capabilities
