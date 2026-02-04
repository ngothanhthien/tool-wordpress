import { WooCommerceRepository } from '~/repositories/supabase/woocommerce'

/**
 * API endpoint to fetch all global product attributes from WooCommerce
 * with their terms nested within each attribute.
 *
 * Credentials are read from server-side environment variables:
 * - WOOCOMMERCE_URL or WOOCOMMERCE_API_URL: WooCommerce site URL
 * - WOOCOMMERCE_CONSUMER_KEY: WooCommerce API consumer key
 * - WOOCOMMERCE_CONSUMER_SECRET: WooCommerce API consumer secret
 */
export default defineEventHandler(async (event) => {
  // Use server-side environment variables directly
  const baseUrl = process.env.WOOCOMMERCE_URL || process.env.WOOCOMMERCE_API_URL || ''
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY || ''
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET || ''

  if (!baseUrl || !consumerKey || !consumerSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'WooCommerce credentials not configured on server',
    })
  }

  const wc = new WooCommerceRepository(baseUrl, consumerKey, consumerSecret)

  try {
    const attributes = await wc.getAllProductAttributes()
    return attributes
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch product attributes',
    })
  }
})
