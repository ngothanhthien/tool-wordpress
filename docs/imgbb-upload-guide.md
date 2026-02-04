# ImgBB Image Upload Usage Guide

This guide shows how to use the ImgBB image upload functionality in the application.

## Client-Side Usage

### Using the `useImageUpload()` Composable

The `useImageUpload()` composable provides a convenient way to upload images from Vue components.

```typescript
// In any Vue component
const imageUpload = useImageUpload()

// Upload base64 image
const result = await imageUpload.uploadBase64(base64Data, {
  name: 'product-image.jpg',
  expiration: 604800 // 7 days (optional, in seconds)
})

if (result.success) {
  console.log('Image URL:', result.data.url)
  console.log('Display URL:', result.data.display_url)
  console.log('Delete URL:', result.data.delete_url)
} else {
  console.error('Upload failed:', result.error)
}
```

### Uploading from a File Input

```vue
<script setup lang="ts">
const imageUpload = useImageUpload()
const uploading = ref(false)
const imageUrl = ref('')

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploading.value = true

  try {
    // Convert file to base64
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      const result = await imageUpload.uploadBase64(base64, {
        name: file.name
      })

      if (result.success) {
        imageUrl.value = result.data.display_url
      } else {
        console.error('Upload failed:', result.error)
      }
      uploading.value = false
    }
    reader.readAsDataURL(file)
  } catch (error) {
    console.error('Error processing file:', error)
    uploading.value = false
  }
}
</script>

<template>
  <div>
    <input type="file" @change="handleFileChange" accept="image/*" :disabled="uploading" />
    <p v-if="uploading">Uploading...</p>
    <img v-if="imageUrl" :src="imageUrl" alt="Uploaded image" />
  </div>
</template>
```

## Server-Side Usage

### Using `ImageUploadRepository` Directly

For server-side operations, use the `ImageUploadRepository` class directly.

```typescript
// In server API route (server/api/*.ts)
import { ImageUploadRepository } from '~/repositories/imgbb'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const repository = new ImageUploadRepository(config.imgbbApiKey as string)

  // Upload from URL
  const result = await repository.uploadFromUrl('https://example.com/image.jpg', {
    expiration: 604800
  })

  return result
})
```

### Upload from Base64

```typescript
import { ImageUploadRepository } from '~/repositories/imgbb'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()
  const repository = new ImageUploadRepository(config.imgbbApiKey as string)

  const result = await repository.uploadBase64(body.image, {
    name: body.name
  })

  return result
})
```

## API Endpoint

The application provides a REST API endpoint for image uploads at `/api/upload-image`.

### Using curl

```bash
curl -X POST http://localhost:3000/api/upload-image \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "name": "image.png"
  }'
```

### Using JavaScript fetch

```javascript
const response = await fetch('http://localhost:3000/api/upload-image', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    image: base64Data,
    name: 'image.png'
  })
})

const result = await response.json()

if (result.success) {
  console.log('Image URL:', result.data.url)
} else {
  console.error('Upload failed:', result.error)
}
```

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
IMGBB_API_KEY=your_api_key_here
```

Get your API key from [ImgBB](https://api.imgbb.com/).

### Nuxt Config

The API key is configured in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  runtimeConfig: {
    imgbbApiKey: ''
  }
})
```

## Response Format

### Success Response

```typescript
{
  success: true,
  data: {
    url: 'https://i.ibb.co/...',        // Direct image URL
    display_url: 'https://i.ibb.co/...', // Viewer URL
    delete_url: 'https://ibb.co/...',    // URL to delete image
    thumb: {
      url: 'https://i.ibb.co/...',       // Thumbnail URL
      width: 160,
      height: 160
    },
    id: '...',
    filename: 'image.png',
    name: 'image.png',
    mime: 'image/png',
    extension: 'png',
    size: 12345,
    width: 1920,
    height: 1080,
    expiration: 604800                   // Seconds until expiration (0 = never)
  }
}
```

### Error Response

```typescript
{
  success: false,
  error: {
    message: 'Error message',
    code: 'error_code',
    status_code: 400
  }
}
```

## Expiration Options

When uploading images, you can set an expiration time (in seconds):

- `3600` - 1 hour
- `86400` - 1 day
- `604800` - 7 days
- `2592000` - 30 days
- `0` - Never expire (default)

## Usage in Product Upload Flow

The ImgBB upload is integrated into the product upload modal. When uploading a product with an image:

1. The image is automatically uploaded to ImgBB
2. The returned URL is stored with the product data
3. The image is displayed using the `display_url`

See the product upload modal implementation for a complete example.
