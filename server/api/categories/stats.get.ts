import { CategoryRepository } from '~/repositories/supabase/category'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)

  try {
    const categoryRepo = new CategoryRepository(supabase)
    const stats = await categoryRepo.getStats()

    return stats
  } catch (error) {
    console.error('Category stats error:', error)

    throw createError({
      statusCode: 500,
      message: 'Failed to fetch category stats',
    })
  }
})
