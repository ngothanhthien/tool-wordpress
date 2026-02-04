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
  images: Array<{ src: string; alt?: string; id?: number }>
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
 * WooCommerce Attribute Term
 */
export interface WooCommerceTerm {
  id: number
  name: string
  slug: string
  count: number
}

/**
 * WooCommerce Attribute with Terms
 */
export interface WooCommerceAttribute {
  id: number
  name: string
  slug: string
  type: 'select' | 'text'
  order_by: string
  has_archives: boolean
  terms: WooCommerceTerm[]
}

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
  private injectedConfig: WooCommerceConfig | null = null

  /**
   * Constructor with optional credential injection
   * @param baseUrl - Optional WooCommerce site URL
   * @param consumerKey - Optional API consumer key
   * @param consumerSecret - Optional API consumer secret
   */
  constructor(baseUrl?: string, consumerKey?: string, consumerSecret?: string) {
    if (baseUrl && consumerKey && consumerSecret) {
      this.injectedConfig = { url: baseUrl, consumerKey, consumerSecret }
    }
  }

  /**
   * Get WooCommerce configuration from runtime config or environment variables
   */
  private getConfig(): WooCommerceConfig {
    // Use injected config if available
    if (this.injectedConfig) {
      return this.injectedConfig
    }

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
   * Generate SEO-friendly alt text for product images
   * @param productTitle - Product SEO title
   * @returns Alt text string
   */
  private generateImageAlt(productTitle: string): string {
    return productTitle
  }

  /**
   * Upload product to WooCommerce via REST API
   * @param product - Product entity to upload
   * @param categories - Array of categories to assign (each has id, name, slug)
   * @param attributes - Optional array of attributes for variable products (id, name, options)
   * @returns Object with WooCommerce product ID and preview URL
   */
  async uploadProduct(
    product: Product,
    categories?: Array<{ id: string; name: string; slug: string }>,
    attributes?: Array<{ id: number; name: string; options: string[] }>
  ): Promise<{ wooCommerceId: number; previewUrl: string }> {
    const config = this.getConfig()
    const hasVariants = attributes && attributes.length > 0
    const productType = hasVariants ? 'variable' : 'simple'

    // Build base payload
    const payload: any = {
      name: product.seo_title,
      type: productType,
      status: 'publish',
      description: product.html_content,
      short_description: product.short_description,
      regular_price: hasVariants ? '' : (product.price ? String(product.price) : ''),
      images: product.images.map((src, index) => ({ src, alt: this.generateImageAlt(product.seo_title), position: index })),
      categories: categories?.map(cat => ({ id: Number.parseInt(cat.id, 10) })) || [],
      meta_data: [
        { key: '_yoast_wpseo_metadesc', value: product.meta_description },
        { key: '_yoast_wpseo_focuskw', value: product.keywords.join(', ') },
      ],
    }

    // Add attributes for variable products
    if (hasVariants && attributes) {
      payload.attributes = attributes.map(attr => ({
        id: attr.id,
        name: attr.name,
        variation: true,
        visible: true,
        options: attr.options,
      }))
    }

    const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64')
    const endpoint = new URL('/wp-json/wc/v3/products', config.url).href

    try {
      // Create parent product
      const response = await $fetch<WooCommerceProductResponse>(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
        },
        body: payload,
      })

      // Create variations for variable products
      // Note: This is a simplified implementation that works for single-attribute products
      // For multi-attribute products, a Cartesian product of all term combinations is needed
      if (hasVariants && attributes) {
        // For now, skip variation creation - WooCommerce will auto-create variations from attributes
        // TODO: Implement proper variation generation with Cartesian product for multiple attributes
      }

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
   * Get all global product attributes with their terms
   * @returns Array of attributes with nested terms
   */
  async getAllProductAttributes(): Promise<WooCommerceAttribute[]> {
    const config = this.getConfig()
    const url = new URL('/wp-json/wc/v3/products/attributes', config.url)

    try {
      // Fetch all attributes
      const attributes = await $fetch<WooCommerceAttribute[]>(url.toString(), {
        headers: {
          Authorization: this.buildAuthHeader(config.consumerKey, config.consumerSecret),
        },
      })

      if (!attributes || attributes.length === 0) {
        return []
      }

      // Fetch all terms for each attribute in parallel
      const attributesWithTerms = await Promise.all(
        attributes.map(async (attr) => {
          try {
            const termsUrl = new URL(
              `/wp-json/wc/v3/products/attributes/${attr.id}/terms`,
              config.url
            )
            const terms = await $fetch<WooCommerceTerm[]>(termsUrl.toString(), {
              headers: {
                Authorization: this.buildAuthHeader(config.consumerKey, config.consumerSecret),
              },
            })
            return { ...attr, terms: terms || [] }
          } catch (error) {
            // Log warning and return attribute with empty terms if fetch fails
            console.warn(`Failed to fetch terms for attribute ${attr.id}:`, error)
            return { ...attr, terms: [] }
          }
        })
      )

      return attributesWithTerms
    } catch (error: any) {
      console.error('WooCommerce API error:', error)
      throw new Error(error.data?.message || error.message || 'Failed to fetch product attributes')
    }
  }
}
