import type { Category, CategoryInsert } from '~/entities/Category.schema'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Repository for category data access
 */
export class CategoryRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Upsert categories (insert or update)
   * @param categories - Array of categories to upsert
   * @returns Number of categories upserted
   */
  async upsertMany(categories: CategoryInsert[]): Promise<number> {
    if (categories.length === 0) {
      return 0
    }

    const { error, count } = await this.supabase
      .from('categories')
      .upsert(categories, { onConflict: 'id', count: 'exact' })

    if (error) {
      throw new Error(`Failed to upsert categories: ${error.message}`)
    }

    return count ?? categories.length
  }

  /**
   * Get category count and last updated timestamp
   * @returns Object with count and last updated timestamp
   */
  async getStats(): Promise<{ count: number; last_updated: string | null }> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('updated_at')

    if (error) {
      throw new Error(`Failed to get category stats: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return { count: 0, last_updated: null }
    }

    const lastUpdated = data.reduce((latest, curr) => {
      return curr.updated_at > latest ? curr.updated_at : latest
    }, data[0]!.updated_at)

    return {
      count: data.length,
      last_updated: lastUpdated,
    }
  }

  /**
   * Get all categories
   * @returns Array of all categories
   */
  async findAll(): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`)
    }

    return data ?? []
  }
}
