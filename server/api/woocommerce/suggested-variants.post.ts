import { WooCommerceRepository } from '~/repositories/supabase/woocommerce'

/**
 * API endpoint to fetch suggested variants from WooCommerce
 * based on selected categories.
 *
 * For each category, fetches the 3 latest variable products,
 * extracts their variations, and returns a deduplicated list.
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const categoryIds = body?.categoryIds

    // Validate categoryIds
    if (!categoryIds || !Array.isArray(categoryIds)) {
      throw createError({
        statusCode: 400,
        message: 'categoryIds is required and must be an array',
      })
    }

    if (categoryIds.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'At least one category is required',
      })
    }

    if (categoryIds.length > 10) {
      throw createError({
        statusCode: 400,
        message: 'Maximum 10 categories allowed',
      })
    }

    // Validate each category ID is a number
    const validCategoryIds = categoryIds.map((id: unknown) => {
      const num = Number(id)
      if (Number.isNaN(num)) {
        throw createError({
          statusCode: 400,
          message: `Invalid category ID: ${id}`,
        })
      }
      return num
    })

    // Fetch suggested variants from WooCommerce
    const repo = new WooCommerceRepository()
    const variants = await repo.getSuggestedVariants(validCategoryIds)

    return {
      variants,
    }
  } catch (error: any) {
    console.error('Error fetching suggested variants:', error)

    // For WooCommerce API errors, return empty array instead of throwing
    // This allows users to manually add variants
    if (error.message?.includes('WooCommerce') || error.message?.includes('API')) {
      return {
        variants: [],
      }
    }

    // Re-throw validation errors
    throw error
  }
})
