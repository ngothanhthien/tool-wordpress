# Watermark Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic background watermarking to product images in the WooCommerce upload form with non-blocking UX, progress tracking, and error handling.

**Architecture:** When user clicks Next on Media tab, kick off background watermarking for all non-watermarked images via `/api/watermark` endpoint. Track progress with persistent progress bar, replace image URLs with watermarked versions, and handle failures with retry/remove options.

**Tech Stack:** Vue 3 Composition API, Nuxt 4, TypeScript, Nuxt UI components, Supabase, existing WatermarkRepository

---

## Task 1: Add Watermark State Refs

**Files:**
- Modify: `app/pages/products.vue:40-52` (state section)

**Step 1: Add watermark state refs after existing state declarations**

Find the state section around line 40-52 and add these new refs after `isFetchingVariants`:

```typescript
// Watermark state
const isWatermarking = ref(false)
const watermarkProgress = ref(0) // 0-100 percentage
const watermarkStatus = ref<'idle' | 'processing' | 'completed' | 'failed'>('idle')
const watermarkErrors = ref<string[]>([])
const isWatermarkErrorModalOpen = ref(false)
```

**Step 2: Update ImageItem interface**

Find the `interface ImageItem` definition around line 10-14 and add `watermarked` property:

```typescript
interface ImageItem {
  id: string           // Unique ID for drag tracking
  src: string          // Image URL
  isExisting: boolean  // Track source for reference
  watermarked: boolean // NEW - track watermark status
}
```

**Step 3: Update all ImageItem initializations to include watermarked flag**

Find all places where ImageItem objects are created and add `watermarked: false`:

1. Around line 319-323 in `openUploadModal()`:
```typescript
allImages.value = product.images.map((src, i) => ({
  id: `existing-${Date.now()}-${i}`,
  src,
  isExisting: true,
  watermarked: false  // NEW
}))
```

2. Around line 709-713 in `uploadFiles()`:
```typescript
allImages.value.push({
  id: `new-${Date.now()}-${Math.random()}`,
  src: url,
  isExisting: false,
  watermarked: false  // NEW
})
```

**Step 4: Run typecheck**

```bash
npx nuxt typecheck
```

Expected: No errors

**Step 5: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: add watermark state and update ImageItem interface"
```

---

## Task 2: Implement Watermarking Function

**Files:**
- Modify: `app/pages/products.vue` (add new function after uploadFiles)

**Step 1: Add startWatermarking function**

Add this function after the `uploadFiles` function (around line 753):

```typescript
// ========== Watermark Functions ==========

/**
 * Start background watermarking for all non-watermarked images
 * Non-blocking - allows navigation while processing
 */
async function startWatermarking() {
  // Skip if already watermarking or all images already watermarked
  if (isWatermarking.value) {
    return
  }

  const needsWatermark = allImages.value.some(img => !img.watermarked)
  if (!needsWatermark) {
    watermarkStatus.value = 'completed'
    return
  }

  isWatermarking.value = true
  watermarkStatus.value = 'processing'
  watermarkErrors.value = []
  watermarkProgress.value = 0

  const total = allImages.value.length
  let completed = 0

  for (const image of allImages.value) {
    // Skip already watermarked images
    if (image.watermarked) {
      completed++
      watermarkProgress.value = Math.round((completed / total) * 100)
      continue
    }

    try {
      const response = await $fetch('/api/watermark', {
        method: 'POST',
        body: { image_url: image.src }
      })

      if (response && typeof response === 'object' && 'success' in response) {
        const result = response as { success: boolean; data?: { watermarked_url: string }; error?: string }

        if (result.success && result.data?.watermarked_url) {
          // Replace URL with watermarked version
          image.src = result.data.watermarked_url
          image.watermarked = true
        } else {
          watermarkErrors.value.push(`Image ${image.id}: ${result.error || 'Unknown error'}`)
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      watermarkErrors.value.push(`Image ${image.id}: ${errorMsg}`)
    }

    completed++
    watermarkProgress.value = Math.round((completed / total) * 100)
  }

  isWatermarking.value = false

  if (watermarkErrors.value.length > 0) {
    watermarkStatus.value = 'failed'
    isWatermarkErrorModalOpen.value = true
  } else {
    watermarkStatus.value = 'completed'
    toast.add({
      title: 'Watermarking Complete',
      description: `Successfully watermarked ${total} image(s)`,
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
  }
}
```

**Step 2: Run typecheck**

```bash
npx nuxt typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: implement startWatermarking background function"
```

---

## Task 3: Update nextStep to Trigger Watermarking

**Files:**
- Modify: `app/pages/products.vue:384-393` (nextStep function)

**Step 1: Modify nextStep function to trigger watermarking**

Replace the existing `nextStep` function with:

```typescript
// Go to next step
async function nextStep() {
  // Trigger watermarking when leaving Media tab (step 1)
  if (currentStep.value === 1) {
    const needsWatermark = allImages.value.some(img => !img.watermarked)

    if (needsWatermark) {
      // Start background watermarking (non-blocking)
      startWatermarking() // Don't await - let it run in background
    }
  }

  // Fetch variants when moving from Categories (2) to Variants (3)
  if (currentStep.value === 2 && selectedCategories.value.length > 0) {
    await fetchVariantAttributes()
  }

  if (currentStep.value < stepperItems.length - 1) {
    currentStep.value++
  }
}
```

**Step 2: Run typecheck**

```bash
npx nuxt typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: trigger watermarking when leaving Media tab"
```

---

## Task 4: Add Progress Bar to Modal Header

**Files:**
- Modify: `app/pages/products.vue` (template section, find UModal)

**Step 1: Add progress bar inside modal body**

Find the `<template #body>` section inside `<UModal>` (around line 951) and add the progress bar at the top, right after `<div v-if="selectedProduct" class="space-y-6">`:

```vue
<template #body>
  <div v-if="selectedProduct" class="space-y-6">
    <!-- Watermark Progress Bar (persistent across all steps) -->
    <div v-if="watermarkStatus !== 'idle'" class="p-4 rounded-lg" :class="[
      watermarkStatus === 'processing' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : '',
      watermarkStatus === 'completed' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : '',
      watermarkStatus === 'failed' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : ''
    ]">
      <!-- Processing state -->
      <div v-if="watermarkStatus === 'processing'" class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Watermarking images...</span>
          <span class="text-sm text-muted">{{ watermarkProgress }}%</span>
        </div>
        <UProgress
          :value="watermarkProgress"
          :max="100"
          color="primary"
          size="md"
        />
        <p class="text-xs text-muted">
          Processing in background, you can continue to other steps
        </p>
      </div>

      <!-- Completed state -->
      <div v-else-if="watermarkStatus === 'completed'" class="flex items-center gap-2">
        <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
        <span class="text-sm font-medium">
          {{ allImages.filter(img => img.watermarked).length }}/{{ allImages.length }} images watermarked
        </span>
      </div>

      <!-- Failed state -->
      <div v-else-if="watermarkStatus === 'failed'" class="space-y-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-500" />
          <span class="text-sm font-medium">
            {{ allImages.filter(img => img.watermarked).length }}/{{ allImages.length }} watermarked, {{ watermarkErrors.length }} failed
          </span>
        </div>
        <p class="text-xs text-muted">See error modal for details</p>
      </div>
    </div>

    <!-- Existing stepper and step content -->
    <UStepper v-model="currentStep" :items="stepperItems" />
    ...
```

**Step 2: Run typecheck**

```bash
npx nuxt typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: add persistent progress bar to modal header"
```

---

## Task 5: Update Submit Button Disable Logic

**Files:**
- Modify: `app/pages/products.vue:1310-1314` (Submit button in modal footer)

**Step 1: Update Submit button to be disabled during watermarking**

Find the Submit button in the modal footer and update it:

```vue
<UButton
  v-if="currentStep === stepperItems.length - 1"
  label="Submit Upload"
  :loading="uploadLoading"
  :disabled="uploadLoading || isWatermarking || watermarkStatus === 'failed'"
  @click="submitUpload"
/>
```

**Step 2: Run typecheck**

```bash
npx nuxt typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: disable Submit button during watermarking or on failure"
```

---

## Task 6: Disable Delete Buttons During Watermarking

**Files:**
- Modify: `app/pages/products.vue:1266-1273` (delete button in image grid)

**Step 1: Update delete button to be disabled during watermarking**

Find the delete button inside the image grid and add the disabled prop:

```vue
<UButton
  icon="i-heroicons-x-mark"
  size="sm"
  color="error"
  variant="solid"
  class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
  :disabled="isWatermarking"
  @click="deleteImage(index)"
/>
```

**Step 2: Run typecheck**

```bash
npx nuxt typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: disable image delete during watermarking"
```

---

## Task 7: Add Error Modal Component

**Files:**
- Modify: `app/pages/products.vue` (template section, after existing Image Preview Modal)

**Step 1: Add watermark error modal at the end of template**

Find the closing `</div>` of the main page container and add the error modal before it (after the Image Preview Modal, around line 1337):

```vue
<!-- Watermark Error Modal -->
<UModal
  v-model:open="isWatermarkErrorModalOpen"
  title="Watermarking Failed"
  :ui="{ footer: 'justify-end' }"
>
  <template #body>
    <div class="space-y-4">
      <p class="text-sm text-muted">
        Some images failed to watermark. You can retry the failed images or remove them from the list.
      </p>

      <!-- Error list -->
      <div v-if="watermarkErrors.length > 0" class="space-y-2">
        <p class="text-sm font-medium">Failed images:</p>
        <div class="max-h-60 overflow-y-auto space-y-2">
          <div
            v-for="(error, index) in watermarkErrors"
            :key="index"
            class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm"
          >
            {{ error }}
          </div>
        </div>
      </div>
    </div>
  </template>

  <template #footer>
    <UButton
      label="Remove Failed & Continue"
      color="neutral"
      variant="outline"
      @click="removeFailedAndContinue"
    />
    <UButton
      label="Retry Failed Images"
      color="primary"
      @click="retryFailedImages"
    />
  </template>
</UModal>
```

**Step 2: Run typecheck**

```bash
npx nuxt typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: add watermark error modal component"
```

---

## Task 8: Implement Error Handler Functions

**Files:**
- Modify: `app/pages/products.vue` (add after startWatermarking function)

**Step 1: Add retry and remove functions**

Add these functions after the `startWatermarking` function:

```typescript
/**
 * Retry watermarking for failed images
 */
async function retryFailedImages() {
  isWatermarkErrorModalOpen.value = false
  await startWatermarking() // Only processes non-watermarked images
}

/**
 * Remove images that failed to watermark and continue
 */
function removeFailedAndContinue() {
  // Get count before removal
  const failedCount = watermarkErrors.value.length

  // Remove images that failed to watermark (not marked as watermarked)
  allImages.value = allImages.value.filter(img => img.watermarked)
  isWatermarkErrorModalOpen.value = false
  watermarkErrors.value = []

  // Reset watermark status to idle since we've cleaned up
  watermarkStatus.value = 'idle'
  watermarkProgress.value = 0

  toast.add({
    title: 'Failed Images Removed',
    description: `${failedCount} image(s) removed from list`,
    color: 'warning',
    icon: 'i-heroicons-exclamation-triangle'
  })

  // Check if we still have images
  if (allImages.value.length === 0) {
    toast.add({
      title: 'No Images Remaining',
      description: 'Please upload at least one image to continue',
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle'
    })
  }
}
```

**Step 2: Run typecheck**

```bash
npx nuxt typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: implement retry and remove error handlers"
```

---

## Task 9: Reset Watermark State on Modal Close

**Files:**
- Modify: `app/pages/products.vue:332-347` (closeUploadModal function)

**Step 1: Update closeUploadModal to reset watermark state**

Add watermark state resets to the `closeUploadModal` function:

```typescript
// Close upload modal
function closeUploadModal() {
  isUploadModalOpen.value = false
  selectedProduct.value = null
  selectedCategories.value = []
  isCategoryDropdownOpen.value = false
  currentStep.value = 0
  // Reset upload state
  allImages.value = []
  newImages.value = []
  selectedFiles.value = []
  uploadingFiles.value = []
  uploadProgress.value = []
  variants.value = []
  variantAttributes.value = []
  // Reset watermark state
  isWatermarking.value = false
  watermarkProgress.value = 0
  watermarkStatus.value = 'idle'
  watermarkErrors.value = []
  isWatermarkErrorModalOpen.value = false
}
```

**Step 2: Run typecheck**

```bash
npx nuxt typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: reset watermark state on modal close"
```

---

## Task 10: Manual Testing

**Files:**
- Test in browser

**Step 1: Start dev server**

```bash
bun run dev
```

**Step 2: Test watermarking flow**

1. Open the products page
2. Click "Upload" on a draft product
3. Navigate to Media tab (Step 1)
4. Upload a few images (wait for ImgBB upload to complete)
5. Click "Next"
6. Verify:
   - Progress bar appears at top of modal
   - Progress updates (0%, 20%, 40%, etc.)
   - Can navigate to Categories step while progress shows
   - Submit button is disabled during watermarking
   - Delete buttons on images are disabled
   - After completion, progress bar becomes green status badge
   - Submit button becomes enabled
   - Navigate back to Media tab, click Next again
   - Verify: No re-watermarking (immediate navigation, status badge shows)

**Step 3: Test error handling**

1. Add an image with an invalid URL (manually in browser console or test with broken URL)
2. Click Next to trigger watermarking
3. Verify:
   - Error modal appears with error message
   - Can click "Retry Failed Images"
   - Can click "Remove Failed & Continue"
   - After remove, failed images are gone from list
   - Status badge updates to show remaining count

**Step 4: Test edge cases**

1. Upload images, watermark, then upload more images
   - Verify: Only new images get watermarked on next Next click
2. Start watermarking, then close modal immediately
   - Verify: State resets cleanly on next open
3. Try to submit while watermarking
   - Verify: Submit button disabled

**Step 5: Commit final changes**

```bash
git add .
git commit -m "test: manual testing complete, watermark feature working"
```

---

## Task 11: Typecheck and Final Validation

**Files:**
- All files

**Step 1: Run full typecheck**

```bash
npx nuxt typecheck
```

Expected: No errors

**Step 2: Run linter (if configured)**

```bash
bun run lint || echo "No lint script configured"
```

**Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete watermark feature implementation

- Background watermarking on Media tab Next click
- Persistent progress bar across all steps
- Error modal with retry/remove options
- Non-blocking UX, blocks Submit until complete
- Prevents re-watermarking with watermarked flag"
```

---

## Summary

This implementation adds:

1. **State management**: Watermark progress, status, and error tracking
2. **Background processing**: Non-blocking watermarking with progress bar
3. **UI components**: Progress bar, status badge, error modal
4. **Error handling**: Retry and remove failed images
5. **Edge cases**: Re-watermarking prevention, delete blocking, state reset

**Total changes:** ~300 lines of code in `app/pages/products.vue`

**Estimated time:** 60-90 minutes for all tasks
