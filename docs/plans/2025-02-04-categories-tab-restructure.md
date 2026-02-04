# Categories Tab Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the categories selection from the "Content" tab to a new dedicated "Categories" tab in the product upload modal

**Architecture:** Update the stepper items array to include a new "Categories" step, move the categories UFormField from Step 0 to the new Step 1, and adjust step indices for Media & Price content (moves from Step 1 to Step 2).

**Tech Stack:** Nuxt 4, Vue 3 Composition API, Nuxt UI v4 (UStepper, UFormField, USelectMenu)

---

### Task 1: Update Stepper Items Array

**Files:**
- Modify: `app/pages/products.vue:33-46`

**Step 1: Add new Categories stepper item**

The current stepperItems array has 2 items (Content, Media & Price). Add a new item for Categories between them.

Replace lines 33-46 with:

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
    title: 'Categories',
    description: 'Select product categories',
    icon: 'i-heroicons-tag',
    value: 1,
  },
  {
    title: 'Media & Price',
    description: 'Set images and price',
    icon: 'i-heroicons-photo',
    value: 2,
  },
]
```

**Step 2: Run type check**

Run: `npx nuxt typecheck`
Expected: PASS (no errors - this is just adding an object to an array)

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: add Categories stepper item to upload modal"
```

---

### Task 2: Move Categories Field to New Step 1

**Files:**
- Modify: `app/pages/products.vue:423-504`

**Step 1: Remove Categories from Content tab (Step 0)**

The Categories UFormField is currently at lines 450-468 in the Content tab section (currentStep === 0). Remove those lines (450-468 inclusive).

After removal, the Content tab section should end at line 449 (closing </div> after HTML Content field).

**Step 2: Create new Categories tab (Step 1)**

After the closing `</div>` of the Content tab section (now line 449 after removal), add a new Categories tab section:

```vue
          <!-- Step 1: Categories -->
          <div v-show="currentStep === 1" class="space-y-4">
            <!-- Categories -->
            <UFormField label="Categories">
              <USelectMenu
                v-model="selectedCategories"
                :items="categories as any"
                multiple
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

**Step 3: Update Media & Price tab condition from Step 1 to Step 2**

Change line 472 from:
```vue
          <!-- Step 2: Media & Price -->
          <div v-show="currentStep === 1" class="space-y-4">
```

To:
```vue
          <!-- Step 2: Media & Price -->
          <div v-show="currentStep === 2" class="space-y-4">
```

**Step 4: Run type check**

Run: `npx nuxt typecheck`
Expected: PASS (template structure changes only)

**Step 5: Test in browser**

Run: `bun run dev`
Expected: Dev server starts at http://localhost:3000

1. Navigate to http://localhost:3000/products
2. Click "Upload" button on any product
3. Verify stepper shows 3 steps: Content, Categories, Media & Price
4. Click "Next" to move from Content to Categories tab
5. Verify Categories dropdown appears with categories from database
6. Click "Next" to move to Media & Price tab
7. Verify Price and Images fields appear

**Step 6: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: move categories to dedicated tab in upload modal"
```

---

### Task 3: Verify Form Submission Still Works

**Files:**
- Test: Manual browser test
- Verify: `app/pages/products.vue:315-369` (submitUpload function)

**Step 1: Test full upload flow**

In the running dev server (from Task 2, Step 5):

1. Navigate to http://localhost:3000/products
2. Click "Upload" on any DRAFT or FAILED product
3. On Content tab: modify SEO Title
4. Click "Next" to go to Categories tab
5. Select at least one category
6. Click "Next" to go to Media & Price tab
7. Enter a price (e.g., 100000)
8. Select at least one image checkbox
9. Click "Submit Upload"
10. Verify success toast appears
11. Verify modal closes
12. Verify product table refreshes

**Step 2: Verify categories are passed to API**

Open browser DevTools (F12) → Network tab before submitting. Check the POST request to `/api/products/upload`:

Request body should include:
```json
{
  "productId": "...",
  "seo_title": "...",
  "meta_description": "...",
  "short_description": "...",
  "html_content": "...",
  "keywords": [...],
  "images": [...],
  "price": 100000,
  "categories": [...] // Categories should be present
}
```

**Step 3: Check database (optional)**

Run: `bun run --bun test-db-query.ts` (create this file to query recent products)

Or verify via Supabase dashboard that the uploaded product has categories associated.

**Step 4: Commit**

```bash
# If any adjustments needed, commit them
git add app/pages/products.vue
git commit -m "fix: ensure categories submission works with new tab structure"
```

---

### Task 4: Clean Up and Final Validation

**Files:**
- Verify: `app/pages/products.vue` (entire file)

**Step 1: Final type check**

Run: `npx nuxt typecheck`
Expected: PASS with no errors

**Step 2: Lint check (if configured)**

Run: `npx eslint app/pages/products.vue`
Expected: No linting errors

**Step 3: Final manual test**

Repeat the full upload flow one more time:
1. Open upload modal
2. Navigate through all 3 tabs using Next/Back buttons
3. Fill in required fields
4. Submit successfully
5. Verify no console errors

**Step 4: Final commit**

```bash
git add app/pages/products.vue docs/plans/2025-02-04-categories-tab-restructure.md
git commit -m "docs: add categories tab restructure plan and complete implementation"
```

---

## Summary of Changes

**File modified:** `app/pages/products.vue`

**Changes:**
1. Line 33-46: Added new Categories item to stepperItems array (now 3 items)
2. Line 450-468: Removed Categories UFormField from Content tab
3. After line 449: Added new Categories tab section (Step 1)
4. Line 472: Updated Media & Price tab condition from `currentStep === 1` to `currentStep === 2`

**No backend changes required** - The submitUpload function already passes `selectedCategories.value` in the request body, so moving the UI element doesn't affect the API.

**No database changes required** - Categories relationship is already established.

---

## Testing Checklist

- [ ] Stepper shows 3 steps: Content, Categories, Media & Price
- [ ] Categories tab displays the USelectMenu component
- [ ] Categories can be selected and deselected
- [ ] Navigation between tabs works correctly with Next/Back buttons
- [ ] Form submission includes selected categories
- [ ] Type check passes with no errors
- [ ] No console errors in browser
- [ ] Product upload completes successfully
