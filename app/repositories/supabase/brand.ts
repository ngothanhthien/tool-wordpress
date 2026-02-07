import type { Brand, BrandInsert } from '~/entities/Brand.schema'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Repository for brand data access
 */
export class BrandRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Upsert brands (insert or update)
   * @param brands - Array of brands to upsert
   * @returns Number of brands upserted
   */
  async upsertMany(brands: BrandInsert[]): Promise<number> {
    if (brands.length === 0) {
      return 0
    }

    const { error, count } = await this.supabase
      .from('product_brands')
      .upsert(brands, { onConflict: 'id', count: 'exact' })

    if (error) {
      throw new Error(`Failed to upsert brands: ${error.message}`)
    }

    return count ?? brands.length
  }

  /**
   * Get brand count and last updated timestamp
   * @returns Object with count and last updated timestamp
   */
  async getStats(): Promise<{ count: number; last_updated: string | null }> {
    const { data, error } = await this.supabase
      .from('product_brands')
      .select('updated_at')

    if (error) {
      throw new Error(`Failed to get brand stats: ${error.message}`)
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
   * Get all brands
   * @returns Array of all brands
   */
  async findAll(): Promise<Brand[]> {
    const { data, error } = await this.supabase
      .from('product_brands')
      .select('*')
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch brands: ${error.message}`)
    }

    return data ?? []
  }
}
