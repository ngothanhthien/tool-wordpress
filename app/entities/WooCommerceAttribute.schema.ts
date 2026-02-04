// app/entities/WooCommerceAttribute.schema.ts
import { z } from 'zod'

export const WooCommerceAttributeTermSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  count: z.number(),
})

export const WooCommerceAttributeSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  type: z.enum(['select', 'text']),
  order_by: z.string(),
  has_archives: z.boolean(),
  terms: z.array(WooCommerceAttributeTermSchema),
})

export type WooCommerceAttributeTerm = z.output<typeof WooCommerceAttributeTermSchema>
export type WooCommerceAttribute = z.output<typeof WooCommerceAttributeSchema>

// For form state (with UI properties)
export const AttributeStateSchema = WooCommerceAttributeSchema.extend({
  expanded: z.boolean().default(false),
})

export type AttributeState = z.output<typeof AttributeStateSchema>

export const AttributeTermStateSchema = WooCommerceAttributeTermSchema.extend({
  selected: z.boolean().default(false),
  price: z.number(),
})

export type AttributeTermState = z.output<typeof AttributeTermStateSchema>
