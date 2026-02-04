# WooCommerce Product Attributes Accordion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace category-based variant fetching with WooCommerce global product attributes displayed as selectable accordions with term values and pre-filled pricing.

**Architecture:** Fetch all global attributes and their terms from WooCommerce REST API upfront, display as expandable accordions with checkboxes for term selection, pre-fill prices with product base price, transform to WooCommerce format on submission.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, Nuxt UI v4 (UAccordion), WooCommerce REST API v3

---

## Task 1: Create WooCommerce Product Attributes API Endpoint

**Files:**
- Create: `server/api/woocommerce/product-attributes.get.ts`
- Reference: `app/repositories/supabase/woocommerce.ts`

**Step 1: Create the API endpoint file**

```typescript
// server/api/woocommerce/product-attributes.get.ts
import { WooCommerceRepository } from '~/repositories/supabase/woocommerce'

export default defineEventHandler(async (event) => {
  const { baseUrl, consumerKey, consumerSecret } = getQuery(event)

  if (!baseUrl || !consumerKey || !consumerSecret) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing WooCommerce credentials'
    })
  }

  const wc = new WooCommerceRepository(
    baseUrl as string,
    consumerKey as string,
    consumerSecret as string
  )

  try {
    const attributes = await wc.getAllProductAttributes()
    return { attributes }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch product attributes'
    })
  }
})
```

**Step 2: Add repository methods**

Modify: `app/repositories/supabase/woocommerce.ts`

Add these methods to `WooCommerceRepository` class:

```typescript
async getAllProductAttributes() {
  const response = await fetch(`${this.baseUrl}/wp-json/wc/v3/products/attributes`, {
    headers: this.getAuthHeaders()
  })
  if (!response.ok) throw new Error('Failed to fetch attributes')
  const attributes = await response.json()

  // Fetch all terms in parallel
  const attributesWithTerms = await Promise.all(
    attributes.map(async (attr: any) => {
      try {
        const termsResponse = await fetch(
          `${this.baseUrl}/wp-json/wc/v3/products/attributes/${attr.id}/terms`,
          { headers: this.getAuthHeaders() }
        )
        const terms = await termsResponse.json()
        return { ...attr, terms }
      } catch {
        return { ...attr, terms: [] }
      }
    })
  )

  return attributesWithTerms
}
```

**Step 3: Commit**

```bash
git add server/api/woocommerce/product-attributes.get.ts app/repositories/supabase/woocommerce.ts
git commit -m "feat: add WooCommerce product attributes API endpoint

- Add endpoint to fetch all global product attributes
- Fetch all terms for each attribute in parallel
- Return combined structure with terms nested"
```

---

## Task 2: Create Type Definitions for Attributes

**Files:**
- Create: `app/entities/WooCommerceAttribute.schema.ts`

**Step 1: Create Zod schema for WooCommerce attributes**

```typescript
// app/entities/WooCommerceAttribute.schema.ts
import { z } from 'zod'

export const WooCommerceAttributeTermSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  count: z.number(),
})

export const WooCommerceAttributeSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  type: z.enum(['select', 'text']),
  order_by: z.string(),
  has_archives: z.boolean(),
  terms: z.array(WooCommerceAttributeTermSchema),
})

export type WooCommerceAttributeTerm = z.output<typeof WooCommerceAttributeTermSchema>
export type WooCommerceAttribute = z.output<typeof WooCommerceAttributeSchema>

// For form state (with UI properties)
export const AttributeStateSchema = WooCommerceAttributeSchema.extend({
  expanded: z.boolean().default(false),
})

export type AttributeState = z.output<typeof AttributeStateSchema>

export const AttributeTermStateSchema = WooCommerceAttributeTermSchema.extend({
  selected: z.boolean().default(false),
  price: z.number(),
})

export type AttributeTermState = z.output<typeof AttributeTermStateSchema>
```

**Step 2: Commit**

```bash
git add app/entities/WooCommerceAttribute.schema.ts
git commit -m "feat: add WooCommerce attribute type definitions

- Add Zod schemas for attributes and terms
- Include UI state types (expanded, selected, price)"
```

---

## Task 3: Create Composable for Fetching Attributes

**Files:**
- Create: `app/composables/useWooCommerceAttributes.ts`

**Step 1: Create the composable**

```typescript
// app/composables/useWooCommerceAttributes.ts
import type { AttributeState } from '~/entities/WooCommerceAttribute.schema'

export function useWooCommerceAttributes() {
  const attributes = ref<AttributeState[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAttributes(credentials: {
    baseUrl: string
    consumerKey: string
    consumerSecret: string
  }) {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{
        attributes: AttributeState[]
      }>('/api/woocommerce/product-attributes', {
        method: 'GET',
        query: credentials
      })

      // Add UI state
      attributes.value = response.attributes.map(attr => ({
        ...attr,
        expanded: false,
        terms: attr.terms.map(term => ({
          ...term,
          selected: false,
          price: 0 // Will be set with base price
        }))
      }))
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch attributes'
      throw e
    } finally {
      loading.value = false
    }
  }

  function toggleAttributeExpanded(id: number) {
    const attr = attributes.value.find(a => a.id === id)
    if (attr) {
      attr.expanded = !attr.expanded
    }
  }

  function toggleTermSelected(attributeId: number, termId: number) {
    const attr = attributes.value.find(a => a.id === attributeId)
    if (attr) {
      const term = attr.terms.find(t => t.id === termId)
      if (term) {
        term.selected = !term.selected
      }
    }
  }

  function toggleAllTerms(attributeId: number, selected: boolean) {
    const attr = attributes.value.find(a => a.id === attributeId)
    if (attr) {
      attr.terms.forEach(term => {
        term.selected = selected
      })
    }
  }

  function updateTermPrice(attributeId: number, termId: number, price: number) {
    const attr = attributes.value.find(a => a.id === attributeId)
    if (attr) {
      const term = attr.terms.find(t => t.id === termId)
      if (term) {
        term.price = price
      }
    }
  }

  function getSelectedTerms() {
    return attributes.value
      .filter(attr => attr.terms.some(t => t.selected))
      .map(attr => ({
        id: attr.id,
        name: attr.name,
        options: attr.terms.filter(t => t.selected).map(t => t.name)
      }))
  }

  function getTotalSelectedCount() {
    return attributes.value.reduce(
      (sum, attr) => sum + attr.terms.filter(t => t.selected).length,
      0
    )
  }

  return {
    attributes,
    loading,
    error,
    fetchAttributes,
    toggleAttributeExpanded,
    toggleTermSelected,
    toggleAllTerms,
    updateTermPrice,
    getSelectedTerms,
    getTotalSelectedCount
  }
}
```

**Step 2: Commit**

```bash
git add app/composables/useWooCommerceAttributes.ts
git commit -m "feat: add composable for WooCommerce attributes

- Add fetchAttributes function
- Add toggle functions for expanded/selected state
- Add price update and helper functions"
```

---

## Task 4: Create Accordion Component for Attributes

**Files:**
- Create: `app/components/product/AttributeAccordion.vue`
- Reference: Nuxt UI `UAccordion` component docs

**Step 1: Create the accordion component**

```vue
<template>
  <div class="space-y-4">
    <!-- Action Bar -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UBadge color="neutral" variant="subtle">
          Selected: {{ totalSelected }}
        </UBadge>
        <UButton
          v-if="totalSelected > 0"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="clearAll"
        >
          Clear All
        </UButton>
      </div>
    </div>

    <!-- Accordion -->
    <UAccordion
      :items="accordionItems"
      :default-open="defaultOpen"
      multiple
    >
      <template #default="{ item, open }">
        <UButton
          color="neutral"
          variant="ghost"
          class="w-full"
          @click="toggleAttribute(item.id)"
        >
          <template #leading>
            <UCheckbox
              :model-value="isAllSelected(item.id)"
              :indeterminate="isSomeSelected(item.id)"
              @click.stop="toggleAll(item.id, !isAllSelected(item.id))"
            />
          </template>
          <span class="flex-1 text-left">{{ item.name }}</span>
          <UBadge color="neutral" variant="subtle" size="xs">
            {{ item.terms.length }}
          </UBadge>
          <template #trailing>
            <UIcon
              :name="open ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
              class="w-4 h-4"
            />
          </template>
        </UButton>
      </template>

      <template #item="{ item }">
        <div class="p-4 space-y-2">
          <div
            v-for="term in item.terms"
            :key="term.id"
            class="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <UCheckbox
              :model-value="term.selected"
              @update:model-value="toggleTerm(item.id, term.id, $event)"
            />
            <span class="flex-1">{{ term.name }}</span>
            <UInputNumber
              :model-value="term.price"
              @update:model-value="updatePrice(item.id, term.id, $event)"
              size="sm"
              class="w-24"
            />
          </div>
        </div>
      </template>
    </UAccordion>
  </div>
</template>

<script setup lang="ts">
import type { AttributeState } from '~/entities/WooCommerceAttribute.schema'

interface Props {
  attributes: AttributeState[]
  basePrice: number | null
}

interface Emits {
  (e: 'update:attributes', value: AttributeState[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localAttributes = computed(() => props.attributes.map(attr => ({
  ...attr,
  terms: attr.terms.map(term => ({
    ...term,
    price: term.price || props.basePrice || 0
  }))
})))

const accordionItems = computed(() => localAttributes.value.map(attr => ({
  id: attr.id,
  name: attr.name,
  terms: attr.terms,
  expanded: attr.expanded
})))

const defaultOpen = computed(() =>
  localAttributes.value
    .filter(attr => attr.expanded)
    .map(attr => attr.id.toString())
)

const totalSelected = computed(() =>
  localAttributes.value.reduce(
    (sum, attr) => sum + attr.terms.filter(t => t.selected).length,
    0
  )
)

function toggleAttribute(id: number) {
  const attrs = [...localAttributes.value]
  const attr = attrs.find(a => a.id === id)
  if (attr) attr.expanded = !attr.expanded
  emit('update:attributes', attrs)
}

function isAllSelected(id: number) {
  const attr = localAttributes.value.find(a => a.id === id)
  return attr?.terms.every(t => t.selected) && attr?.terms.length > 0
}

function isSomeSelected(id: number) {
  const attr = localAttributes.value.find(a => a.id === id)
  const selected = attr?.terms.filter(t => t.selected).length || 0
  return selected > 0 && selected < attr?.terms.length
}

function toggleAll(id: number, selected: boolean) {
  const attrs = [...localAttributes.value]
  const attr = attrs.find(a => a.id === id)
  if (attr) {
    attr.terms.forEach(term => { term.selected = selected })
  }
  emit('update:attributes', attrs)
}

function toggleTerm(attributeId: number, termId: number, selected: boolean) {
  const attrs = [...localAttributes.value]
  const attr = attrs.find(a => a.id === attributeId)
  if (attr) {
    const term = attr.terms.find(t => t.id === termId)
    if (term) term.selected = selected
  }
  emit('update:attributes', attrs)
}

function updatePrice(attributeId: number, termId: number, price: number) {
  const attrs = [...localAttributes.value]
  const attr = attrs.find(a => a.id === attributeId)
  if (attr) {
    const term = attr.terms.find(t => t.id === termId)
    if (term) term.price = price
  }
  emit('update:attributes', attrs)
}

function clearAll() {
  const attrs = localAttributes.value.map(attr => ({
    ...attr,
    terms: attr.terms.map(term => ({ ...term, selected: false }))
  }))
  emit('update:attributes', attrs)
}
</script>
```

**Step 2: Commit**

```bash
git add app/components/product/AttributeAccordion.vue
git commit -m "feat: add AttributeAccordion component

- Display attributes as collapsible accordions
- Checkbox for select-all on header
- Individual checkboxes for each term
- Price input for each term (pre-filled with base price)
- Clear all action button
- Selected count badge"
```

---

## Task 5: Update Products Page - Fetch Attributes on Mount

**Files:**
- Modify: `app/pages/products.vue`

**Step 1: Add the composable import and state**

Find the script setup section and add after existing imports:

```typescript
import { useWooCommerceAttributes } from '~/composables/useWooCommerceAttributes'
```

**Step 2: Add the composable initialization**

After the `variantAttributes` ref definition (around line 54), add:

```typescript
// WooCommerce attributes (global attributes fetched from WC)
const {
  attributes: wcAttributes,
  loading: loadingAttributes,
  error: attributesError,
  fetchAttributes,
  toggleAttributeExpanded,
  toggleTermSelected,
  toggleAllTerms,
  updateTermPrice,
  getSelectedTerms
} = useWooCommerceAttributes()
```

**Step 3: Fetch attributes when variants step is accessed**

Add a watcher for `currentStep`:

```typescript
// Fetch WooCommerce attributes when entering variants step
watch(currentStep, async (newStep) => {
  if (newStep === 3 && wcAttributes.value.length === 0) {
    try {
      // Get WooCommerce credentials from environment or user settings
      const wcCredentials = {
        baseUrl: process.env.NUXT_WOOCOMMERCE_URL || '',
        consumerKey: process.env.NUXT_WOOCOMMERCE_KEY || '',
        consumerSecret: process.env.NUXT_WOOCOMMERCE_SECRET || ''
      }

      await fetchAttributes(wcCredentials)
    } catch (e) {
      toast.add({
        title: 'Failed to load attributes',
        description: 'Please check WooCommerce credentials',
        color: 'error'
      })
    }
  }
})
```

**Step 4: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: fetch WooCommerce attributes on variants step

- Add useWooCommerceAttributes composable
- Fetch attributes when user enters variants step
- Show toast error on fetch failure"
```

---

## Task 6: Update Products Page - Replace Variant UI with Accordion

**Files:**
- Modify: `app/pages/products.vue`

**Step 1: Find the variants step template section**

Search for the variants step in the template (look for `<template #item="{ item }">` with value 3, or the variants section).

**Step 2: Replace the existing variants UI with the accordion**

Replace the current variant attributes section with:

```vue
<template #item="{ item }">
  <div v-if="item.value === 3">
    <div v-if="loadingAttributes" class="flex justify-center p-8">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin" />
    </div>

    <div v-else-if="attributesError" class="p-8 text-center">
      <p class="text-gray-500 mb-4">Failed to load attributes</p>
      <UButton size="sm" @click="fetchAttributes(wcCredentials)">
        Retry
      </UButton>
    </div>

    <div v-else-if="wcAttributes.length === 0" class="p-8 text-center">
      <p class="text-gray-500">
        No product attributes found. Create attributes in WooCommerce first.
      </p>
    </div>

    <AttributeAccordion
      v-else
      :attributes="wcAttributes"
      :base-price="uploadForm.price"
      @update:attributes="wcAttributes = $event"
    />
  </div>
</template>
```

**Step 3: Add AttributeAccordion to component imports**

Add at the top of the script setup with other resolved components:

```typescript
const AttributeAccordion = resolveComponent('product/AttributeAccordion')
```

**Step 4: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: replace variant UI with AttributeAccordion

- Use new accordion component for variant selection
- Show loading, error, and empty states
- Remove old attribute grouping UI"
```

---

## Task 7: Update Product Upload to Use New Format

**Files:**
- Modify: `app/pages/products.vue`

**Step 1: Find the upload/submit function**

Look for the function that handles product upload (search for `uploadProduct` or similar API call).

**Step 2: Update the attributes payload generation**

Find where `variantAttributes` is being converted for submission and replace with:

```typescript
// Get selected attributes in WooCommerce format
const selectedAttributes = getSelectedTerms()

// Add to product payload
const productPayload = {
  // ... other fields
  attributes: selectedAttributes.map(attr => ({
    id: attr.id,
    name: attr.name,
    variation: true,
    visible: true,
    options: attr.options
  }))
}
```

**Step 3: Remove old variant processing code**

Remove any code that processes the old `variantAttributes` structure for submission.

**Step 4: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat: update product upload for new attributes format

- Use getSelectedTerms() from composable
- Transform to WooCommerce attribute format
- Remove old variant processing code"
```

---

## Task 8: Remove Deprecated API Endpoints

**Files:**
- Delete: `server/api/woocommerce/suggested-variants.post.ts`
- Delete: `server/api/woocommerce/variant-attributes.post.ts`

**Step 1: Delete deprecated endpoints**

```bash
rm server/api/woocommerce/suggested-variants.post.ts
rm server/api/woocommerce/variant-attributes.post.ts
```

**Step 2: Commit**

```bash
git add server/api/woocommerce/suggested-variants.post.ts server/api/woocommerce/variant-attributes.post.ts
git commit -m "chore: remove deprecated variant endpoints

- Remove suggested-variants endpoint (no longer needed)
- Remove variant-attributes endpoint (replaced by product-attributes)"
```

---

## Task 9: Clean Up Unused Code

**Files:**
- Modify: `app/repositories/supabase/woocommerce.ts`
- Modify: `app/pages/products.vue`

**Step 1: Remove unused repository methods**

From `woocommerce.ts`, remove these methods (no longer used):
- `getVariantsByCategory`
- `getSuggestedVariants`

**Step 2: Remove unused state and functions**

From `products.vue`, remove:
- `isFetchingVariants` ref and related code
- Any functions that processed category-based variants
- `addAttribute` and `addAttributeValue` functions (if present)

**Step 3: Commit**

```bash
git add app/repositories/supabase/woocommerce.ts app/pages/products.vue
git commit -m "chore: remove unused category-based variant code

- Remove getVariantsByCategory and getSuggestedVariants methods
- Remove isFetchingVariants state
- Remove manual addAttribute/addAttributeValue functions"
```

---

## Task 10: Type Check and Test

**Step 1: Run typecheck**

```bash
npx nuxt typecheck
```

Expected: No errors

**Step 2: Start dev server**

```bash
bun run dev
```

**Step 3: Manual test checklist**

1. Navigate to `http://localhost:3000/products`
2. Login and click "Create Product"
3. Fill in content step, click Next
4. Upload images, click Next
5. Select categories and set price, click Next
6. **Verify variants step:**
   - Attributes load from WooCommerce
   - Accordions display correctly
   - Expand/collapse works
   - Select-all checkbox works
   - Individual term checkboxes work
   - Price inputs are pre-filled with base price
   - Selected count updates
   - Clear all button works

**Step 4: Commit with completion**

```bash
git add .
git commit -m "feat: complete WooCommerce attributes accordion implementation

- All tasks complete
- Typecheck passing
- Manual testing verified"
```

---

## Post-Implementation

1. **Update documentation:** Update any relevant docs in `docs/` directory
2. **Create PR:** Push to remote and create pull request
3. **Test in staging:** Deploy to staging environment and test with real WooCommerce instance

---

**Total estimated implementation time:** 2-3 hours
**Number of commits:** 10
**Files created:** 4
**Files modified:** 3
**Files deleted:** 2
