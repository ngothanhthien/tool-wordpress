import type { WpPost, Post } from '~/entities/Post.schema'

interface WordPressConfig {
  wooCommerceUrl: string
  wooCommerceConsumerKey: string
  wooCommerceConsumerSecret: string
}

interface WordPressBlogRepositoryOptions {
  baseUrl: string
  consumerKey: string
  consumerSecret: string
}

export class WordPressBlogRepository {
  private options: WordPressBlogRepositoryOptions

  constructor(config: any) {
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
      featured_image_url: wpPost.featured_media ? null : null,
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
