# Main Keyword Field Design

> **For Claude:** Implementation plan for adding `main_keyword` field to products entity

**Goal:** Add `main_keyword` text field to products table for WooCommerce Yoast SEO focus keyword mapping.

**Created:** 2026-02-07

---

## Overview

The `main_keyword` field stores a single SEO focus keyword that maps to WooCommerce's `_yoast_wpseo_focuskw` meta data. Example: `"ao thun cotton"` for a T-shirt product.

**Use Case:**
```json
{
  "name": "Ao thun ABC",
  "type": "simple",
  "regular_price": "199000",
  "meta_data": [
    { "key": "_yoast_wpseo_focuskw", "value": "ao thun cotton" }
  ]
}
```

---

## Architecture

### Components

1. **Database Migration** - Add `main_keyword` column via Supabase MCP
2. **Entity Schema** - Update `Product.schema.ts` to include the field
3. **Type Generation** - Regenerate `database.types.ts` from Supabase
4. **Form Schema** - Add `main_keyword` to `productContentFormSchema` for validation
5. **API Endpoints** - Update product creation/update endpoints to handle the field
6. **Frontend UI** - Add input field in products page for main_keyword

---

## Database Schema

### Migration

```sql
ALTER TABLE products
ADD COLUMN main_keyword text;
```

### Column Definition

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `main_keyword` | `text` | Yes | `NULL` | Primary SEO focus keyword for WooCommerce Yoast (`_yoast_wpseo_focuskw`) |

---

## Zod Schema Updates

### Product Schema (`app/entities/Product.schema.ts`)

```typescript
export const productSchema = z.object({
  // ... existing fields ...
  keywords: z.array(z.string()).default([]),
  main_keyword: z.string().nullable().default(null), // NEW
  short_description: z.string().min(1, 'Short description is required'),
  // ... rest of fields ...
})
```

### Form Schema (`app/entities/Product.schema.ts`)

```typescript
export const productContentFormSchema = z.object({
  // ... existing fields ...
  keywords: z.array(z.string()).min(1).max(15),
  main_keyword: z.string().max(100, 'Main keyword max 100 chars').nullable(), // NEW
  short_description: z.string().min(50).max(500),
  // ... rest of fields ...
})
```

### Type Exports

```typescript
export type Product = z.output<typeof productSchema>
export type ProductInsert = z.input<typeof productSchema>
export type ProductUpdate = Partial<ProductInsert>
export type ProductContentForm = z.output<typeof productContentFormSchema>
```

---

## Implementation Steps

### Step 1: Database Migration

Use Supabase MCP `apply_migration` tool:

```typescript
{
  name: "add_main_keyword_to_products",
  query: "ALTER TABLE products ADD COLUMN main_keyword text;"
}
```

### Step 2: Generate Types

Run type generation to update `app/types/database.types.ts`:

```bash
bun run gen:types
```

### Step 3: Update Entity Schema

Modify `app/entities/Product.schema.ts`:
- Add `main_keyword: z.string().nullable().default(null)` to `productSchema`
- Add `main_keyword: z.string().max(100).nullable()` to `productContentFormSchema`
- Export types remain the same (auto-generated from schema)

### Step 4: Find Usage Points

Search for files that create/update products:
- `app/pages/products.vue` - Product upload form
- `server/api/products/*.ts` - Product API endpoints
- Any repository methods that insert/update products

### Step 5: Update Forms & UI

Add `main_keyword` input field where products are created/edited:
- Products page upload form
- Any edit modals or forms

### Step 6: Typecheck & Verify

```bash
npx nuxt typecheck
```

---

## Files to Modify

1. `app/entities/Product.schema.ts` - Add main_keyword to schemas
2. `app/pages/products.vue` - Add main_keyword input to upload form
3. `app/types/database.types.ts` - Auto-generated (via `bun run gen:types`)
4. Any API endpoints in `server/api/products/` that handle product data

---

## Notes

- `main_keyword` is intentionally **nullable** - existing products will have NULL
- `main_keyword` is separate from `keywords` array - it's a single primary focus keyword
- The field maps to WooCommerce `_yoast_wpseo_focuskw` meta data for SEO
- Max length 100 characters (typical SEO keyword length)
