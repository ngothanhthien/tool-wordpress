# Category Integration for Products - Design Document

**Date:** 2025-02-03
**Status:** Approved

## Overview

Add category support to products, allowing products to be optionally associated with categories synced from WooCommerce. Categories will be displayed in the products table and filterable.

## Architecture

### Data Model

**Schema Changes to `Product.schema.ts`:**
```typescript
category_id: z.string().nullable().default(null)
```

- References `categories.id` (string/WooCommerce category ID)
- Optional field (`nullable()`)
- Products can exist without a category

**Supabase Migration:**
```sql
ALTER TABLE products
ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL;
```

### New Type: ProductWithCategory

```typescript
export const productWithCategorySchema = productSchema.extend({
  category: categorySchema.nullable().default(null),
})

export type ProductWithCategory = z.output<typeof productWithCategorySchema>
```

## Backend Changes

### ProductRepository

New method with category join:

```typescript
async findAllWithCategory(options?: {
  status?: Product['status'] | null
  categoryId?: string | null
}): Promise<ProductWithCategory[]>
```

**SQL Logic:**
- Uses Supabase select with join: `.select('*, category:categories(*)')`
- Filters by status if provided
- Filters by category_id:
  - `null` → uncategorized products only
  - specific value → products in that category

## UI Changes

### Products Page (`app/pages/products.vue`)

**New Table Column:**
- Header: "Category"
- Cell: Displays category name or "Uncategorized"
- Uses `category.name` from joined data

**Category Filter:**
- `USelect` dropdown next to status filter
- Options: "All Categories", "Uncategorized", plus list of categories
- Reactive: updates table when changed

**Upload Modal Enhancement:**
- Add category selector in Step 1 (Content)
- `USelect` component with optional selection
- Pre-populate with existing `category_id` when editing

## Data Flow

```
User loads products page
  ↓
ProductRepository.findAllWithCategory()
  ↓
Supabase: SELECT *, category:categories(*) FROM products
  ↓
Returns ProductWithCategory[] with nested category objects
  ↓
Table displays category names from joined data
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| Category not found | Show category ID with warning icon, allow reassignment |
| Category deleted | Database: `ON DELETE SET NULL` handles automatically |
| Invalid category_id | Schema: `nullable().default(null)` ensures clean state |
| Sync failures | Log error, don't block upload, save with `category_id: null` |

## Testing

### Integration Tests
- Create product with category → verify saved
- Update product category → verify change persists
- Delete referenced category → verify product set to null

### E2E Tests (Playwright)
- Products table displays category names
- Category filter shows only matching products
- "Uncategorized" filter works
- Upload modal category selector works

### Manual Checklist
- [ ] Products table shows category names
- [ ] Category filter dropdown populated
- [ ] "Uncategorized" filter works
- [ ] Upload modal has category selector
- [ ] Can save product with/without category
- [ ] Deleted categories nullify product references

## Implementation Files

1. `app/entities/Product.schema.ts` - Add `category_id` field
2. `app/repositories/supabase/product.ts` - Add `findAllWithCategory()` method
3. `app/pages/products.vue` - Add category column and filter
4. `server/api/products/upload.ts` - Handle `category_id` in upload
5. Supabase migration for `category_id` column
