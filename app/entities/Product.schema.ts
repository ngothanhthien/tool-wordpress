import { z } from 'zod'
import { categorySchema } from './Category.schema'

/**
 * Price reference data from external sources
 */
export const priceReferenceSchema = z.object({
  min_price_vnd: z.string().nullable(),
  max_price_vnd: z.string().nullable(),
  avg_price_vnd: z.string().nullable(),
  updated_date: z.string().nullable(),
  sources: z.array(z.string()).default([]),
})

/**
 * Schema for products table
 * Stores product data with SEO information and N8N process tracking
 */
export const productSchema = z.object({
  id: z.uuid().default(() => crypto.randomUUID()),
  seo_title: z.string().min(1, 'SEO title is required'),
  meta_description: z.string().min(1, 'Meta description is required'),
  keywords: z.array(z.string()).default([]),
  short_description: z.string().min(1, 'Short description is required'),
  html_content: z.string().min(1, 'HTML content is required'),
  images: z.array(z.string()).default([]),
  price: z.number().int().nonnegative().nullable().default(null),
  price_reference: priceReferenceSchema.nullable().default(null),
  woo_id: z.number().int().nonnegative().nullable().default(null),
  raw_categories: z.array(z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  })).default([]),
  made_by_process_id: z.uuid().nullable().default(null),
  status: z.enum(['draft', 'processing', 'success', 'failed']).default('draft'),
  error_message: z.string().nullable().default(null),
  process_id: z.uuid().nullable().default(null),
  workflow_id: z.uuid().nullable().default(null),
  has_confirmed: z.boolean().default(false),
  preview_url: z.string().nullable().default(null),
  process_at: z.coerce.date().default(() => new Date()),
  finished_at: z.coerce.date().nullable().default(null),
  created_at: z.coerce.date().default(() => new Date()),
  updated_at: z.coerce.date().default(() => new Date()),
})

export type Product = z.output<typeof productSchema>
export type ProductInsert = z.input<typeof productSchema>
export type ProductUpdate = Partial<ProductInsert>
export type PriceReference = z.output<typeof priceReferenceSchema>

/**
 * Status values for products
 */
export const ProductStatus = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const

/**
 * Form schema for creating/updating product content
 */
export const productContentFormSchema = z.object({
  seo_title: z.string().min(10, 'SEO title must be at least 10 characters').max(60, 'SEO title must not exceed 60 characters'),
  meta_description: z.string().min(50, 'Meta description must be at least 50 characters').max(160, 'Meta description must not exceed 160 characters'),
  keywords: z.array(z.string()).min(1, 'At least one keyword is required').max(15, 'Maximum 15 keywords allowed'),
  short_description: z.string().min(50, 'Short description must be at least 50 characters').max(500, 'Short description must not exceed 500 characters'),
  html_content: z.string().min(100, 'HTML content must be at least 100 characters'),
  images: z.array(z.string().url('Each image must be a valid URL')).max(20, 'Maximum 20 images allowed'),
})

export type ProductContentForm = z.output<typeof productContentFormSchema>

/**
 * Schema for product with joined category data
 * @deprecated - raw_categories now contains multiple categories
 */
export const productWithCategorySchema = productSchema.extend({
  category: categorySchema.nullable().default(null),
})

export type ProductWithCategory = z.output<typeof productWithCategorySchema>
