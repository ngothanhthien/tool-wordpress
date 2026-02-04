# Upload Modal Categories Tab Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize the upload modal stepper by moving the price input from the Media & Price tab to the Categories tab, and reordering tabs to: Content → Media → Categories & Price.

**Architecture:** The upload modal uses a 3-step stepper (UStepper) with v-show conditions to display different form sections. The stepper items array defines the order and metadata, while the template sections use currentStep value to conditionally render.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, Nuxt UI v4 components (UStepper, UModal, UFormField, UInputNumber, USelectMenu)

---

## Task 1: Update Stepper Items Order

**Files:**
- Modify: `app/pages/products.vue:32-51`

**Step 1: Identify current stepper items order**

Current order is:
- Step 0: Content
- Step 1: Categories
- Step 2: Media & Price

New order should be:
- Step 0: Content
- Step 1: Media
- Step 2: Categories & Price

**Step 2: Modify stepper items array**

Replace lines 32-51 with:

```typescript
// Stepper items
const stepperItems = [
  {
    title: 'Content',
    description: 'Edit product content',
    icon: 'i-heroicons-document-text',
    value: 0,
  },
  {
    title: 'Media',
    description: 'Select product images',
    icon: 'i-heroicons-photo',
    value: 1,
  },
  {
    title: 'Categories & Price',
    description: 'Select categories and set price',
    icon: 'i-heroicons-tag',
    value: 2,
  },
]
```

**Step 3: Type check**

Run: `npx nuxt typecheck`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add app/pages/products.vue
git commit -m "refactor: reorder stepper items to Content -> Media -> Categories & Price"
```

---

## Task 2: Move Media Section Template (Remove Price)

**Files:**
- Modify: `app/pages/products.vue:472-505`

**Step 1: Remove price input from Media section**

Replace the entire "Step 2: Media & Price" section (lines 472-505) with "Step 1: Media" containing only images:

```vue
          <!-- Step 1: Media -->
          <div v-show="currentStep === 1" class="space-y-4">
            <!-- Images with upload checkbox -->
            <UFormField v-if="uploadForm.images.length > 0" label="Images">
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="(image, index) in uploadForm.images"
                  v-show="uploadForm.imageLoaded[index]"
                  :key="index"
                  class="flex items-center gap-3 p-2 border rounded-lg"
                >
                  <UCheckbox v-model="uploadForm.uploadImages[index]" :name="`image-${index}`" />
                  <div class="flex-1 cursor-pointer" @click="openImagePreview(image)">
                    <img
                      :src="image"
                      :alt="`Image ${index + 1}`"
                      class="w-full object-cover rounded hover:opacity-80 transition-opacity"
                      @error="onImageError(index)"
                    >
                  </div>
                </div>
              </div>
            </UFormField>
          </div>
```

**Step 2: Type check**

Run: `npx nuxt typecheck`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "refactor: move media section to step 1, remove price input"
```

---

## Task 3: Update Categories Section to Include Price

**Files:**
- Modify: `app/pages/products.vue:449-470`

**Step 1: Replace Categories section with Categories & Price**

Replace the entire "Step 1: Categories" section (lines 449-470) with "Step 2: Categories & Price" including price input:

```vue
          <!-- Step 2: Categories & Price -->
          <div v-show="currentStep === 2" class="space-y-4">
            <!-- Price -->
            <UFormField label="Price (VND)" required>
              <UInputNumber
                v-model="uploadForm.price"
                placeholder="Enter price"
                :increment="false"
                :decrement="false"
              />
            </UFormField>

            <!-- Categories -->
            <UFormField label="Categories">
              <USelectMenu
                v-model="selectedCategories"
                multiple
                :items="categories as any"
                create-item
                placeholder="Search categories or add new..."
                value-key="id"
                label-key="name"
                by="id"
                class="w-full"
              >
                <template #item-label="{ item }">
                  {{ item.name }}
                  <span class="text-muted text-xs ml-2">{{ item.slug }}</span>
                </template>
              </USelectMenu>
            </UFormField>
          </div>
```

**Step 2: Type check**

Run: `npx nuxt typecheck`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: add price input to categories & price tab"
```

---

## Task 4: Manual Testing

**Files:**
- Test: Manual browser testing

**Step 1: Start dev server**

Run: `bun run dev`

**Step 2: Verify stepper order**

Navigate to `/products`, click "Upload" on any product.

Expected behavior:
- Stepper shows: Content → Media → Categories & Price

**Step 3: Verify Media tab (Step 1)**

Click "Next" to go to Media tab.

Expected behavior:
- Only images with checkboxes are shown
- No price input field

**Step 4: Verify Categories & Price tab (Step 2)**

Click "Next" to go to Categories & Price tab.

Expected behavior:
- Price input field appears at top
- Category selector appears below price
- Both fields are functional

**Step 5: Test navigation flow**

Use "Back" and "Next" buttons to navigate between tabs.

Expected behavior:
- Navigation works correctly
- Form state persists when moving between tabs

**Step 6: Test form submission**

Fill in all fields and submit.

Expected behavior:
- Price validation still works
- Product uploads successfully with price and categories

---

## Task 5: Update Commit History

**Files:**
- Git: Squash commits if desired

**Step 1: Review commits**

Run: `git log --oneline -5`

**Step 2: Optional - Squash related commits**

If you want a single clean commit:

```bash
git reset --soft HEAD~3
git commit -m "refactor: reorganize upload modal tabs to Content -> Media -> Categories & Price

- Move price input from Media tab to Categories tab
- Reorder stepper to place Media after Content
- Rename final tab to 'Categories & Price'"
```

---

## Summary

**Files Modified:** `app/pages/products.vue`

**Changes:**
1. Stepper items array reordered (lines 32-51)
2. Media section moved to Step 1, price removed (was lines 472-505)
3. Categories section moved to Step 2, price added (was lines 449-470)

**User Flow After Changes:**
- Step 0 (Content): SEO title, meta description, keywords, short description, HTML content
- Step 1 (Media): Product images with upload checkboxes
- Step 2 (Categories & Price): Price input + category selector

**Validation:** Price is still required and validated on submit (validation logic unchanged at lines 317-326)
