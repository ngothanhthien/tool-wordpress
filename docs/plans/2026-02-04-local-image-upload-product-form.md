# Local Image Upload for Product Form Design

**Status:** Design Approved
**Date:** 2026-02-04
**Related Plan:** `2026-02-04-imgbb-image-upload-repository.md`

## Overview

Add the ability for users to upload images from their local filesystem in the product upload modal. Images are uploaded to ImgBB hosting service, then the URLs are sent to WooCommerce during product upload.

## Architecture

### Data Flow

```
User selects files → Convert to base64 → Upload to ImgBB → Store URL → Submit to WooCommerce
```

### Components

| Component | Purpose |
|-----------|---------|
| `UFileUpload` | Nuxt UI v4 file picker with drag-and-drop |
| `UProgress` | Upload progress indicator per file |
| `ImageUploadRepository` | ImgBB API integration (from existing plan) |
| `/api/upload-image` | Server endpoint for ImgBB uploads |

### State Management (SSR-Safe)

Uses `useState` to prevent state leaks between requests:

```typescript
const selectedFiles = useState<File[]>('upload-files', () => [])
const uploadingFiles = useState<File[]>('uploading-files', () => [])
const uploadProgress = useState<number[]>('upload-progress', () => [])
const newImages = useState<string[]>('new-images', () => [])
```

## UI Design

### Media Step Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Media                                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─ Upload New Images ───────────────────────────────────┐   │
│ │                                                          │   │
│ │  ┌─────────────────────────────────────────────────┐  │   │
│ │  │  [Drag & Drop Zone]                             │  │   │
│ │  │  or Select Images                               │  │   │
│ │  │  JPG, PNG, WEBP, GIF (max 32MB)                 │  │   │
│ │  └─────────────────────────────────────────────────┘  │   │
│ │                                                          │   │
│ │  Uploading 2 files...                                   │   │
│ │  photo1.jpg ████████████░░░░ 75%                       │   │
│ │  photo2.jpg ████████░░░░░░░░ 50%                       │   │
│ │                                                          │   │
│ │  Newly Uploaded (2) ✓                                   │   │
│ │  ┌─────┐  ┌─────┐                                     │   │
│ │  │ [New]│  │ [New]│                                     │   │
│ │  │  X  │  │  X  │                                     │   │
│ │  └─────┘  └─────┘                                     │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─ Select Images from Product ─────────────────────────────┐   │
│ │                                                          │   │
│ │  ☑ [img1.jpg]  ☐ [img2.jpg]  ☑ [img3.jpg]             │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Props

**UFileUpload Configuration:**
```vue
<UFileUpload
  v-model="selectedFiles"
  multiple
  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
  icon="i-lucide-image"
  label="Drop product images here"
  description="JPG, PNG, WEBP or GIF (max. 32MB per file)"
  variant="area"
  layout="grid"
  class="w-full min-h-32"
/>
```

## Implementation

### Phase 1: Backend Foundation (Existing ImgBB Plan)

Tasks from `2026-02-04-imgbb-image-upload-repository.md`:

1. Add `IMGBB_API_KEY` to `nuxt.config.ts` runtime config
2. Add `IMGBB_API_KEY=...` to `.env`
3. Create `app/entities/ImgBB.schema.ts` with Zod validation
4. Create `app/repositories/imgbb.ts` - `ImageUploadRepository` class
5. Create `app/composables/useImageUpload.ts`
6. Create `server/api/upload-image.post.ts`

### Phase 2: Frontend Integration

**7. Add Upload State to products.vue**

```typescript
// SSR-safe state using useState
const selectedFiles = useState<File[]>('upload-files', () => [])
const uploadingFiles = useState<File[]>('uploading-files', () => [])
const uploadProgress = useState<number[]>('upload-progress', () => [])
const newImages = useState<string[]>('new-images', () => [])
```

**8. Helper Functions**

```typescript
const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File "${file.name}" exceeds 32MB limit.` }
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { valid: false, error: `File "${file.name}" is not a supported image type.` }
  }
  return { valid: true }
}

// Browser-only FileReader (SSR-safe)
async function convertToBase64(file: File): Promise<string> {
  if (import.meta.server) {
    throw new Error('FileReader is not available on server')
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// Use $fetch for user-triggered actions (Nuxt best practice)
async function uploadToImgBB(base64: string, filename: string): Promise<string> {
  const result = await $fetch('/api/upload-image', {
    method: 'POST',
    body: { image: base64, name: filename }
  })
  if (!result.success) {
    throw new Error(result.error || 'Upload failed')
  }
  return result.data.url
}

function removeNewImage(index: number) {
  newImages.value.splice(index, 1)
}

function isDuplicateUrl(url: string): boolean {
  return uploadForm.images.includes(url) || newImages.value.includes(url)
}
```

**9. Upload Handler**

```typescript
async function uploadFiles(files: File[]) {
  for (const file of files) {
    // Validate
    const validation = validateFile(file)
    if (!validation.valid) {
      toast.add({
        title: 'Invalid File',
        description: validation.error,
        color: 'error',
        icon: 'i-heroicons-exclamation-triangle'
      })
      continue
    }

    uploadingFiles.value.push(file)
    const progressIndex = uploadingFiles.value.length - 1
    uploadProgress.value.push(0)

    try {
      uploadProgress.value[progressIndex] = 25
      const base64 = await convertToBase64(file)

      uploadProgress.value[progressIndex] = 50
      const url = await uploadToImgBB(base64, file.name)

      uploadProgress.value[progressIndex] = 100

      if (!isDuplicateUrl(url)) {
        newImages.value.push(url)
      }

      // Remove from uploading after delay
      setTimeout(() => {
        const idx = uploadingFiles.value.indexOf(file)
        if (idx > -1) {
          uploadingFiles.value.splice(idx, 1)
          uploadProgress.value.splice(idx, 1)
        }
      }, 2000)

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      toast.add({
        title: 'Upload Failed',
        description: `${file.name}: ${message}`,
        color: 'error',
        icon: 'i-heroicons-x-circle'
      })
      const idx = uploadingFiles.value.indexOf(file)
      if (idx > -1) {
        uploadingFiles.value.splice(idx, 1)
        uploadProgress.value.splice(idx, 1)
      }
    }
  }
}

// Auto-upload when files are selected
watch(selectedFiles, (newFiles) => {
  if (newFiles?.length) {
    uploadFiles(newFiles)
    selectedFiles.value = []
  }
})
```

**10. Updated Submit Logic**

```typescript
async function submitUpload() {
  if (!selectedProduct.value) return

  // Validate price
  if (uploadForm.price === null || uploadForm.price === undefined) {
    toast.add({
      title: 'Validation Error',
      description: 'Price is required',
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  // Validate at least one image
  const hasExistingImages = uploadForm.images.some((_, i) => uploadForm.uploadImages[i])
  const hasNewImages = newImages.value.length > 0

  if (!hasExistingImages && !hasNewImages) {
    toast.add({
      title: 'Validation Error',
      description: 'Please select at least one image to upload.',
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }

  // Prevent submit if uploading
  if (uploadtingFiles.value.length > 0) {
    toast.add({
      title: 'Upload in Progress',
      description: 'Please wait for all images to finish uploading.',
      color: 'warning',
      icon: 'i-heroicons-clock'
    })
    return
  }

  uploadLoading.value = true
  try {
    const imagesToUpload = [
      ...uploadForm.images.filter((_, index) => uploadForm.uploadImages[index]),
      ...newImages.value
    ]

    await $fetch('/api/products/upload', {
      method: 'POST',
      body: {
        productId: selectedProduct.value.id,
        seo_title: uploadForm.seo_title,
        meta_description: uploadForm.meta_description,
        short_description: uploadForm.short_description,
        html_content: uploadForm.html_content,
        keywords: uploadForm.keywords,
        images: imagesToUpload,
        price: uploadForm.price,
        categories: selectedCategories.value,
      },
    })

    toast.add({
      title: 'Success',
      description: 'Product uploaded successfully',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    closeUploadModal()
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Upload Failed',
      description: error instanceof Error ? error.message : 'Failed to upload product',
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    uploadLoading.value = false
  }
}
```

**11. Reset Functions**

```typescript
function openUploadModal(product: Product) {
  selectedProduct.value = product
  // ... existing form population ...

  // Reset upload state
  selectedFiles.value = []
  uploadingFiles.value = []
  uploadProgress.value = []
  newImages.value = []

  currentStep.value = 0
  isUploadModalOpen.value = true
}

function closeUploadModal() {
  isUploadModalOpen.value = false
  selectedProduct.value = null
  selectedCategories.value = []
  currentStep.value = 0

  // Reset upload state
  selectedFiles.value = []
  uploadingFiles.value = []
  uploadProgress.value = []
  newImages.value = []
}
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| File too large (>32MB) | Client validation, toast error |
| Invalid file type | Client validation, toast error |
| ImgBB API error | Show error message, keep file for retry |
| Network error | Show error, allow retry |
| Duplicate image | Warning toast, skip add |
| Submit while uploading | Block submit, show warning |
| No images selected | Validation error, block submit |

## Quality Gates

1. **Type Checking:** `npx nuxt typecheck` must pass
2. **File Types:** Test jpg, png, webp, gif
3. **File Sizes:** Test small (<1MB) and large (~10MB) files
4. **Error Cases:** Test invalid files, network errors
5. **Integration:** Verify images appear in WooCommerce

## Files Modified

| File | Change |
|------|--------|
| `nuxt.config.ts` | Add IMGBB_API_KEY to runtimeConfig |
| `.env` | Add IMGBB_API_KEY value |
| `app/entities/ImgBB.schema.ts` | NEW - ImgBB response schema |
| `app/repositories/imgbb.ts` | NEW - ImageUploadRepository |
| `app/composables/useImageUpload.ts` | NEW - useImageUpload composable |
| `server/api/upload-image.post.ts` | NEW - ImgBB upload endpoint |
| `app/pages/products.vue` | Add upload UI and logic |

## References

- Nuxt UI v4 [UFileUpload docs](https://ui.nuxt.com/docs/components/file-upload)
- Nuxt UI v4 [UProgress docs](https://ui.nuxt.com/docs/components/progress)
- [ImgBB API v1](https://api.imgbb.com/)
- Related: `2026-02-04-imgbb-image-upload-repository.md`
