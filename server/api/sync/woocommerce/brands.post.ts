import { WooCommerceRepository, type WooCommerceBrand } from '~/repositories/supabase/woocommerce'
import { BrandRepository } from '~/repositories/supabase/brand'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.supabase.url
  const supabaseServiceKey = config.supabase.serviceRoleKey

  // Use service role key for admin operations (upsert)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  try {
    // 1. Fetch brands from WooCommerce (as product attributes)
    const wooRepo = new WooCommerceRepository()
    const wooBrands = await wooRepo.listBrands({
      perPage: 100, // Fetch up to 100 brands
    })

    if (!wooBrands || wooBrands.length === 0) {
      return {
        synced: true,
        count: 0,
        updated_at: new Date().toISOString(),
      }
    }

    // 2. Transform to our schema
    const brands = wooBrands.map((brand: WooCommerceBrand) => ({
      id: String(brand.id),
      name: brand.name,
      slug: brand.slug,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }))

    // 3. Upsert to Supabase
    const brandRepo = new BrandRepository(supabase)
    const count = await brandRepo.upsertMany(brands)

    return {
      synced: true,
      count,
      updated_at: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Brand sync error:', error)
    const message = error instanceof Error
      ? (error.message.includes('WooCommerce')
          ? 'Failed to fetch from WooCommerce'
          : error.message.includes('Supabase') || error.message.includes('product_brands')
          ? 'Database sync failed'
          : 'Sync failed')
      : 'Sync failed'

    throw createError({
      statusCode: 500,
      message,
    })
  }
})
