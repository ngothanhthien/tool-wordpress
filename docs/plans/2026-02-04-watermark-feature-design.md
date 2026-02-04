# Watermark Feature Design

## Overview

Add automatic watermark application to product images in the WooCommerce upload form. When user clicks "Next" on the Media tab, images are watermarked in the background with a non-blocking UX.

## Requirements

- Apply watermark to all images when navigating from Media tab
- Run watermarking in background (non-blocking navigation)
- Block final Submit until watermarking completes
- Show persistent progress indicator across all steps
- Handle failures gracefully with retry/remove options

## Architecture

### Data Flow

```
User clicks Next on Media tab (Step 1)
  ↓
Check if images already watermarked
  ↓ No
Start background watermarking process
  ↓
Show progress bar at modal top
User can navigate between steps
  ↓
Submit button disabled until complete
  ↓
On complete: Replace URLs, mark watermarked=true
On failure: Block navigation, show error modal
```

### State Management

```typescript
// Watermarking state
const isWatermarking = ref(false)
const watermarkProgress = ref(0)           // 0-100 percentage
const watermarkStatus = ref<'idle' | 'processing' | 'completed' | 'failed'>('idle')
const watermarkErrors = ref<string[]>([])

// Modal state
const isWatermarkErrorModalOpen = ref(false)
```

### Updated Interface

```typescript
interface ImageItem {
  id: string
  src: string
  isExisting: boolean
  watermarked: boolean  // NEW - track watermark status per image
}
```

## UI Components

### Progress Bar (Modal Header)

**Location:** Directly under modal title, full width

**During Watermarking:**
- Text: "Watermarking images... 3/5 (60%)"
- Smooth animated progress bar
- Visible on all steps while processing

**After Completion:**
- Transforms to status badge
- Green: "✓ 5/5 images watermarked"
- Red: "⚠ 3/5 watermarked, 2 failed"
- Persists until modal closes

### Button States

**Next Button (Media tab):**
- Always clickable (non-blocking)
- If already watermarked → immediate navigation
- If not → trigger watermarking, navigate immediately

**Submit Button (Final step):**
- Disabled while `isWatermarking === true`
- Disabled if `watermarkStatus === 'failed'`
- Enabled only when `watermarkStatus === 'completed'`

### Error Modal

```
┌─────────────────────────────────────┐
│ Watermarking Failed                  │
├─────────────────────────────────────┤
│ Some images failed to watermark.     │
│ You can retry or remove them.        │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ new-123: HTTP 500: Internal...  │ │
│ │ existing-456: Invalid image URL │ │
│ └─────────────────────────────────┘ │
│                                      │
│ [Remove Failed & Continue] [Retry]  │
└─────────────────────────────────────┘
```

## Implementation Logic

### Trigger Watermarking

```typescript
async function nextStep() {
  // Only trigger from Media step (step 1)
  if (currentStep.value === 1) {
    const needsWatermark = allImages.value.some(img => !img.watermarked)

    if (needsWatermark) {
      // Start background watermarking (non-blocking)
      startWatermarking() // Don't await - let it run in background
    }
  }

  // Existing logic for variants fetch
  if (currentStep.value === 2 && selectedCategories.value.length > 0) {
    await fetchVariantAttributes()
  }

  currentStep.value++
}
```

### Background Watermarking

```typescript
async function startWatermarking() {
  isWatermarking.value = true
  watermarkStatus.value = 'processing'
  watermarkErrors.value = []

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

      if (response.success) {
        // Replace URL with watermarked version
        image.src = response.data.watermarked_url
        image.watermarked = true
      } else {
        watermarkErrors.value.push(`${image.id}: ${response.error}`)
      }
    } catch (error) {
      watermarkErrors.value.push(`${image.id}: ${error.message || 'Unknown error'}`)
    }

    completed++
    watermarkProgress.value = Math.round((completed / total) * 100)
  }

  isWatermarking.value = false

  if (watermarkErrors.value.length > 0) {
    watermarkStatus.value = 'failed'
    showWatermarkErrorModal()
  } else {
    watermarkStatus.value = 'completed'
  }
}
```

### Error Handling

**Retry Failed Images:**
```typescript
async function retryFailedImages() {
  isWatermarkErrorModalOpen.value = false
  await startWatermarking() // Only processes non-watermarked images
}
```

**Remove Failed & Continue:**
```typescript
function removeFailedAndContinue() {
  // Remove images that failed to watermark
  allImages.value = allImages.value.filter(img => img.watermarked)
  isWatermarkErrorModalOpen.value = false

  toast.add({
    title: 'Failed Images Removed',
    description: `${watermarkErrors.value.length} image(s) removed`,
    color: 'warning'
  })

  watermarkErrors.value = []

  if (allImages.value.length === 0) {
    toast.add({
      title: 'No Images Remaining',
      description: 'Please upload at least one image',
      color: 'error'
    })
  }
}
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User adds images after watermarking | New images marked `watermarked: false`, Next triggers watermarking for new images only |
| User navigates back to Media step | Skips watermarking (all already `watermarked: true`), status badge remains visible |
| User deletes image during watermarking | Delete buttons disabled during `isWatermarking` |
| User closes modal during watermarking | Pending requests complete silently, no UI updates |
| All images fail | Empty list after "Remove Failed", submit validation catches this |
| ImgBB upload + watermark | ImgBB progress (25%, 50%, 100%), then watermarking starts |

## Files to Modify

1. **app/pages/products.vue**
   - Add watermark state refs
   - Update `ImageItem` interface
   - Implement `startWatermarking()` function
   - Update `nextStep()` to trigger watermarking
   - Add error modal component
   - Add progress bar component to modal header
   - Disable delete buttons during watermarking
   - Update Submit button disable logic

## Testing Checklist

- [ ] Watermarking triggers on Next from Media tab
- [ ] Progress bar shows correct count/percentage
- [ ] Can navigate between steps while watermarking
- [ ] Submit disabled during watermarking
- [ ] Submit enabled after successful watermarking
- [ ] Error modal appears on failures
- [ ] Retry re-processes only failed images
- [ ] Remove failed removes correct images
- [ ] Adding new images after watermarking works
- [ ] Navigating back skips re-watermarking
- [ ] All images fail handled correctly
- [ ] Status badge persists until modal close
