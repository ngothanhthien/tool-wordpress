import { ImageUploadRepository } from '../repositories/imgbb'

/**
 * Nuxt composable for image upload functionality
 * Provides access to ImageUploadRepository with configured API key
 *
 * @example
 * const imageUpload = useImageUpload()
 * const result = await imageUpload.uploadBase64(base64Data, { name: 'photo.jpg' })
 */
export function useImageUpload() {
  const config = useRuntimeConfig()

  const apiKey = config.imgbbApiKey as string | undefined

  if (!apiKey) {
    throw new Error(
      'IMGBB_API_KEY is not configured. Add it to your .env file and nuxt.config.ts runtimeConfig.'
    )
  }

  return new ImageUploadRepository(apiKey)
}
