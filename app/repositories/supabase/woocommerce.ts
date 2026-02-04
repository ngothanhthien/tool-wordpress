import type { Product } from '~/entities/Product.schema'

/**
 * WooCommerce API response type
 */
export interface WooCommerceProductResponse {
  id: number
  name: string
  slug: string
  permalink: string
  status: 'draft' | 'publish'
  description: string
  short_description: string
  images: Array<{ src: string; id?: number }>
}

/**
 * WooCommerce Category response type
 */
export interface WooCommerceCategory {
  id: number
  name: string
  slug: string
  parent?: number
  count?: number
}

/**
 * WooCommerce Product Variation response type
 */
export interface WooCommerceProductVariation {
  id: number
  price: string
  regular_price: string
  sale_price: string
  stock_quantity: number | null
  in_stock: boolean
  attributes: Array<{
    id: number
    name: string
    option: string
  }>
}

/**
 * Simplified WooCommerce Product for listing
 */
export interface WooCommerceProduct {
  id: number
  name: string
  type: 'simple' | 'variable' | 'grouped' | 'external'
  date_created: string
}

/**
 * Variant attribute type
 */
export interface VariantAttribute {
  name: string
  type: string
  value: string
}

/**
 * Grouped variants by type
 */
export type GroupedVariants = Record<string, string[]>

/**
 * WooCommerce configuration interface
 */
interface WooCommerceConfig {
  url: string
  consumerKey: string
  consumerSecret: string
}

/**
 * Repository for WooCommerce API operations
 */
export class WooCommerceRepository {
  /**
   * Get WooCommerce configuration from runtime config or environment variables
   */
  private getConfig(): WooCommerceConfig {
    const config = useRuntimeConfig()
    const url = config.wooCommerceUrl || process.env.WOOCOMMERCE_URL
    const consumerKey = config.wooCommerceConsumerKey || process.env.WOOCOMMERCE_CONSUMER_KEY
    const consumerSecret = config.wooCommerceConsumerSecret || process.env.WOOCOMMERCE_CONSUMER_SECRET

    if (!url || !consumerKey || !consumerSecret) {
      throw new Error('WooCommerce credentials not configured')
    }

    return { url, consumerKey, consumerSecret }
  }

  /**
   * Upload product to WooCommerce via REST API
   * @param product - Product entity to upload
   * @param categories - Array of categories to assign (each has id, name, slug)
   * @returns Object with WooCommerce product ID and preview URL
   */
  async uploadProduct(product: Product, categories?: Array<{ id: string; name: string; slug: string }>): Promise<{ wooCommerceId: number; previewUrl: string }> {
    const config = this.getConfig()

    const payload = {
      name: product.seo_title,
      type: 'simple',
      status: 'publish',
      description: product.html_content,
      short_description: product.short_description,
      regular_price: product.price ? String(product.price) : '',
      images: product.images.map((src, index) => ({ src, position: index })),
      categories: categories?.map(cat => ({ id: Number.parseInt(cat.id, 10) })) || [],
      meta_data: [
        { key: '_yoast_wpseo_metadesc', value: product.meta_description },
        { key: '_yoast_wpseo_focuskw', value: product.keywords.join(', ') },
      ],
    }

    const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64')
    const endpoint = new URL('/wp-json/wc/v3/products', config.url).href

    try {
      const response = await $fetch<WooCommerceProductResponse>(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
        },
        body: payload,
      })

      return {
        wooCommerceId: response.id,
        previewUrl: response.permalink,
      }
    } catch (error: any) {
      console.error('WooCommerce API error:', error)
      throw new Error(error.data?.message || error.message || 'Failed to upload to WooCommerce')
    }
  }

  /**
   * Build Basic Auth header from credentials
   */
  private buildAuthHeader(consumerKey: string, consumerSecret: string): string {
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
    return `Basic ${credentials}`
  }

  /**
   * List all product categories
   * @param options - Query options
   * @returns Array of categories
   */
  async listCategories(options?: {
    fields?: Array<'id' | 'name' | 'slug' | 'parent' | 'count'>
    hideEmpty?: boolean
    parent?: number
    perPage?: number
  }): Promise<WooCommerceCategory[]> {
    const config = this.getConfig()
    const params: Record<string, string> = {}

    if (options?.fields) {
      params._fields = options.fields.join(',')
    }
    if (options?.hideEmpty !== undefined) {
      params.hide_empty = String(options.hideEmpty)
    }
    if (options?.parent !== undefined) {
      params.parent = String(options.parent)
    }
    if (options?.perPage) {
      params.per_page = String(options.perPage)
    }

    const url = new URL('/wp-json/wc/v3/products/categories', config.url)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    try {
      return await $fetch<WooCommerceCategory[]>(url.toString(), {
        headers: {
          Authorization: this.buildAuthHeader(config.consumerKey, config.consumerSecret),
        },
      })
    } catch (error: any) {
      console.error('WooCommerce API error:', error)
      throw new Error(error.data?.message || error.message || 'Failed to fetch categories')
    }
  }

  /**
   * Get a single category by ID
   * @param id - Category ID
   * @returns Category object or null
   */
  async getCategory(id: number): Promise<WooCommerceCategory | null> {
    const config = this.getConfig()
    const url = new URL(`/wp-json/wc/v3/products/categories/${id}`, config.url)

    try {
      return await $fetch<WooCommerceCategory>(url.toString(), {
        headers: {
          Authorization: this.buildAuthHeader(config.consumerKey, config.consumerSecret),
        },
      })
    } catch {
      return null
    }
  }

  /**
   * List products with optional filters
   * @param options - Query options
   * @returns Array of products
   */
  async listProducts(options?: {
    category?: number
    type?: 'simple' | 'variable' | 'grouped' | 'external'
    orderBy?: 'date' | 'id' | 'title' | 'slug'
    order?: 'asc' | 'desc'
    perPage?: number
    page?: number
  }): Promise<WooCommerceProduct[]> {
    const config = this.getConfig()
    const params: Record<string, string> = {}

    if (options?.category !== undefined) {
      params.category = String(options.category)
    }
    if (options?.type) {
      params.type = options.type
    }
    if (options?.orderBy) {
      params.orderby = options.orderBy
    }
    if (options?.order) {
      params.order = options.order
    }
    if (options?.perPage) {
      params.per_page = String(options.perPage)
    }
    if (options?.page) {
      params.page = String(options.page)
    }

    const url = new URL('/wp-json/wc/v3/products', config.url)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    try {
      return await $fetch<WooCommerceProduct[]>(url.toString(), {
        headers: {
          Authorization: this.buildAuthHeader(config.consumerKey, config.consumerSecret),
        },
      })
    } catch (error: any) {
      console.error('WooCommerce API error:', error)
      throw new Error(error.data?.message || error.message || 'Failed to fetch products')
    }
  }

  /**
   * List all variations for a specific product
   * @param productId - Product ID
   * @param options - Query options
   * @returns Array of product variations
   */
  async listProductVariations(
    productId: number,
    options?: {
      perPage?: number
      page?: number
    }
  ): Promise<WooCommerceProductVariation[]> {
    const config = this.getConfig()
    const params: Record<string, string> = {}

    if (options?.perPage) {
      params.per_page = String(options.perPage)
    }
    if (options?.page) {
      params.page = String(options.page)
    }

    const url = new URL(`/wp-json/wc/v3/products/${productId}/variations`, config.url)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    try {
      return await $fetch<WooCommerceProductVariation[]>(url.toString(), {
        headers: {
          Authorization: this.buildAuthHeader(config.consumerKey, config.consumerSecret),
        },
      })
    } catch (error: any) {
      console.error('WooCommerce API error:', error)
      throw new Error(error.data?.message || error.message || 'Failed to fetch product variations')
    }
  }

  /**
   * Get a single product variation
   * @param productId - Product ID
   * @param variationId - Variation ID
   * @returns Variation object or null
   */
  async getProductVariation(
    productId: number,
    variationId: number
  ): Promise<WooCommerceProductVariation | null> {
    const config = this.getConfig()
    const url = new URL(`/wp-json/wc/v3/products/${productId}/variations/${variationId}`, config.url)

    try {
      return await $fetch<WooCommerceProductVariation>(url.toString(), {
        headers: {
          Authorization: this.buildAuthHeader(config.consumerKey, config.consumerSecret),
        },
      })
    } catch {
      return null
    }
  }

  /**
   * Get variants grouped by type from the 2 newest products in a category
   * @param categoryId - Category ID
   * @returns Variants grouped by type (e.g., { "Color": ["Red", "Blue"], "Size": ["S", "M"] })
   */
  async getVariantsByCategory(categoryId: number): Promise<GroupedVariants> {
    // Step 1: Get 2 newest variable products by category
    const products = await this.listProducts({
      category: categoryId,
      type: 'variable',
      orderBy: 'date',
      order: 'desc',
      perPage: 2,
    })

    if (!products || products.length === 0) {
      return {}
    }

    // Step 2: Get variations for each product and collect attributes
    const allAttributes: VariantAttribute[] = []

    for (const product of products) {
      const variations = await this.listProductVariations(product.id, { perPage: 100 })

      for (const variation of variations) {
        for (const attr of variation.attributes) {
          // Skip empty options
          if (!attr.option || attr.option === '') {
            continue
          }
          allAttributes.push({
            name: attr.name,
            type: attr.name, // In WooCommerce, attribute name is the type (e.g., "Color", "Size")
            value: attr.option,
          })
        }
      }
    }

    // Step 3: Group by type (attribute name)
    const grouped: GroupedVariants = {}
    for (const attr of allAttributes) {
      if (!grouped[attr.type]) {
        grouped[attr.type] = []
      }

      if (!grouped[attr.type]?.includes(attr.value)) {
        grouped[attr.type]!.push(attr.value)
      }
    }

    return grouped
  }
}
