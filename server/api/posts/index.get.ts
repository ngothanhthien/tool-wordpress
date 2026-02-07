import { PostRepository } from '~/repositories/supabase/post'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const supabase = await serverSupabaseClient(event)

  // Validate and sanitize pagination parameters
  const page = Math.max(0, parseInt(String(query.page)) || 0)
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit)) || 20))

  try {
    const postRepo = new PostRepository(supabase)
    const posts = await postRepo.findPaginated({ page, limit })

    return posts
  } catch (error) {
    console.error('Posts list error:', error)

    throw createError({
      statusCode: 500,
      message: 'Failed to fetch posts',
    })
  }
})
