import { BrandRepository } from '~/repositories/supabase/brand'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.supabase.url
  const supabaseServiceKey = config.supabase.serviceRoleKey

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  try {
    const brandRepo = new BrandRepository(supabase)
    return await brandRepo.getStats()
  } catch (error) {
    console.error('Failed to get brand stats:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to get brand stats',
    })
  }
})
