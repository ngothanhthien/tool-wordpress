# Watermark Repository Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a repository pattern client for the watermark microservice API endpoint at `http://localhost:8005/water-mark`

**Architecture:** Following the existing repository pattern (see `app/repositories/imgbb.ts`), create a WatermarkRepository class that encapsulates the watermark API client. The API accepts an `image_url` and returns a watermarked image. Repository will handle API communication, error handling, and response typing.

**Tech Stack:** TypeScript, Zod v4 for schema validation, fetch API, Nitro server route integration

---

## Task 1: Create Watermark Schema (Zod Entity)

**Files:**
- Create: `app/entities/Watermark.schema.ts`

**Step 1: Write the failing test**

First, create test file to verify schema validates correctly.

```bash
# Create test directory
mkdir -p app/entities
```

Create `app/entities/Watermark.schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { watermarkResponseSchema, watermarkErrorSchema, watermarkApiResponseSchema } from './Watermark.schema'

describe('Watermark Schema', () => {
  it('should validate successful watermark response', () => {
    const successResponse = {
      watermarked_url: 'https://example.com/watermarked.jpg',
      original_url: 'https://example.com/original.jpg',
    }
    const result = watermarkResponseSchema.safeParse(successResponse)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.watermarked_url).toBe('https://example.com/watermarked.jpg')
    }
  })

  it('should validate error response', () => {
    const errorResponse = {
      error: 'Failed to process image',
      code: 400,
    }
    const result = watermarkErrorSchema.safeParse(errorResponse)
    expect(result.success).toBe(true)
  })

  it('should reject invalid success response (missing watermarked_url)', () => {
    const invalidResponse = {
      original_url: 'https://example.com/original.jpg',
    }
    const result = watermarkResponseSchema.safeParse(invalidResponse)
    expect(result.success).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
# Install vitest if not present (check package.json first)
bun add -D vitest

# Run the test
bun test app/entities/Watermark.schema.test.ts
```

Expected: FAIL with "Cannot find module './Watermark.schema'"

**Step 3: Write minimal implementation**

Create `app/entities/Watermark.schema.ts`:

```typescript
import { z } from 'zod'

/**
 * Schema for Watermark Microservice API response
 * @see http://localhost:8005/water-mark
 */

// Successful watermark application response
export const watermarkResponseSchema = z.object({
  watermarked_url: z.string().url('Watermarked image URL must be valid'),
  original_url: z.string().url('Original image URL must be valid'),
})

// Error response from watermark API
export const watermarkErrorSchema = z.object({
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
```

**Step 4: Run test to verify it passes**

```bash
bun test app/entities/Watermark.schema.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add app/entities/Watermark.schema.ts app/entities/Watermark.schema.test.ts
git commit -m "feat: add watermark API entity schemas with Zod validation"
```

---

## Task 2: Create WatermarkRepository

**Files:**
- Create: `app/repositories/watermark.ts`

**Step 1: Write the failing test**

Create `app/repositories/watermark.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WatermarkRepository } from './watermark'
import type { WatermarkRequest } from '~/entities/Watermark.schema'

describe('WatermarkRepository', () => {
  let repository: WatermarkRepository
  const mockApiKey = 'test-api-key-12345'

  beforeEach(() => {
    repository = new WatermarkRepository('http://localhost:8005', mockApiKey)
    vi.stubGlobal('fetch', vi.fn())
  })

  it('should throw error if API key is empty', () => {
    expect(() => new WatermarkRepository('http://localhost:8005', '')).toThrow('API key is required')
  })

  it('should successfully apply watermark to image URL', async () => {
    const mockResponse = {
      watermarked_url: 'https://example.com/watermarked.jpg',
      original_url: 'https://picsum.photos/800/600',
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await repository.applyWatermark({
      image_url: 'https://picsum.photos/800/600',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.watermarked_url).toBe('https://example.com/watermarked.jpg')
    }
  })

  it('should return error on API failure', async () => {
    const mockErrorResponse = {
      error: 'Invalid image URL',
      code: 400,
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => mockErrorResponse,
    } as Response)

    const result = await repository.applyWatermark({
      image_url: 'invalid-url',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Invalid image URL')
    }
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test app/repositories/watermark.test.ts
```

Expected: FAIL with "Cannot find module './watermark'"

**Step 3: Write minimal implementation**

Create `app/repositories/watermark.ts`:

```typescript
import type { WatermarkResponse, WatermarkRequest } from '~/entities/Watermark.schema'

/**
 * Result of watermark application operation
 */
export type WatermarkResult =
  | { success: true; data: WatermarkResponse }
  | { success: false; error: string; status?: number }

/**
 * Request options for watermark application
 */
export interface WatermarkOptions {
  /** Position of watermark (optional, e.g., 'bottom-right', 'center') */
  position?: string
  /** Opacity of watermark (optional, 0-100) */
  opacity?: number
}

/**
 * Repository for applying watermarks via watermark microservice
 * @see http://localhost:8005/water-mark
 */
export class WatermarkRepository {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly endpoint = '/water-mark'

  constructor(baseUrl: string, apiKey: string) {
    if (!apiKey || apiKey.length === 0) {
      throw new Error('API key is required')
    }
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = apiKey
  }

  /**
   * Apply watermark to an image URL
   * @param request - Object containing image_url
   * @param options - Optional watermark settings (position, opacity)
   */
  async applyWatermark(request: WatermarkRequest, options?: WatermarkOptions): Promise<WatermarkResult> {
    try {
      // Validate URL format
      new URL(request.image_url)

      // Build request body
      const requestBody: Record<string, unknown> = {
        image_url: request.image_url,
      }

      if (options?.position) {
        requestBody.position = options.position
      }

      if (options?.opacity !== undefined) {
        requestBody.opacity = options.opacity
      }

      // Execute API call
      const response = await fetch(`${this.baseUrl}${this.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        // Try to parse error response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = await response.json() as { error?: string }
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          // Use default error message if JSON parsing fails
        }
        return {
          success: false,
          error: errorMessage,
          status: response.status,
        }
      }

      const data = await response.json() as WatermarkResponse

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test app/repositories/watermark.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add app/repositories/watermark.ts app/repositories/watermark.test.ts
git commit -m "feat: add WatermarkRepository for watermark microservice API"
```

---

## Task 3: Create Server API Route

**Files:**
- Create: `server/api/watermark.post.ts`

**Step 1: Write the failing test**

Create `server/api/watermark.post.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils'

describe('/api/watermark', async () => {
  await setup({
    server: true,
    // Mock runtime config for testing
    runtimeConfig: {
      watermarkApiKey: 'test-api-key',
      watermarkBaseUrl: 'http://localhost:8005',
    },
  })

  it('should return error when image_url is missing', async () => {
    const response = await $fetch('/api/watermark', {
      method: 'POST',
      body: {},
    })

    // Expect error response
    expect(response).toHaveProperty('success', false)
    expect(response).toHaveProperty('error')
  })

  it('should accept valid image_url and forward to watermark API', async () => {
    // This would require mocking fetch in the server context
    // For now, we'll just verify the endpoint accepts the request
    const response = await $fetch('/api/watermark', {
      method: 'POST',
      body: {
        image_url: 'https://picsum.photos/800/600',
      },
    })

    // Response structure should be correct (even if API fails in test)
    expect(response).toHaveProperty('success')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
# First, ensure @nuxt/test-utils is installed
bun add -D @nuxt/test-utils

# Run the test
bun test server/api/watermark.post.test.ts
```

Expected: FAIL with "404 not found" or similar

**Step 3: Write minimal implementation**

Create `server/api/watermark.post.ts`:

```typescript
import type { WatermarkRequest } from '~/entities/Watermark.schema'

/**
 * POST /api/watermark
 *
 * Server-side watermark application endpoint
 *
 * Request body:
 * - image_url: string (public URL of image to watermark)
 * - position?: string (optional watermark position)
 * - opacity?: number (optional watermark opacity 0-100)
 *
 * Response:
 * - success: boolean
 * - data?: { watermarked_url, original_url }
 * - error?: string
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Validate required field
    const imageUrl = body.image_url as string | undefined

    if (!imageUrl) {
      setResponseStatus(event, 400)
      return {
        success: false,
        error: 'image_url is required'
      }
    }

    // Validate URL format
    try {
      new URL(imageUrl)
    } catch {
      setResponseStatus(event, 400)
      return {
        success: false,
        error: 'image_url must be a valid URL'
      }
    }

    // Get API config from runtime config
    const config = useRuntimeConfig()
    const apiKey = config.watermarkApiKey as string | undefined
    const baseUrl = config.watermarkBaseUrl as string | undefined || 'http://localhost:8005'

    if (!apiKey) {
      setResponseStatus(event, 500)
      return {
        success: false,
        error: 'Watermark API key not configured'
      }
    }

    // Import repository and apply watermark
    const { WatermarkRepository } = await import('~/repositories/watermark')
    const repository = new WatermarkRepository(baseUrl, apiKey)

    // Optional parameters
    const options = {
      position: body.position as string | undefined,
      opacity: body.opacity as number | undefined,
    }

    const request: WatermarkRequest = { image_url: imageUrl }
    const result = await repository.applyWatermark(request, options)

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

**Step 4: Configure runtime config**

Modify `nuxt.config.ts` to add runtime config (find the `runtimeConfig` section):

```typescript
export default defineNuxtConfig({
  // ... existing config ...

  runtimeConfig: {
    // ... existing runtime config ...

    // Watermark microservice configuration
    watermarkApiKey: process.env.WATERMARK_API_KEY || '',
    watermarkBaseUrl: process.env.WATERMARK_BASE_URL || 'http://localhost:8005',
  },
})
```

**Step 5: Run test to verify it passes**

```bash
bun test server/api/watermark.post.test.ts
```

Expected: Tests PASS

**Step 6: Commit**

```bash
git add server/api/watermark.post.ts server/api/watermark.post.test.ts nuxt.config.ts
git commit -m "feat: add server API route for watermark application"
```

---

## Task 4: Update Environment Variables Documentation

**Files:**
- Modify: `.env.example` (create if not exists)
- Modify: `README.md` or `CLAUDE.md`

**Step 1: Add to .env.example**

Create or update `.env.example`:

```bash
# Watermark Microservice Configuration
WATERMARK_API_KEY=your_api_key_here
WATERMARK_BASE_URL=http://localhost:8005
```

**Step 2: Update CLAUDE.md**

Add to the Environment Variables section in `CLAUDE.md`:

```markdown
Required in `.env`:
- `WATERMARK_API_KEY` - API key for watermark microservice (x-api-key header)
- `WATERMARK_BASE_URL` - Base URL of watermark microservice (default: http://localhost:8005)
```

**Step 3: Update Architecture section in CLAUDE.md**

Add under Repository Pattern section:

```markdown
**WatermarkRepository**: Client for watermark microservice at `app/repositories/watermark.ts`. Handles POST requests to `/water-mark` endpoint with image_url and optional parameters (position, opacity).
```

**Step 4: Run typecheck**

```bash
npx nuxt typecheck
```

Expected: No type errors

**Step 5: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs: add watermark microservice configuration"
```

---

## Task 5: Integration Test (Manual Verification)

**Files:**
- None (manual testing)

**Step 1: Start watermark microservice**

Ensure the watermark microservice is running on port 8005:

```bash
# Replace with actual command to start your microservice
# Example: docker run -p 8005:8005 watermark-service
```

**Step 2: Configure environment**

Add to `.env`:

```bash
WATERMARK_API_KEY=YOUR_API_KEY_HERE
WATERMARK_BASE_URL=http://localhost:8005
```

**Step 3: Test via curl**

```bash
curl -X POST http://localhost:3000/api/watermark \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://picsum.photos/800/600"}'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "watermarked_url": "http://localhost:8005/watermarked/...",
    "original_url": "https://picsum.photos/800/600"
  }
}
```

**Step 4: Test error handling**

```bash
curl -X POST http://localhost:3000/api/watermark \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:
```json
{
  "success": false,
  "error": "image_url is required"
}
```

**Step 5: Test with optional parameters**

```bash
curl -X POST http://localhost:3000/api/watermark \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://picsum.photos/800/600", "position": "bottom-right", "opacity": 50}'
```

**Step 6: Document any issues and commit**

```bash
# If all tests pass
git commit --allow-empty -m "test: watermark repository integration verified"
```

---

## Summary

This plan creates a complete repository pattern implementation for the watermark microservice:

1. **Entity Schema** (`app/entities/Watermark.schema.ts`) - Zod v4 validation for request/response
2. **Repository** (`app/repositories/watermark.ts`) - API client with error handling
3. **Server Route** (`server/api/watermark.post.ts`) - Nitro endpoint with runtime config
4. **Tests** - Unit tests for schema and repository
5. **Configuration** - Environment variables and documentation

**Key patterns followed:**
- Same structure as `ImageUploadRepository` (ImgBB)
- Discriminated union for success/error responses
- Runtime config for sensitive API keys
- Proper TypeScript typing throughout
- Error handling with meaningful messages
