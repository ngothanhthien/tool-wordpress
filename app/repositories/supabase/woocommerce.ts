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
   * @returns Object with WooCommerce product ID and preview URL
   */
  async uploadProduct(product: Product): Promise<{ wooCommerceId: number; previewUrl: string }> {
    const config = this.getConfig()

    const payload = {
      name: product.seo_title,
      type: 'simple',
      status: 'publish',
      description: product.html_content,
      short_description: product.short_description,
      regular_price: product.price ? String(product.price) : '',
      images: product.images.map((src, index) => ({ src, position: index })),
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
}
