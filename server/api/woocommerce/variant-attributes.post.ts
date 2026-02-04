import { WooCommerceRepository } from '~/repositories/supabase/woocommerce'

/**
 * API endpoint to fetch variant attributes grouped by type
 * based on selected categories.
 *
 * For each category, fetches attributes from variable products
 * and returns them grouped by attribute name (e.g., Color, Size).
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

    // Fetch variant attributes from WooCommerce
    const repo = new WooCommerceRepository()

    // Merge attributes from all categories
    const mergedAttributes: Record<string, string[]> = {}

    for (const categoryId of validCategoryIds) {
      try {
        const attributes = await repo.getVariantsByCategory(categoryId)

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
      } catch {
        // Continue if one category fails
        continue
      }
    }

    return {
      attributes: mergedAttributes,
    }
  } catch (error: any) {
    console.error('Error fetching variant attributes:', error)

    // For WooCommerce API errors, return empty object instead of throwing
    if (error.message?.includes('WooCommerce') || error.message?.includes('API')) {
      return {
        attributes: {},
      }
    }

    // Re-throw validation errors
    throw error
  }
})
