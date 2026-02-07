import type { Post, PostInsert } from '~/entities/Post.schema'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Repository for post data access
 */
export class PostRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Find posts with pagination
   * @param options - Pagination options
   * @returns Array of posts
   */
  async findPaginated(options: { page: number; limit: number }): Promise<Post[]> {
    const { page, limit } = options
    const from = page * limit
    const to = from + limit - 1

    const { data, error } = await this.supabase
      .from('posts')
      .select('*')
      .eq('status', 'publish')
      .order('wordpress_date', { ascending: false })
      .range(from, to)

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`)
    }

    return data ?? []
  }

  /**
   * Upsert posts (insert or update)
   * @param posts - Array of posts to upsert
   * @returns Number of posts upserted
   */
  async upsertMany(posts: PostInsert[]): Promise<number> {
    if (posts.length === 0) {
      return 0
    }

    const { error, count } = await this.supabase
      .from('posts')
      .upsert(posts, { onConflict: 'wordpress_id', count: 'exact' })

    if (error) {
      throw new Error(`Failed to upsert posts: ${error.message}`)
    }

    return count ?? posts.length
  }

  /**
   * Get total count of published posts
   * @returns Number of published posts
   */
  async countPublished(): Promise<number> {
    const { count, error } = await this.supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'publish')

    if (error) {
      throw new Error(`Failed to count posts: ${error.message}`)
    }

    return count ?? 0
  }
}
