# Product-Category Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add category support to products, allowing products to be optionally associated with categories synced from WooCommerce, with display and filtering in the products table.

**Architecture:** Products reference categories via optional `category_id` foreign key; product fetching uses Supabase join to include nested category data; UI displays category names and filters by category.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, Supabase (PostgreSQL), Zod v4, Nuxt UI v4

---

## Task 1: Add category_id Field to Product Schema

**Files:**
- Modify: `app/entities/Product.schema.ts`

**Step 1: Add category_id field to productSchema**

Add this line after line 28 (after `woo_id` field):

```typescript
category_id: z.string().nullable().default(null),
```

The complete field should look like:

```typescript
woo_id: z.number().int().nonnegative().nullable().default(null),
category_id: z.string().nullable().default(null),
made_by_process_id: z.uuid().nullable().default(null),
```

**Step 2: Run typecheck to verify**

Run: `npx nuxt typecheck`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add app/entities/Product.schema.ts
git commit -m "feat(product): add category_id field to schema"
```

---

## Task 2: Create ProductWithCategory Schema and Type

**Files:**
- Modify: `app/entities/Product.schema.ts`

**Step 1: Add import for categorySchema**

Add at top of file after line 1:

```typescript
import { categorySchema } from './Category.schema'
```

**Step 2: Create ProductWithCategory schema**

Add after the `productContentFormSchema` definition (after line 69):

```typescript
/**
 * Schema for product with joined category data
 */
export const productWithCategorySchema = productSchema.extend({
  category: categorySchema.nullable().default(null),
})

export type ProductWithCategory = z.output<typeof productWithCategorySchema>
```

**Step 3: Run typecheck to verify**

Run: `npx nuxt typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add app/entities/Product.schema.ts
git commit -m "feat(product): add ProductWithCategory schema"
```

---

## Task 3: Add findAllWithCategory Method to ProductRepository

**Files:**
- Modify: `app/repositories/supabase/product.ts`

**Step 1: Update import to include ProductWithCategory**

Replace line 2 with:

```typescript
import type { Product, ProductInsert, ProductUpdate, ProductWithCategory } from '~/entities/Product.schema'
```

**Step 2: Add category to ProductListOptions interface**

Replace lines 4-6 with:

```typescript
export interface ProductListOptions {
  status?: 'draft' | 'processing' | 'success' | 'failed' | null
  categoryId?: string | null
}
```

**Step 3: Add findAllWithCategory method**

Add after the `findAll` method (after line 31):

```typescript
async findAllWithCategory(options: ProductListOptions = {}): Promise<ProductWithCategory[]> {
  let query = this.supabase
    .from('products')
    .select('*, category:categories(*)')
    .order('created_at', { ascending: false })

  if (options.status) {
    query = query.eq('status', options.status)
  }

  if (options.categoryId === null) {
    // Filter for uncategorized products only
    query = query.is('category_id', null)
  } else if (options.categoryId) {
    // Filter for specific category
    query = query.eq('category_id', options.categoryId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch products with category: ${error.message}`)
  }

  return data as ProductWithCategory[]
}
```

**Step 4: Run typecheck to verify**

Run: `npx nuxt typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add app/repositories/supabase/product.ts
git commit -m "feat(product): add findAllWithCategory with join"
```

---

## Task 4: Create Supabase Migration for category_id Column

**Files:**
- Create: Supabase migration (via MCP)

**Step 1: Apply migration via Supabase MCP**

Use Supabase MCP `apply_migration` tool with:

Name: `add_category_id_to_products`

Query:
```sql
ALTER TABLE products
ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL;
```

**Step 2: Verify migration applied**

Check that migration was created successfully.

**Step 3: Regenerate TypeScript types**

Run: `bun run gen:types`

Expected: Type generation completes without errors

**Step 4: Commit**

```bash
git add app/types/database.types.ts
git commit -m "chore(db): add category_id column to products table"
```

---

## Task 5: Update Products Page - Import Changes

**Files:**
- Modify: `app/pages/products.vue`

**Step 1: Update imports**

Replace lines 1-2 with:

```typescript
import type { ProductWithCategory } from '~/entities/Product.schema'
import type { Category } from '~/entities/Category.schema'
```

Replace line 6 with:

```typescript
import { ProductRepository } from '~/repositories/supabase/product'
import { CategoryRepository } from '~/repositories/supabase/category'
```

**Step 2: Add category filter state**

Add after line 20:

```typescript
const categoryFilter = ref<string | null>(null)
const categories = ref<Category[]>([])
```

**Step 3: Fetch categories on mount**

Add after the `useAsyncData` call (after line 195):

```typescript
// Fetch categories for filter
const { data: categoriesData, error: categoriesError } = await useAsyncData(
  'categories',
  async () => {
    const categoryRepo = new CategoryRepository(supabase)
    return categoryRepo.findAll()
  },
)

// Handle categories error
watchEffect(() => {
  if (categoriesError.value) {
    console.error('Error fetching categories:', categoriesError.value)
    toast.add({
      title: 'Warning',
      description: 'Failed to load categories',
      color: 'warning',
    })
  }
})

// Set categories ref
if (categoriesData.value) {
  categories.value = categoriesData.value
}
```

**Step 4: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat(products): add category imports and state"
```

---

## Task 6: Update Products Page - Change to findAllWithCategory

**Files:**
- Modify: `app/pages/products.vue`

**Step 1: Update data fetching to use findAllWithCategory**

Replace lines 179-195 with:

```typescript
// Use useAsyncData for data fetching with reactive dependencies
const { data, pending, error, refresh } = await useAsyncData(
  'products',
  async () => {
    const repo = new ProductRepository(supabase)
    const result = await repo.findAllWithCategory({
      status: statusFilter.value,
      categoryId: categoryFilter.value,
    })

    return {
      products: result,
      total: result.length,
    }
  },
  {
    watch: [statusFilter, categoryFilter],
  },
)
```

**Step 2: Update columns type**

Replace line 71 with:

```typescript
const columns: TableColumn<ProductWithCategory>[] = [
```

**Step 3: Update selectedProduct type**

Replace line 22 with:

```typescript
const selectedProduct = ref<ProductWithCategory | null>(null)
```

**Step 4: Update openUploadModal function type**

Replace line 219 with:

```typescript
function openUploadModal(product: ProductWithCategory) {
```

**Step 5: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat(products): use findAllWithCategory for data fetching"
```

---

## Task 7: Add Category Column to Products Table

**Files:**
- Modify: `app/pages/products.vue`

**Step 1: Add category column to table**

Insert this column definition after the `status` column (after line 101, before the `images` column):

```typescript
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const category = (row.original as ProductWithCategory).category
      if (!category) {
        return h('span', { class: 'text-muted text-sm' }, 'Uncategorized')
      }
      return h('span', { class: 'text-sm' }, category.name)
    },
  },
```

**Step 2: Verify in browser**

Run: `bun run dev`
Expected: Products table shows "Category" column with category names or "Uncategorized"

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat(products): add category column to table"
```

---

## Task 8: Add Category Filter Dropdown

**Files:**
- Modify: `app/pages/products.vue`

**Step 1: Add category filter dropdown to template**

Replace the filter section (lines 324-340) with:

```vue
    <!-- Header & Filter -->
    <div class="w-full max-w-6xl flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">Products</h1>
      <div class="flex items-center gap-2">
        <USelect
          v-model="categoryFilter"
          :items="[
            { label: 'All Categories', value: undefined },
            { label: 'Uncategorized', value: null },
            ...categories.map(c => ({ label: c.name, value: c.id })),
          ]"
          placeholder="Filter by category"
          class="w-48"
          value-key="value"
        />
        <USelect
          v-model="statusFilter"
          :items="[
            { label: 'All', value: null },
            { label: 'Draft', value: ProductStatus.DRAFT },
            { label: 'Processing', value: ProductStatus.PROCESSING },
            { label: 'Success', value: ProductStatus.SUCCESS },
            { label: 'Failed', value: ProductStatus.FAILED },
          ]"
          placeholder="Filter by status"
          class="w-48"
          value-key="value"
        />
      </div>
    </div>
```

**Step 2: Verify in browser**

Run: `bun run dev`
Expected: Category filter dropdown appears and filters table when changed

**Step 3: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat(products): add category filter dropdown"
```

---

## Task 9: Add Category Selector to Upload Modal

**Files:**
- Modify: `app/pages/products.vue`

**Step 1: Add categoryId to uploadForm**

Add to uploadForm reactive object (after line 60, add `categoryId` field):

```typescript
const uploadForm = reactive({
  seo_title: '',
  meta_description: '',
  short_description: '',
  html_content: '',
  keywords: [] as string[],
  images: [] as string[],
  uploadImages: [] as boolean[],
  imageLoaded: [] as boolean[],
  price: null as number | null,
  categoryId: null as string | null,
})
```

**Step 2: Populate categoryId in openUploadModal**

Add to `openUploadModal` function (after line 229, add):

```typescript
  uploadForm.price = product.price
  uploadForm.categoryId = product.category_id
  currentStep.value = 0
```

**Step 3: Add category selector to Step 1 in template**

Add in Step 1 section (after line 396, before `</div>` of Step 1):

```vue
            <!-- Category -->
            <UFormField label="Category">
              <USelect
                v-model="uploadForm.categoryId"
                :items="[
                  { label: 'No category', value: null },
                  ...categories.map(c => ({ label: c.name, value: c.id })),
                ]"
                placeholder="Select a category"
                class="w-full"
                value-key="value"
              />
            </UFormField>
```

**Step 4: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat(products): add category selector to upload modal"
```

---

## Task 10: Update Upload API to Handle category_id

**Files:**
- Modify: `server/api/products/upload.post.ts`

**Step 1: Add category_id to destructured body**

Replace line 11 with:

```typescript
  const { productId, seo_title, meta_description, short_description, html_content, keywords, images, price, category_id } = body
```

**Step 2: Include category_id in product update**

Replace lines 35-48 with:

```typescript
    // Update product with new data first
    const updatedProduct = await productRepo.update(productId, {
      seo_title,
      meta_description,
      short_description,
      html_content,
      keywords: keywords || [],
      images: images || [],
      price: price || null,
      category_id: category_id || null,
      status: ProductStatus.PROCESSING,
      process_at: new Date().toISOString(),
      error_message: null,
      finished_at: null,
      has_confirmed: true,
    })
```

**Step 3: Commit**

```bash
git add server/api/products/upload.post.ts
git commit -m "feat(api): handle category_id in product upload"
```

---

## Task 11: Pass category_id from Frontend Upload

**Files:**
- Modify: `app/pages/products.vue`

**Step 1: Add category_id to API call**

Update the `submitUpload` function's fetch call (replace lines 286-298):

```typescript
    await $fetch('/api/products/upload', {
      method: 'POST',
      body: {
        productId: selectedProduct.value.id,
        seo_title: uploadForm.seo_title,
        meta_description: uploadForm.meta_description,
        short_description: uploadForm.short_description,
        html_content: uploadForm.html_content,
        keywords: uploadForm.keywords,
        images: imagesToUpload,
        price: uploadForm.price,
        category_id: uploadForm.categoryId,
      },
    })
```

**Step 2: Reset categoryId in closeUploadModal**

Add to `closeUploadModal` function (after line 238, add):

```typescript
  currentStep.value = 0
  uploadForm.categoryId = null
```

**Step 3: Verify full flow in browser**

Run: `bun run dev`
Test:
1. Open upload modal for a product
2. Select a category
3. Submit upload
4. Verify product shows with selected category

**Step 4: Commit**

```bash
git add app/pages/products.vue
git commit -m "feat(products): pass category_id in upload submit"
```

---

## Task 12: Final Testing and Type Check

**Files:** Multiple

**Step 1: Run TypeScript type check**

Run: `npx nuxt typecheck`
Expected: PASS (no type errors)

**Step 2: Manual testing checklist**

Run: `bun run dev`

Test each item:
- [ ] Products table shows category names in Category column
- [ ] Products without category show "Uncategorized"
- [ ] Category filter dropdown is populated with categories
- [ ] "All Categories" filter shows all products
- [ ] "Uncategorized" filter shows only products without category
- [ ] Selecting a category shows only products in that category
- [ ] Upload modal has category selector in Step 1
- [ ] Category selector shows "No category" and all categories
- [ ] Can save product without category (null)
- [ ] Can save product with a category
- [ ] After upload, product displays selected category

**Step 3: Run database migration verification**

Verify the `category_id` column exists and foreign key is set:

```sql
-- In Supabase SQL Editor
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name = 'category_id';
```

Expected: Shows `category_id` with `text` type, nullable, with foreign key to `categories(id)`

**Step 4: Final commit**

```bash
git add .
git commit -m "test(product): verify category integration complete"
```

---

## Summary

This plan implements category support for products in 12 bite-sized tasks:

1. **Schema changes** - Add `category_id` to Product schema, create ProductWithCategory type
2. **Repository** - Add `findAllWithCategory` with Supabase join
3. **Database** - Migration for `category_id` column with foreign key
4. **UI Display** - Category column in products table
5. **UI Filter** - Category dropdown filter
6. **UI Upload** - Category selector in upload modal
7. **API** - Handle `category_id` in upload endpoint

Each task includes exact code, commands, expected outputs, and commit messages.
