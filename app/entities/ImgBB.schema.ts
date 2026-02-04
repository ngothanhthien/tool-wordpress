import { z } from 'zod'

/**
 * Schema for ImgBB API v1 upload response
 * @see https://api.imgbb.com/
 */

// Thumbnail/medium image variant schema
export const imgbbImageVariantSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  width: z.number().int().positive('Width must be positive'),
  height: z.number().int().positive('Height must be positive'),
})

// Main data object in ImgBB response
export const imgbbDataSchema = z.object({
  url: z.string().url('Direct image URL required'),
  display_url: z.string().url('Viewer page URL required'),
  size: z.number().int().nonnegative('File size must be non-negative').optional(),
  title: z.string().optional(),
  expiration: z.string().optional(),
  delete_url: z.string().url('Delete URL must be valid').optional(),
  thumb: imgbbImageVariantSchema.optional(),
  medium: imgbbImageVariantSchema.optional(),
})

// Full ImgBB API response schema (successful upload)
export const imgbbResponseSchema = z.object({
  data: imgbbDataSchema,
  success: z.literal(true),
  status: z.number().int().min(200).max(299),
})

// Error response from ImgBB API
export const imgbbErrorSchema = z.object({
  data: z.object({
    error: z.object({
      message: z.string(),
      code: z.number().int().optional(),
      context: z.string().optional(),
    })
  }),
  success: z.literal(false),
  status: z.number().int().min(400).max(599),
})

// Union schema for any ImgBB API response (success or error)
export const imgbbApiResponseSchema = z.discriminatedUnion('success', [
  imgbbResponseSchema,
  imgbbErrorSchema,
])

// Export inferred types
export type ImgBBResponse = z.output<typeof imgbbResponseSchema>
export type ImgBBResponseInsert = z.input<typeof imgbbResponseSchema>
export type ImgBBImageData = z.output<typeof imgbbDataSchema>
export type ImgBBImageVariant = z.output<typeof imgbbImageVariantSchema>
export type ImgBBError = z.output<typeof imgbbErrorSchema>
export type ImgBBApiResponse = z.output<typeof imgbbApiResponseSchema>
