# Product Brand Sync Feature Design

**Date:** 2026-02-07
**Status:** Draft
**Author:** Claude (Assistant)

## 1. Overview
Implement a feature to sync product brands from WooCommerce to Supabase. This will allow the application to maintain a local cache of brand data for filtering and display purposes. The sync will be manually triggered via a button in the UI.

## 2. Architecture

### Components
- **Frontend**: `app/pages/brands.vue` - New page with brands list and sync button
- **API**: `server/api/sync/woocommerce/brands.post.ts` - Sync endpoint
- **Repository**: `app/repositories/supabase/brand.ts` - Supabase data access
- **Integration**: `app/repositories/supabase/woocommerce.ts` - WooCommerce API client extension
- **Database**: `product_brands` table in Supabase

### Data Flow
1. User clicks "Start Sync" on Brands page
2. Frontend calls `POST /api/sync/woocommerce/brands`
3. API uses `WooCommerceRepository` to fetch brand terms (attribute ID=1)
4. API transforms data to match `Brand` schema
5. API uses `BrandRepository` to upsert data to `product_brands` table
6. API returns sync stats (count, timestamp)
7. Frontend updates UI with new data

## 3. Database Schema

### Table: `product_brands`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PRIMARY KEY | WooCommerce term ID as string |
| `name` | text | NOT NULL | Brand display name |
| `slug` | text | UNIQUE, NOT NULL | URL-friendly slug |
| `updated_at` | timestamp | NOT NULL | Last sync timestamp |
| `created_at` | timestamp | NOT NULL | Record creation timestamp |

**Indexes:**
- `product_brands_slug_idx` on `slug`
- `product_brands_name_idx` on `name`

### Zod Schema (`app/entities/Brand.schema.ts`)
```typescript
import { z } from 'zod'

export const brandSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  updated_at: z.string(),
  created_at: z.string(),
})

export type Brand = z.output<typeof brandSchema>
export type BrandInsert = z.input<typeof brandSchema>
```

## 4. API Integration

### WooCommerce API
- **Endpoint**: `GET /wp-json/wc/v3/products/attributes/1/terms`
- **Authentication**: Basic Auth (Consumer Key/Secret)
- **Parameters**: `per_page=100`, `hide_empty=false`

**Note**: We are fetching terms for attribute ID 1 (Brand) as discovered during research. If this ID changes, the integration will need configuration update.

### Supabase API
- Use Service Role Key for upsert operations to bypass RLS during sync
- Use Standard Client for frontend read operations

## 5. Implementation Steps

1. **Database Setup**
   - Create migration for `product_brands` table
   - Update `database.types.ts`

2. **Backend Implementation**
   - Create `Brand.schema.ts`
   - Create `BrandRepository`
   - Update `WooCommerceRepository` with `listBrands()` method
   - Create sync endpoint `server/api/sync/woocommerce/brands.post.ts`

3. **Frontend Implementation**
   - Create `app/pages/brands.vue`
   - Implement list view with `UTable`
   - Implement sync button with loading state
   - Add toast notifications for success/error

4. **Testing**
   - Verify sync pulls correct data from WooCommerce
   - Verify data is stored correctly in Supabase
   - Test empty states and error handling

## 6. Open Questions / Risks
- **Attribute ID Stability**: Currently hardcoded to ID=1. Should we make this configurable? (Risk: Low, IDs rarely change)
- **Rate Limiting**: Large brand lists might hit API limits. (Mitigation: Implement pagination and delays if needed)
