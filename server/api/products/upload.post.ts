import { ProductStatus } from '~/entities/Product.schema'
import { ProductRepository } from '~/repositories/supabase/product'
import { WooCommerceRepository } from '~/repositories/supabase/woocommerce'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient(event)

  // Get request body
  const body = await readBody(event)
  const { productId, seo_title, meta_description, short_description, html_content, keywords, images, price, categories, variants } = body

  // Validate required fields
  if (!productId || !seo_title || !meta_description || !short_description || !html_content) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields',
    })
  }

  try {
    // Get product repository
    const productRepo = new ProductRepository(supabase)

    // Fetch current product to get all data for WooCommerce
    const currentProduct = await productRepo.findById(productId)
    if (!currentProduct) {
      throw createError({
        statusCode: 404,
        message: 'Product not found',
      })
    }

    // Update product with new data first
    const updatedProduct = await productRepo.update(productId, {
      seo_title,
      meta_description,
      short_description,
      html_content,
      keywords: keywords || [],
      images: images || [],
      price: price || null,
      raw_categories: categories || [],
      status: ProductStatus.PROCESSING,
      process_at: new Date().toISOString(),
      error_message: null,
      finished_at: null,
      has_confirmed: true,
    })

    // Upload to WooCommerce with categories and variants
    const wooRepo = new WooCommerceRepository()
    const { wooCommerceId, previewUrl } = await wooRepo.uploadProduct(updatedProduct, categories, variants)

    // Update product with WooCommerce data and mark as success
    const finalProduct = await productRepo.update(productId, {
      status: ProductStatus.SUCCESS,
      preview_url: previewUrl,
      woo_id: wooCommerceId,
      finished_at: new Date().toISOString(),
    })

    return {
      success: true,
      product: finalProduct,
      wooCommerceId,
      previewUrl,
      message: 'Product uploaded successfully',
    }
  } catch (error) {
    try {
      const productRepo = new ProductRepository(supabase)
      await productRepo.updateStatus(productId, ProductStatus.FAILED, error instanceof Error ? error.message : 'Failed to upload product')
    } catch (updateError) {
      console.error('Failed to update product status:', updateError)
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to upload product',
    })
  }
})
