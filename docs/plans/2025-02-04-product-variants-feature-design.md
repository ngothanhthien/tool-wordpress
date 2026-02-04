# Product Variants Feature Design

**Date:** 2025-02-04
**Status:** Design Complete
**Author:** Claude Code

## Overview

Add product variant support to the WooCommerce upload flow, allowing users to fetch suggested variants from existing products and customize them before uploading as a variable product.

## Requirements

1. Add new "Variants" tab after "Categories" in the upload stepper
2. Fetch variants from WooCommerce based on selected categories (3 latest products per category)
3. Allow users to add, edit, and delete variants
4. Upload as WooCommerce variable product with custom attributes
5. Handle cases where no variants are found (allow manual creation)

## Architecture

### Components

| Layer | Component | Description |
|-------|-----------|-------------|
| Frontend | `products.vue` | Add variants step, state management, UI |
| API | `server/api/woocommerce/suggested-variants.post.ts` | Fetch variants from WooCommerce |
| Repository | `woocommerce.ts` | `getSuggestedVariants()` method |
| Repository | `woocommerce.ts` | Updated `uploadProduct()` for variable products |

### Data Flow

```
User selects categories → clicks Continue
  ↓
Frontend calls /api/woocommerce/suggested-variants
  ↓
Backend: For each category, fetch 3 latest variable products
  ↓
Backend: Extract variations, merge, deduplicate
  ↓
Return { variants: [{ name, price }] }
  ↓
Frontend: Show Variants tab with pre-filled list
  ↓
User adds/removes/edits variants
  ↓
Submit: Create variable product + batch create variations
```

## UI Design

### Stepper Items

```typescript
const stepperItems = [
  { title: 'Content', description: 'Edit product content', icon: 'i-heroicons-document-text', value: 0 },
  { title: 'Media', description: 'Select product images', icon: 'i-heroicons-photo', value: 1 },
  { title: 'Categories & Price', description: 'Select categories and set price', icon: 'i-heroicons-tag', value: 2 },
  { title: 'Variants', description: 'Configure product variants', icon: 'i-heroicons-swatch', value: 3 },  // NEW
]
```

### Variants Tab Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Variants                              [Add Variant] │
├─────────────────────────────────────────────────────────────┤
│  Loading... / Suggested variants from WooCommerce          │
│                                                              │
│  Variant Name           │ Price (VND)      │ Actions        │
│  ───────────────────────────────────────────────────────────│
│  Red                    │ 500,000         │ [Delete]       │
│  Blue                   │ 500,000         │ [Delete]       │
│  Size M                 │ 500,000         │ [Delete]       │
│  Size L                 │ 500,000         │ [Delete]       │
│                                                              │
│  Total variants: 4                                           │
└─────────────────────────────────────────────────────────────┘
```

### State Management (in products.vue)

```typescript
// Add to uploadForm
const variants = ref<Array<{ id: string; name: string; price: number }>>([])
const isFetchingVariants = ref(false)
```

## API Implementation

### New Endpoint: `POST /api/woocommerce/suggested-variants`

**File:** `server/api/woocommerce/suggested-variants.post.ts`

```typescript
interface SuggestedVariantsRequest {
  categoryIds: number[]
}

interface SuggestedVariantsResponse {
  variants: Array<{
    name: string
    price: number
  }>
}
```

**Logic:**
1. Validate categoryIds array (1-10 categories)
2. For each category ID:
   - Fetch 3 latest variable products
   - Fetch variations for each product
3. Collect all attributes from variations
4. Deduplicate by attribute option value
5. Use regular_price from first occurrence
6. Return sorted array

### Repository Method

**File:** `app/repositories/supabase/woocommerce.ts`

```typescript
async getSuggestedVariants(categoryIds: number[]): Promise<Array<{ name: string; price: number }>> {
  const allVariants: Array<{ name: string; price: number }> = []

  for (const categoryId of categoryIds) {
    const products = await this.listProducts({
      category: categoryId,
      type: 'variable',
      orderBy: 'date',
      order: 'desc',
      perPage: 3,
    })

    for (const product of products) {
      const variations = await this.listProductVariations(product.id, { perPage: 100 })
      for (const variation of variations) {
        for (const attr of variation.attributes) {
          if (attr.option && attr.option !== '') {
            allVariants.push({
              name: attr.option,
              price: Number.parseFloat(variation.regular_price) || 0
            })
          }
        }
      }
    }
  }

  // Deduplicate by name
  const unique = new Map()
  for (const v of allVariants) {
    if (!unique.has(v.name)) {
      unique.set(v.name, v)
    }
  }

  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name))
}
```

## Upload Flow for Variable Products

### Updated Request Body

**File:** `server/api/products/upload.post.ts`

```typescript
{
  productId: string
  seo_title: string
  meta_description: string
  short_description: string
  html_content: string
  keywords: string[]
  images: string[]
  price: number | null
  categories: Category[]
  variants?: Array<{ name: string; price: number }>  // NEW
}
```

### Modified uploadProduct() Method

**File:** `app/repositories/supabase/woocommerce.ts`

```typescript
async uploadProduct(
  product: Product,
  categories?: Array<{ id: string; name: string; slug: string }>,
  variants?: Array<{ name: string; price: number }>
): Promise<{ wooCommerceId: number; previewUrl: string }> {
  const config = this.getConfig()
  const hasVariants = variants && variants.length > 0
  const productType = hasVariants ? 'variable' : 'simple'

  // Create parent product
  const payload = {
    name: product.seo_title,
    type: productType,
    status: 'publish',
    description: product.html_content,
    short_description: product.short_description,
    regular_price: hasVariants ? '' : String(product.price || ''),
    images: product.images.map((src, index) => ({ src, alt: this.generateImageAlt(product.seo_title), position: index })),
    categories: categories?.map(cat => ({ id: Number.parseInt(cat.id, 10) })) || [],
    meta_data: [
      { key: '_yoast_wpseo_metadesc', value: product.meta_description },
      { key: '_yoast_wpseo_focuskw', value: product.keywords.join(', ') },
    ],
  }

  if (hasVariants) {
    // Add attributes for variable product
    payload.attributes = [{
      name: 'Variant',
      variation: true,
      visible: true,
      options: variants.map(v => v.name)
    }]
  }

  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64')
  const endpoint = new URL('/wp-json/wc/v3/products', config.url).href

  const response = await $fetch<WooCommerceProductResponse>(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: payload,
  })

  // Create variations if variable product
  if (hasVariants) {
    const variationsPayload = {
      create: variants.map(v => ({
        regular_price: String(v.price),
        attributes: [{
          name: 'Variant',
          option: v.name
        }]
      }))
    }

    const variationsEndpoint = new URL(`/wp-json/wc/v3/products/${response.id}/variations/batch`, config.url).href
    await $fetch(variationsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: variationsPayload,
    })
  }

  return {
    wooCommerceId: response.id,
    previewUrl: response.permalink,
  }
}
```

## Error Handling

### Frontend Error States

| Scenario | Behavior |
|----------|----------|
| Variant fetch fails | Show warning toast, proceed to variants tab with empty list |
| Empty variant name | Show inline error, prevent Next |
| Invalid price (≤0 or NaN) | Show inline error, prevent Next |
| No variants on submit | Show error "At least 1 variant required" |
| Duplicate variant name | Prevent adding, show error |

### Backend Error Handling

```typescript
// suggested-variants.post.ts
if (!categoryIds || categoryIds.length === 0) {
  throw createError({ statusCode: 400, message: 'At least one category is required' })
}

if (categoryIds.length > 10) {
  throw createError({ statusCode: 400, message: 'Maximum 10 categories allowed' })
}

// WooCommerce errors return empty array instead of throwing
catch (error) {
  console.error('WooCommerce API error:', error)
  return { variants: [] }  // Allow manual entry
}
```

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| No categories selected | Disable Continue button |
| Categories have no variable products | Return empty array, show empty state |
| User deletes all variants | Show warning "Add at least 1 variant" |
| Duplicate variant names | Prevent adding |
| Long variant names | Truncate in UI, store full value |
| Special characters | Preserve as-is |

## Validation Rules

1. **At least 1 variant required** when uploading (if variants tab was shown)
2. **Variant name**: Required, non-empty string
3. **Variant price**: Required, positive number
4. **Duplicate names**: Not allowed
5. **Categories**: At least 1 required to fetch variants

## Database Changes

**No database changes required.** Variants are stored in WooCommerce only, not in Supabase.

The `products` table already has all needed fields:
- `price` - base price (used if no variants)
- `raw_categories` - category references

## Testing Checklist

### Variant Fetching
- [ ] Select 1 category → fetches variants correctly
- [ ] Select multiple categories → merges and deduplicates
- [ ] Categories with no variable products → shows empty state
- [ ] Network error → shows warning, allows manual entry

### Variant Management
- [ ] Add new variant → appears with base price prefilled
- [ ] Delete variant → removes from list
- [ ] Edit variant name/price → updates correctly
- [ ] Submit with no variants → validation error
- [ ] Duplicate variant name → prevented

### Upload to WooCommerce
- [ ] Upload with variants → variable product created
- [ ] Check WooCommerce admin → correct variations exist
- [ ] Each variation has correct price and attribute
- [ ] Upload without variants → simple product (existing flow)

### Edge Cases
- [ ] Very long variant names → handled correctly
- [ ] Special characters in names → preserved
- [ ] Large price values → formatted correctly

## User Interaction Flow

1. User opens upload modal for a draft product
2. Edits content (Step 0)
3. Selects images (Step 1)
4. Selects categories and sets base price (Step 2)
5. Clicks "Continue" → fetches variants from WooCommerce
6. Variants tab shows suggested variants with prices
7. User can:
   - Accept suggested variants as-is
   - Add new variants (price prefilled with base price)
   - Delete unwanted variants
   - Edit variant names and prices
8. Clicks "Submit Upload"
9. System creates variable product in WooCommerce with all variations
10. Success toast, modal closes, products table refreshes

## References

- [WooCommerce REST API - Product Variations](https://github.com/woocommerce/woocommerce-rest-api-docs/blob/master/source/includes/wp-api-v3/_product-variations.md)
- [StackOverflow: Create product with variations via API](https://stackoverflow.com/questions/37823867/woocommerce-api-create-new-product-with-variations)
- [Florian Brinkmann: Creating variations via REST API](https://florianbrinkmann.com/en/creating-a-woocommerce-product-variation-rest-api-4526/)
