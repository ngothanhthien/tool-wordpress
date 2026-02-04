import { z } from 'zod'

/**
 * Schema for Watermark Microservice API response
 * @see http://localhost:8005/water-mark
 */

// Successful watermark application response
export const watermarkResponseSchema = z.object({
  success: z.literal(true),
  watermarked_url: z.string().url('Watermarked image URL must be valid'),
  original_url: z.string().url('Original image URL must be valid'),
})

// Error response from watermark API
export const watermarkErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.number().int().optional(),
})

// Request body schema for watermark API
export const watermarkRequestSchema = z.object({
  image_url: z.string().url('image_url must be a valid URL'),
})

// Union schema for any watermark API response (success or error)
export const watermarkApiResponseSchema = z.discriminatedUnion('success', [
  watermarkResponseSchema,
  watermarkErrorSchema,
])

// Export inferred types
export type WatermarkResponse = z.output<typeof watermarkResponseSchema>
export type WatermarkRequest = z.input<typeof watermarkRequestSchema>
export type WatermarkError = z.output<typeof watermarkErrorSchema>
