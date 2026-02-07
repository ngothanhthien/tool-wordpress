import { z } from 'zod'

export const brandSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  updated_at: z.string(),
  created_at: z.string(),
})

export type Brand = z.output<typeof brandSchema>
export type BrandInsert = z.input<typeof brandSchema>
