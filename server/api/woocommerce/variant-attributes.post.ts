import { WooCommerceRepository } from '~/repositories/supabase/woocommerce'
import { z } from 'zod'

const categoryIdSchema = z.number()

/**
 * POST /api/woocommerce/variant-attributes
 *
 * Aggregates product variant attributes across multiple product categories.
 * Returns a mapping of attribute names to their unique values.
 * 
 * @see {WooCommerceRepository.getVariantsByCategory}
 * @see {WooCommerceRepository.getProducts}
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const categories = z.array(categoryIdSchema).safeParse(body?.category_ids)

    if (!categories.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid category_ids format. Expected array of numbers.'
      })
    }

    const wooCommerceRepo = new WooCommerceRepository()

    // Merge attributes from all categories
    const mergedAttributes: Record<string, string[]> = {}

    await Promise.all(
      categories.data.map(async (categoryId) => {
        try {
          const attributes = await wooCommerceRepo.getVariantsByCategory(categoryId)

          // Merge into combined result
          for (const [attrName, values] of Object.entries(attributes)) {
            if (!mergedAttributes[attrName]) {
              mergedAttributes[attrName] = []
            }

            // Add unique values
            for (const value of values) {
              if (!mergedAttributes[attrName]!.includes(value)) {
                mergedAttributes[attrName]!.push(value)
              }
            }
          }
        } catch (error) {
          console.error(`Failed to fetch variants for category ${categoryId}:`, error)
        }
      })
    )

    return {
      attributes: mergedAttributes,
    }
  } catch (error: any) {
    // More robust error pattern matching
    const errorMsg = error.message || error.data?.message || ''
    if (errorMsg.includes('WooCommerce') || errorMsg.includes('API')) {
      return { attributes: {} }
    }

    // Re-throw validation errors
    throw error
  }
})
