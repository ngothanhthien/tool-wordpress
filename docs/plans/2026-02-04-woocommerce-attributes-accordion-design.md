# WooCommerce Product Attributes Accordion Design

**Date:** 2026-02-04
**Status:** Approved
**Author:** Claude (via brainstorming session)

## Overview

Redesign the variant selection step in the product upload form to use WooCommerce global product attributes fetched from `/wp-json/wc/v3/products/attributes` instead of fetching from category-based products. Display attributes as selectable accordions with term values.

## Architecture

### Data Flow

1. **On component mount** (when Variants step is accessed):
   - Fetch all global product attributes from `GET /wp-json/wc/v3/products/attributes`
   - Fetch all terms for each attribute from `GET /wp-json/wc/v3/products/attributes/{id}/terms`
   - All requests made in parallel upfront

2. **Combine data** into structure:
```typescript
interface Attribute {
  id: number
  name: string
  slug: string
  type: 'select' | 'text'
  hasArchives: boolean
  expanded: boolean
  terms: AttributeTerm[]
}

interface AttributeTerm {
  id: number
  name: string
  slug: string
  count: number
  selected: boolean
  price: number
}
```

3. **Pre-fill prices** with product's base price (from Step 3)

### API Changes

**New endpoint:** `GET /server/api/woocommerce/product-attributes`

**Deprecate:**
- `POST /server/api/woocommerce/suggested-variants`
- `POST /server/api/woocommerce/variant-attributes`

## UI Components

### Accordion Structure

```
┌─────────────────────────────────────────────┐
│ ☐ Color (12 terms)                      [▼] │
├─────────────────────────────────────────────┤
│ ☐ Red        $___                           │
│ ☐ Blue       $___                           │
│ ☐ Green      $___                           │
└─────────────────────────────────────────────┘
```

### Nuxt UI Components
- `UAccordion` - Main container
- `UCheckbox` - Term selection + select-all
- `UInputNumber` - Price inputs
- `UBadge` - Term count
- `UButton` - Actions
- `UIcon` - Chevron

### Action Bar
- "Add Custom Term" button
- "Clear All Selections" button
- "Selected: 0 terms" counter

### Features
- Expand/collapse state persists
- Select-all checkbox (indeterminate when partial)
- Search/filter for large lists
- Load more pagination (>100 terms)

## Error Handling

| Scenario | Handling |
|----------|----------|
| No attributes | Empty state with link to WooCommerce |
| Attribute has no terms | Empty state with "Add Custom Term" option |
| API failure | Toast with retry button, allow continuing |
| Partial failure | Warning badge, per-accordion retry |
| No selections | Validation warning before submit |
| Duplicate custom term | Case-insensitive validation |
| Invalid price | Inline error message |

## Data Transformation

**Input:**
```typescript
{
  attributes: [
    {
      id: 1,
      name: "Color",
      terms: [
        { id: 15, name: "Red", selected: true, price: 29.99 },
        { id: 17, name: "Green", selected: true, price: 29.99 }
      ]
    }
  ]
}
```

**Output (WooCommerce format):**
```typescript
{
  attributes: [
    {
      id: 1,
      name: "Color",
      variation: true,
      visible: true,
      options: ["Red", "Green"]
    }
  ]
}
```

## Testing

### Unit Tests
- API endpoint (mock responses, error handling)
- Component (expand/collapse, selection, price input, custom term)

### Integration Tests
- Full flow (load → select → submit)
- Error scenarios (API down, empty data)

### Manual Checklist
- [ ] Attributes load from WooCommerce
- [ ] All terms populate
- [ ] Accordions work smoothly
- [ ] Checkboxes work individually + select-all
- [ ] Prices pre-fill with base price
- [ ] Custom term addition works
- [ ] Search/filter works
- [ ] Submission format is correct
- [ ] Error states display properly

## References

- [WooCommerce REST API v3 Documentation](https://woocommerce.github.io/woocommerce-rest-api-docs/v3.html)
- [WooCommerce Developer Docs - Product Attributes API](https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/product-attributes/)
