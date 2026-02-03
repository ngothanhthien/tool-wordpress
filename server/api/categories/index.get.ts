import { CategoryRepository } from '~/repositories/supabase/category'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)

  try {
    const categoryRepo = new CategoryRepository(supabase)
    const categories = await categoryRepo.findAll()

    return categories
  } catch (error) {
    console.error('Categories list error:', error)

    throw createError({
      statusCode: 500,
      message: 'Failed to fetch categories',
    })
  }
})
