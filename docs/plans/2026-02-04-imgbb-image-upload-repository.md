# ImgBB Image Upload Repository Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a type-safe repository for uploading images to ImgBB API with proper error handling, following the existing repository pattern in the codebase.

**Architecture:**
- Create `ImageUploadRepository` class in `app/repositories/imgbb.ts` (note: not in supabase/ folder since ImgBB is external)
- Use ImgBB API v1 POST endpoint for image uploads
- Support base64, binary file, and URL upload methods
- Integrate API key via runtime config for security

**Tech Stack:**
- Nuxt 4 with TypeScript
- Zod v4 for schema validation
- Fetch API (native) for HTTP requests
- Runtime config for API key management

---

## Task 1: Add IMGBB API Key to Runtime Config

**Files:**
- Modify: `nuxt.config.ts`
- Modify: `.env` (local development)

**Step 1: Update nuxt.config.ts to include IMGBB key**

Add to the `runtimeConfig` section, inside the private config object:

```typescript
// nuxt.config.ts - runtimeConfig section
runtimeConfig: {
  // ... existing wooCommerce and supabase config
  imgbbApiKey: process.env.IMGBB_API_KEY,
  // ... rest of config
}
```

**Step 2: Add IMGBB_API_KEY to .env file**

```bash
# .env - add this line
IMGBB_API_KEY=761089bc2b99673fffbb9d179ba7aa67
```

**Step 3: Verify TypeScript types are regenerated**

Run: `npx nuxt typecheck`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add nuxt.config.ts .env
git commit -m "feat: add ImgBB API key to runtime config"
```

---

## Task 2: Define ImgBB Response Schema with Zod

**Files:**
- Create: `app/entities/ImgBB.schema.ts`

**Step 1: Write the failing test**

Create a simple test file to verify schema validation:

```typescript
// app/entities/ImgBB.schema.test.ts
import { describe, it, expect } from 'vitest'
import { imgbbResponseSchema } from './ImgBB.schema'

describe('ImgBB Schema', () => {
  it('should validate successful ImgBB response', () => {
    const mockResponse = {
      data: {
        url: 'https://i.ibb.co/example/image.jpg',
        display_url: 'https://ibb.co/example',
        size: 12345,
        title: 'test.jpg',
        expiration: '2026-02-11 12:00:00',
        delete_url: 'https://ibb.co/example/delete',
        thumb: { url: 'https://i.ibb.co/example/thumb.jpg', width: 160, height: 160 },
        medium: { url: 'https://i.ibb.co/example/medium.jpg', width: 600, height: 600 }
      },
      success: true,
      status: 200
    }

    const result = imgbbResponseSchema.safeParse(mockResponse)
    expect(result.success).toBe(true)
  })

  it('should reject invalid response with missing url', () => {
    const invalidResponse = {
      data: {
        // url missing
        display_url: 'https://ibb.co/example'
      },
      success: true,
      status: 200
    }

    const result = imgbbResponseSchema.safeParse(invalidResponse)
    expect(result.success).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test app/entities/ImgBB.schema.test.ts` (or `npx vitest run` if no test script exists)
Expected: FAIL with "Cannot find module './ImgBB.schema'"

**Step 3: Write the schema implementation**

```typescript
// app/entities/ImgBB.schema.ts
import { z } from 'zod'

/**
 * Schema for ImgBB API v1 upload response
 * @see https://api.imgbb.com/
 */

// Thumbnail/medium image variant schema
const imgbbImageVariantSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  width: z.number().int().positive('Width must be positive'),
  height: z.number().int().positive('Height must be positive'),
})

// Main data object in ImgBB response
const imgbbDataSchema = z.object({
  url: z.string().url('Direct image URL required'),
  display_url: z.string().url('Viewer page URL required'),
  size: z.number().int().nonnegative('File size must be non-negative').optional(),
  title: z.string().optional(),
  expiration: z.string().optional(),
  delete_url: z.string().url('Delete URL must be valid').optional(),
  thumb: imgbbImageVariantSchema.optional(),
  medium: imgbbImageVariantSchema.optional(),
})

// Full ImgBB API response schema
export const imgbbResponseSchema = z.object({
  data: imgbbDataSchema,
  success: z.boolean(),
  status: z.number().int().min(100).max(599),
})

// Export inferred types
export type ImgBBResponse = z.output<typeof imgbbResponseSchema>
export type ImgBBImageData = z.output<typeof imgbbDataSchema>
```

**Step 4: Run test to verify it passes**

Run: `bun test app/entities/ImgBB.schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/entities/ImgBB.schema.ts app/entities/ImgBB.schema.test.ts
git commit -m "feat: add ImgBB response schema with Zod validation"
```

---

## Task 3: Create ImageUploadRepository Class

**Files:**
- Create: `app/repositories/imgbb.ts`

**Step 1: Write the failing test**

```typescript
// app/repositories/imgbb.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { ImageUploadRepository } from './imgbb'

describe('ImageUploadRepository', () => {
  let repository: ImageUploadRepository

  beforeEach(() => {
    // Mock Nuxt runtime config
    repository = new ImageUploadRepository('761089bc2b99673fffbb9d179ba7aa67')
  })

  it('should upload base64 image successfully', async () => {
    // Mock fetch globally
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: {
            url: 'https://i.ibb.co/test/image.jpg',
            display_url: 'https://ibb.co/test',
            thumb: { url: 'https://i.ibb.co/test/thumb.jpg', width: 160, height: 160 }
          },
          success: true,
          status: 200
        })
      })
    ) as any

    const result = await repository.uploadBase64(
      'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      'test.jpg'
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBe('https://i.ibb.co/test/image.jpg')
    }
  })

  it('should handle API errors gracefully', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          status: 401,
          error: { message: 'Invalid API key' }
        })
      })
    ) as any

    const result = await repository.uploadBase64('invalid', 'test.jpg')
    expect(result.success).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test app/repositories/imgbb.test.ts`
Expected: FAIL with "Cannot find module './imgbb'"

**Step 3: Write the repository implementation**

```typescript
// app/repositories/imgbb.ts
import type { ImgBBResponse, ImgBBImageData } from '~/entities/ImgBB.schema'

/**
 * Upload options for ImgBB
 */
export interface ImgBBUploadOptions {
  /** Custom filename (optional, auto-detected from base64) */
  name?: string
  /** Auto-delete expiration in seconds (60-15552000, optional) */
  expiration?: number
}

/**
 * Result of image upload operation
 */
export type ImageUploadResult =
  | { success: true; data: ImgBBImageData }
  | { success: false; error: string; status?: number }

/**
 * Repository for uploading images to ImgBB hosting service
 * @see https://api.imgbb.com/
 */
export class ImageUploadRepository {
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.imgbb.com/1/upload'

  constructor(apiKey: string) {
    if (!apiKey || apiKey.length === 0) {
      throw new Error('ImgBB API key is required')
    }
    this.apiKey = apiKey
  }

  /**
   * Upload image using base64 encoded data
   * @param base64Data - Base64 encoded image data (with or without data:image prefix)
   * @param options - Upload options (name, expiration)
   */
  async uploadBase64(base64Data: string, options?: ImgBBUploadOptions): Promise<ImageUploadResult> {
    try {
      // Strip data:image/...;base64, prefix if present
      const base64String = base64Data.includes(',')
        ? base64Data.split(',')[1]
        : base64Data

      // Build form data
      const formData = new FormData()
      formData.append('key', this.apiKey)
      formData.append('image', base64String)

      if (options?.name) {
        formData.append('name', options.name)
      }

      if (options?.expiration) {
        if (options.expiration < 60 || options.expiration > 15_552_000) {
          return {
            success: false,
            error: 'Expiration must be between 60 and 15552000 seconds'
          }
        }
        formData.append('expiration', options.expiration.toString())
      }

      // Execute upload
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status
        }
      }

      const rawResponse = await response.json()

      // Validate response structure
      if (!rawResponse.success) {
        return {
          success: false,
          error: rawResponse.error?.message || 'Upload failed',
          status: rawResponse.status
        }
      }

      return {
        success: true,
        data: rawResponse.data as ImgBBImageData
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Upload image from a URL
   * @param imageUrl - Public URL of the image to upload
   * @param options - Upload options (name, expiration)
   */
  async uploadFromUrl(imageUrl: string, options?: ImgBBUploadOptions): Promise<ImageUploadResult> {
    try {
      // Validate URL format
      new URL(imageUrl)

      const formData = new FormData()
      formData.append('key', this.apiKey)
      formData.append('image', imageUrl)

      if (options?.name) {
        formData.append('name', options.name)
      }

      if (options?.expiration) {
        if (options.expiration < 60 || options.expiration > 15_552_000) {
          return {
            success: false,
            error: 'Expiration must be between 60 and 15552000 seconds'
          }
        }
        formData.append('expiration', options.expiration.toString())
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status
        }
      }

      const rawResponse = await response.json()

      if (!rawResponse.success) {
        return {
          success: false,
          error: rawResponse.error?.message || 'Upload failed',
          status: rawResponse.status
        }
      }

      return {
        success: true,
        data: rawResponse.data as ImgBBImageData
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test app/repositories/imgbb.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/repositories/imgbb.ts app/repositories/imgbb.test.ts
git commit -m "feat: add ImageUploadRepository for ImgBB integration"
```

---

## Task 4: Create Nuxt Composable for Easy Access

**Files:**
- Create: `app/composables/useImageUpload.ts`

**Step 1: Write the failing test**

```typescript
// app/composables/useImageUpload.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useImageUpload } from './useImageUpload'

describe('useImageUpload composable', () => {
  it('should return repository instance with API key from config', () => {
    // This test requires Nuxt test context - for now, verify it exports
    expect(typeof useImageUpload).toBe('function')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test app/composables/useImageUpload.test.ts`
Expected: FAIL with "Cannot find module './useImageUpload'"

**Step 3: Write the composable implementation**

```typescript
// app/composables/useImageUpload.ts
import { ImageUploadRepository } from '~/repositories/imgbb'

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
```

**Step 4: Run test to verify it passes**

Run: `bun test app/composables/useImageUpload.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/composables/useImageUpload.ts app/composables/useImageUpload.test.ts
git commit -m "feat: add useImageUpload composable for easy repository access"
```

---

## Task 5: Add Server API Endpoint for Server-Side Uploads

**Files:**
- Create: `server/api/upload-image.post.ts`

**Step 1: Write the failing test**

Create an integration test for the API endpoint:

```typescript
// server/api/upload-image.post.test.ts
import { describe, it, expect } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

describe('POST /api/upload-image', () => {
  setup({})

  it('should upload image and return URL', async () => {
    const response = await $fetch('/api/upload-image', {
      method: 'POST',
      body: {
        image: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
        name: 'test.png'
      }
    })

    expect(response).toHaveProperty('success')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test server/api/upload-image.post.test.ts`
Expected: FAIL with "404 Not Found" or similar

**Step 3: Write the API endpoint implementation**

```typescript
// server/api/upload-image.post.ts
import type { ImgBBUploadOptions } from '~/repositories/imgbb'

/**
 * POST /api/upload-image
 *
 * Server-side image upload endpoint using ImgBB
 *
 * Request body:
 * - image: string (base64 data or image URL)
 * - name?: string (optional filename)
 * - expiration?: number (optional expiration in seconds)
 *
 * Response:
 * - success: boolean
 * - data?: { url, display_url, size, ... }
 * - error?: string
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Validate request body
    const image = body.image as string | undefined
    const options: ImgBBUploadOptions = {
      name: body.name as string | undefined,
      expiration: body.expiration as number | undefined,
    }

    if (!image) {
      setResponseStatus(event, 400)
      return {
        success: false,
        error: 'Image data (base64 or URL) is required'
      }
    }

    // Get API key from runtime config
    const config = useRuntimeConfig()
    const apiKey = config.imgbbApiKey as string | undefined

    if (!apiKey) {
      setResponseStatus(event, 500)
      return {
        success: false,
        error: 'ImgBB API key not configured'
      }
    }

    // Import repository and upload
    const { ImageUploadRepository } = await import('~/repositories/imgbb')
    const repository = new ImageUploadRepository(apiKey)

    // Determine upload method based on image format
    let result
    if (image.startsWith('data:image') || image.includes(';base64,')) {
      result = await repository.uploadBase64(image, options)
    } else if (image.startsWith('http://') || image.startsWith('https://')) {
      result = await repository.uploadFromUrl(image, options)
    } else {
      // Treat as base64 without prefix
      result = await repository.uploadBase64(image, options)
    }

    if (!result.success) {
      setResponseStatus(event, result.status || 500)
    }

    return result
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown server error'
    }
  }
})
```

**Step 4: Run test to verify it passes**

Run: `bun test server/api/upload-image.post.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/api/upload-image.post.ts server/api/upload-image.post.test.ts
git commit -m "feat: add server API endpoint for image uploads"
```

---

## Task 6: Type Check and Build Verification

**Files:**
- None (validation step)

**Step 1: Run TypeScript type checking**

Run: `npx nuxt typecheck`
Expected: PASS - no type errors

**Step 2: Check for linting errors**

Run: `npx eslint app/repositories/imgbb.ts app/entities/ImgBB.schema.ts app/composables/useImageUpload.ts server/api/upload-image.post.ts`
Expected: PASS (or fix any linting issues)

**Step 3: Build verification**

Run: `bun run build`
Expected: Build succeeds without errors

**Step 4: Commit any fixes**

If any fixes were needed:
```bash
git add -A
git commit -m "fix: resolve type errors and linting issues"
```

---

## Task 7: Documentation and Usage Examples

**Files:**
- Create: `docs/imgbb-upload-guide.md` (optional, for reference)

**Step 1: Create usage documentation**

```markdown
# ImgBB Image Upload Usage Guide

## Client-Side Usage

```typescript
// In any Vue component
const imageUpload = useImageUpload()

// Upload base64 image
const result = await imageUpload.uploadBase64(base64Data, {
  name: 'product-image.jpg',
  expiration: 604800 // 7 days
})

if (result.success) {
  console.log('Image URL:', result.data.url)
  console.log('Display URL:', result.data.display_url)
} else {
  console.error('Upload failed:', result.error)
}
```

## Server-Side Usage

```typescript
// In server API route
const { ImageUploadRepository } = await import('~/repositories/imgbb')
const config = useRuntimeConfig()
const repository = new ImageUploadRepository(config.imgbbApiKey)

const result = await repository.uploadFromUrl('https://example.com/image.jpg')
```

## API Endpoint

```bash
curl -X POST http://localhost:3000/api/upload-image \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/png;base64,...",
    "name": "image.png"
  }'
```
```

**Step 2: Commit**

```bash
git add docs/imgbb-upload-guide.md
git commit -m "docs: add ImgBB upload usage guide"
```

---

## Final Verification

**Step 1: End-to-end test**

Create a simple test page or verify in an existing component that image upload works.

**Step 2: Cleanup tests**

Remove test files if they were only for development (optional, based on project preference).

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete ImgBB image upload integration"
```

---

## Notes

- **Security**: API key is stored in runtime config (server-side only) - never exposed to client
- **Error Handling**: All methods return discriminated union types for type-safe error handling
- **Testing**: Tests use vitest framework (ensure it's installed, or use jest if preferred)
- **File Size**: ImgBB max file size is 32MB - consider adding client-side validation
- **Expiration**: Default uploads never expire. Set expiration for temporary images.

## Related Skills

- @vue-best-practices - Vue 3 Composition API patterns
- @supabase-postgres-best-practices - If storing image URLs in database
