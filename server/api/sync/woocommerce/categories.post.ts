import { WooCommerceRepository, type WooCommerceCategory } from '~/repositories/supabase/woocommerce'
import { CategoryRepository } from '~/repositories/supabase/category'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.supabase.url
  const supabaseServiceKey = config.supabase.serviceRoleKey

  // Use service role client for admin operations (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  try {
    // Fetch categories from WooCommerce
    const wooRepo = new WooCommerceRepository()
    const wooCategories = await wooRepo.listCategories({
      fields: ['id', 'name', 'slug'],
      perPage: 100, // Assume ≤100 categories for now
    })

    // Transform to our schema
    const categories = wooCategories.map((cat: WooCommerceCategory) => ({
      id: String(cat.id),
      name: cat.name,
      slug: cat.slug,
      updated_at: new Date().toISOString(),
    }))

    // Upsert to Supabase
    const categoryRepo = new CategoryRepository(supabase)
    const count = await categoryRepo.upsertMany(categories)

    return {
      synced: true,
      count,
      updated_at: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Category sync error:', error)

    // Determine error type for user-friendly message
    const message = error instanceof Error
      ? (error.message.includes('WooCommerce')
          ? 'Failed to fetch from WooCommerce'
          : error.message.includes('Supabase') || error.message.includes('categories')
          ? 'Database sync failed'
          : 'Sync failed')
      : 'Sync failed'

    throw createError({
      statusCode: 500,
      message,
    })
  }
})
