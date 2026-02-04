import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product, ProductUpdate, ProductWithCategory } from '~/entities/Product.schema'

export interface ProductListOptions {
  status?: 'draft' | 'processing' | 'success' | 'failed' | null
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

  async findAllWithCategory(options: ProductListOptions = {}): Promise<Product[]> {
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
