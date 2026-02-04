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
  order_by: z.enum(['menu_order', 'name', 'name_num', 'id']),
  has_archives: z.boolean(),
  terms: z.array(WooCommerceAttributeTermSchema),
})

export type WooCommerceAttributeTerm = z.output<typeof WooCommerceAttributeTermSchema>
export type WooCommerceAttribute = z.output<typeof WooCommerceAttributeSchema>
export type WooCommerceAttributeInsert = z.input<typeof WooCommerceAttributeSchema>
export type WooCommerceAttributeTermInsert = z.input<typeof WooCommerceAttributeTermSchema>
export type AttributeStateInsert = z.input<typeof AttributeStateSchema>
export type AttributeTermStateInsert = z.input<typeof AttributeTermStateSchema>

// For form state (with UI properties)
export const AttributeTermStateSchema = WooCommerceAttributeTermSchema.extend({
  selected: z.boolean().default(false),
  price: z.number().default(0),
})

export type AttributeTermState = z.output<typeof AttributeTermStateSchema>

export const AttributeStateSchema = WooCommerceAttributeSchema.extend({
  expanded: z.boolean().default(false),
  terms: z.array(AttributeTermStateSchema),
})

export type AttributeState = z.output<typeof AttributeStateSchema>
