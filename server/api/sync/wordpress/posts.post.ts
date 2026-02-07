import { serverSupabaseClient } from '#supabase/server'

// Define a temporary interface since types might not be generated yet
interface PostRow {
  wordpress_id: number
  title: string
  slug: string
  content: string
  excerpt?: string | null
  featured_image_url?: string | null
  status: string
  wordpress_url?: string | null
  wordpress_date?: string | null
  wordpress_modified?: string | null
  author_id?: number | null
  seo_title?: string | null
  seo_description?: string | null
  seo_focus_keyword?: string | null
  categories?: any[] | null
  tags?: any[] | null
  last_synced_at?: string | null
  main_keyword?: string | null
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabase = await serverSupabaseClient(event)

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

      // Transform all posts in this batch
      const postsToUpsert = wpPosts.map(wpPost => {
        const transformed = repo.transformPost(wpPost)
        return {
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
          main_keyword: transformed.seo_focus_keyword // Map main_keyword to seo_focus_keyword as per design
        }
      })

      // Single batch upsert for this page
      await (supabase as any).from('posts').upsert(postsToUpsert, { onConflict: 'wordpress_id' })

      processed += wpPosts.length
      sendProgress({ status: 'progress', total, processed })

      page++
    }

    sendProgress({ status: 'complete', total, processed, message: 'Sync complete!' })
  } catch (error: any) {
    sendProgress({ status: 'error', message: error.message })
  }

  event.node.res.end()
})
