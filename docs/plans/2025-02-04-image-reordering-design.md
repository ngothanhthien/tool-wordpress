# Image Reordering Feature Design

**Date**: 2025-02-04
**Status**: Approved
**Author**: Claude + User Collaboration

## Overview

Add drag-and-drop reordering capability to product image uploads in the WooCommerce product upload flow. Images can be reordered visually, with automatic position tracking and failed image auto-deletion.

## Requirements

1. **Drag & Drop Reordering**: Users can drag images to reorder them in the Media step
2. **Unified List**: Existing and newly uploaded images displayed together in one reorderable grid
3. **Delete Instead of Select**: Delete button on each image (not checkboxes)
4. **Auto-Delete Failed Images**: Images that fail to load are automatically removed
5. **Position Tracking**: Visual position badges show current order (1, 2, 3...)

## Data Structure

### New Type

```typescript
interface ImageItem {
  id: string           // Unique ID for drag tracking (e.g., 'existing-1736025600-0')
  src: string          // Image URL
  isExisting: boolean  // Track source for reference (not logic)
}
```

### State Changes

| Remove | Add | Purpose |
|--------|-----|---------|
| `uploadForm.uploadImages` | `allImages: Ref<ImageItem[]>` | Unified image list |
| `uploadForm.imageLoaded` | | No longer needed (auto-delete on error) |

### Keep for Upload Tracking

- `newImages: Ref<string[]>` - Track newly uploaded URLs
- `selectedFiles: Ref<File[]>` - Files waiting to upload
- `uploadingFiles: Ref<File[]>` - Currently uploading
- `uploadProgress: Ref<number[]>` - Upload progress per file

## Components

### Image Grid

Unified grid with drag handles, position badges, and delete buttons:

```vue
<div class="grid grid-cols-2 gap-3">
  <div
    v-for="(image, index) in allImages"
    :key="image.id"
    draggable="true"
    @dragstart="onDragStart(index, $event)"
    @dragover.prevent
    @dragenter.prevent
    @drop="onDrop(index, $event)"
    @dragend="onDragEnd"
    :class="[
      'relative p-2 border rounded-lg transition-all',
      draggedIndex === index ? 'opacity-50 scale-95' : 'hover:border-primary'
    ]"
    class="group"
  >
    <!-- Drag Handle -->
    <div class="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move z-10">
      <div class="bg-gray-200 dark:bg-gray-700 rounded p-1">
        <UIcon name="i-heroicons-bars-3" class="w-4 h-4" />
      </div>
    </div>

    <!-- Image Preview -->
    <div class="cursor-pointer" @click="openImagePreview(image.src)">
      <img
        :src="image.src"
        :alt="`Image ${index + 1}`"
        class="w-full aspect-square object-cover rounded hover:opacity-80 transition-opacity"
        draggable="false"
        @error="onImageLoadError(image.src)"
      >
    </div>

    <!-- Position Badge -->
    <div class="absolute top-2 right-12 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
      {{ index + 1 }}
    </div>

    <!-- Delete Button -->
    <UButton
      icon="i-heroicons-x-mark"
      size="sm"
      color="error"
      variant="solid"
      class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
      @click="deleteImage(index)"
    />
  </div>
</div>
```

### Empty State

```vue
<div v-if="allImages.length === 0" class="text-center py-8 border-2 border-dashed rounded-lg">
  <UIcon name="i-heroicons-photo" class="w-12 h-12 mx-auto text-muted mb-2" />
  <p class="text-muted">No images selected</p>
  <p class="text-sm text-muted-foreground">Upload images to get started</p>
</div>
```

## Functions

### Drag & Drop

```typescript
const draggedIndex = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent) {
  draggedIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/html', String(index))
  }
}

function onDragEnd() {
  draggedIndex.value = null
}

function onDrop(targetIndex: number, event: DragEvent) {
  event.preventDefault()

  if (draggedIndex.value === null || draggedIndex.value === targetIndex) {
    return
  }

  const [removed] = allImages.value.splice(draggedIndex.value, 1)
  allImages.value.splice(targetIndex, 0, removed)

  draggedIndex.value = null
}
```

### Delete Image

```typescript
function deleteImage(index: number) {
  allImages.value.splice(index, 1)

  toast.add({
    title: 'Image Removed',
    description: 'Image removed from upload list',
    color: 'neutral',
    icon: 'i-heroicons-trash',
  })
}
```

### Auto-Delete on Error

```typescript
function onImageLoadError(src: string) {
  const index = allImages.value.findIndex(img => img.src === src)
  if (index > -1) {
    allImages.value.splice(index, 1)

    toast.add({
      title: 'Image Removed',
      description: 'Failed to load image, automatically removed from list',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle',
    })
  }
}
```

### Modal Open

```typescript
function openUploadModal(product: Product) {
  selectedProduct.value = product

  // Populate form fields
  uploadForm.seo_title = product.seo_title
  uploadForm.meta_description = product.meta_description
  uploadForm.short_description = product.short_description
  uploadForm.html_content = product.html_content
  uploadForm.keywords = [...product.keywords]
  uploadForm.price = product.price

  // Pre-fill categories
  selectedCategories.value = (product.raw_categories || [])
    .map(rc => categories.value.find(c => c.id === rc.id))
    .filter((c): c is Category => c !== undefined)

  // Initialize allImages with existing product images
  allImages.value = product.images.map((src, i) => ({
    id: `existing-${Date.now()}-${i}`,
    src,
    isExisting: true
  }))

  // Reset upload state
  newImages.value = []
  selectedFiles.value = []
  uploadingFiles.value = []
  uploadProgress.value = []

  currentStep.value = 0
  isUploadModalOpen.value = true
}
```

### After Upload Completes

In `uploadFiles()` function, add newly uploaded images to `allImages`:

```typescript
if (!isDuplicateUrl(url)) {
  newImages.value.push(url)
  allImages.value.push({
    id: `new-${Date.now()}-${Math.random()}`,
    src: url,
    isExisting: false
  })

  toast.add({
    title: 'Upload Complete',
    description: `${file.name} uploaded successfully`,
    color: 'success',
    icon: 'i-heroicons-check-circle',
  })
}
```

### Submit Upload

```typescript
async function submitUpload() {
  if (!selectedProduct.value) return

  // Validate price
  if (uploadForm.price === null) {
    toast.add({
      title: 'Validation Error',
      description: 'Price is required',
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  // Require at least one image
  if (allImages.value.length === 0) {
    toast.add({
      title: 'Validation Error',
      description: 'At least one image is required',
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  uploadLoading.value = true
  try {
    await $fetch('/api/products/upload', {
      method: 'POST',
      body: {
        productId: selectedProduct.value.id,
        seo_title: uploadForm.seo_title,
        meta_description: uploadForm.meta_description,
        short_description: uploadForm.short_description,
        html_content: uploadForm.html_content,
        keywords: uploadForm.keywords,
        images: allImages.value.map(img => img.src), // Already in correct order
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

### Modal Close

```typescript
function closeUploadModal() {
  isUploadModalOpen.value = false
  selectedProduct.value = null
  selectedCategories.value = []
  isCategoryDropdownOpen.value = false
  currentStep.value = 0

  // Reset image state
  allImages.value = []
  newImages.value = []
  selectedFiles.value = []
  uploadingFiles.value = []
  uploadProgress.value = []

  // Reset form
  uploadForm.seo_title = ''
  uploadForm.meta_description = ''
  uploadForm.short_description = ''
  uploadForm.html_content = ''
  uploadForm.keywords = []
  uploadForm.images = []
  uploadForm.uploadImages = []
  uploadForm.imageLoaded = []
  uploadForm.price = null
}
```

## Template Changes (Step 1: Media)

### Remove

- Checkbox state: `v-model="uploadForm.uploadImages[index]"`
- Loaded state: `v-show="uploadForm.imageLoaded[index]"`

### Replace with

Single unified grid section combining "Existing Images" and "New Images":

```vue
<!-- Step 1: Media -->
<div v-show="currentStep === 1" class="space-y-4">
  <!-- File Upload -->
  <UFormField label="Upload New Images">
    <UFileUpload
      v-model="selectedFiles"
      accept="image/*"
      multiple
      :max-size="32 * 1024 * 1024"
      size="md"
      color="primary"
      class="w-full"
    >
      <template #label>
        <span>Click to upload or drag and drop images here</span>
      </template>
      <template #description>
        <span>JPG, PNG, GIF, WebP up to 32MB each</span>
      </template>
    </UFileUpload>
  </UFormField>

  <!-- Uploading Files with Progress -->
  <div v-if="uploadingFiles.length > 0" class="space-y-2">
    <p class="text-sm font-medium">Uploading...</p>
    <div
      v-for="(file, index) in uploadingFiles"
      :key="`uploading-${index}`"
      class="p-3 border rounded-lg space-y-2"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm truncate">{{ file.name }}</span>
        <span class="text-xs text-muted">{{ uploadProgress[index] }}%</span>
      </div>
      <UProgress
        :value="uploadProgress[index]"
        :max="100"
        color="primary"
        size="sm"
      />
    </div>
  </div>

  <!-- Unified Image Grid with Drag & Drop -->
  <div v-if="allImages.length > 0">
    <p class="text-sm font-medium mb-2">
      Images ({{ allImages.length }}) - Drag to reorder
    </p>
    <!-- Grid component shown above -->
  </div>

  <!-- Empty state shown above -->
</div>
```

## Integration Points

### WooCommerce API

No changes required. The existing `uploadProduct()` method in `woocommerce.ts` already supports the `position` field:

```typescript
images: product.images.map((src, index) => ({
  src,
  alt: this.generateImageAlt(product.seo_title),
  position: index
}))
```

The unified `allImages` array maintains order, so `map(img => img.src)` produces images in the correct sequence.

## Testing Checklist

- [ ] Drag image to new position, verify order updates
- [ ] Delete image, verify position badges update
- [ ] Upload new image, verify it appears in grid
- [ ] Upload new image, verify it can be reordered with existing
- [ ] Trigger image load error (broken URL), verify auto-delete
- [ ] Submit with no images, verify validation error
- [ ] Submit with reordered images, verify WooCommerce receives correct order
- [ ] Close and reopen modal, verify state resets correctly
- [ ] Mobile touch devices: verify drag works or add touch support

## Files to Modify

- `app/pages/products.vue` - Main implementation

## Future Enhancements (Out of Scope)

- Touch device support (may need library like `vuedraggable`)
- Bulk delete (select multiple images)
- Undo delete
- Image cropping/editing before upload
