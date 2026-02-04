import { WooCommerceRepository } from '~/repositories/supabase/woocommerce'

/**
 * API endpoint to fetch all global product attributes from WooCommerce
 * with their terms nested within each attribute.
 *
 * Query params:
 * - baseUrl: WooCommerce site URL
 * - consumerKey: WooCommerce API consumer key
 * - consumerSecret: WooCommerce API consumer secret
 */
export default defineEventHandler(async (event) => {
  const { baseUrl, consumerKey, consumerSecret } = getQuery(event)

  if (!baseUrl || !consumerKey || !consumerSecret) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing WooCommerce credentials',
    })
  }

  const wc = new WooCommerceRepository(
    baseUrl as string,
    consumerKey as string,
    consumerSecret as string
  )

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
