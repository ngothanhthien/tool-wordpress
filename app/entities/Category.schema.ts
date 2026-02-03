import { z } from 'zod'

/**
 * Schema for categories table
 * Stores WooCommerce category data for AI microservice
 */
export const categorySchema = z.object({
  id: z.string(), // WooCommerce category ID as string
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  updated_at: z.coerce.date().default(() => new Date()),
})

export type Category = z.output<typeof categorySchema>
export type CategoryInsert = z.input<typeof categorySchema>
