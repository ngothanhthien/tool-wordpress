import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product, ProductInsert, ProductUpdate, ProductWithCategory } from '~/entities/Product.schema'

export interface ProductListOptions {
  status?: 'draft' | 'processing' | 'success' | 'failed' | null
  categoryId?: string | null
}

/**
 * Repository for product database operations
 */
export class ProductRepository {
  constructor(private supabase: SupabaseClient) {}

  async findAll(options: ProductListOptions = {}) {
    let query = this.supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (options.status) {
      query = query.eq('status', options.status)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`)
    }

    return data as Product[]
  }

  async findAllWithCategory(options: ProductListOptions = {}): Promise<ProductWithCategory[]> {
    let query = this.supabase
      .from('products')
      .select('*, category:categories(*)')
      .order('created_at', { ascending: false })

    if (options.status) {
      query = query.eq('status', options.status)
    }

    if (options.categoryId === null) {
      // Filter for uncategorized products only
      query = query.is('category_id', null)
    } else if (options.categoryId) {
      // Filter for specific category
      query = query.eq('category_id', options.categoryId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch products with category: ${error.message}`)
    }

    return data as ProductWithCategory[]
  }

  async findById(id: string): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      throw new Error(`Failed to fetch product: ${error.message}`)
    }

    return data as Product
  }

  async update(id: string, updates: ProductUpdate): Promise<Product> {
    const { data, error } = await this.supabase
      .from('products')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to update product: ${error.message}`)
    }

    if (!data) {
      throw new Error(`Product not found or update not permitted. Product ID: ${id}`)
    }

    return data as Product
  }

  async updateStatus(id: string, status: Product['status'], errorMessage?: string | null): Promise<Product> {
    return this.update(id, {
      status,
      error_message: errorMessage,
      ...(status === 'processing' ? { process_at: new Date().toISOString() } : {}),
      ...(status === 'success' || status === 'failed' ? { finished_at: new Date().toISOString() } : {}),
    })
  }
}
