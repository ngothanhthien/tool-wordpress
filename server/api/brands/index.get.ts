import { BrandRepository } from '~/repositories/supabase/brand'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.supabase.url
  const supabaseServiceKey = config.supabase.serviceRoleKey

  // Use service role key to bypass RLS for now (or use standard client if RLS is set up for public read)
  // For consistency with other endpoints, we'll use the service client for server-side operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  try {
    const brandRepo = new BrandRepository(supabase)
    return await brandRepo.findAll()
  } catch (error) {
    console.error('Failed to fetch brands:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch brands',
    })
  }
})
