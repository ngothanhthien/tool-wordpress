# Variant Attribute Grouping Design

## Overview

Group product variants by attributes (Color, Size, etc.) in the Variants tab, using attributes fetched from WooCommerce. This replaces the current flat variant list with organized, attribute-based sections.

## Approach

**Server-Side Grouping** - Enhance the existing API to return grouped variants with attributes, then display them in grouped sections.

### Rationale

- Reuses existing `getVariantsByCategory()` method (already implemented in `WooCommerceRepository`)
- Single API call for all attribute data
- Clean separation of concerns
- Uses actual WooCommerce attributes, not guessing from names

## Architecture

### Backend Layer

**New API Endpoint**: `/api/woocommerce/variant-attributes.post.ts`

Accepts `categoryIds: number[]` in request body, calls `WooCommerceRepository.getVariantsByCategory()` for each category, merges results, and returns:

```typescript
{
  attributes: {
    "Color": ["Red", "Blue", "Black"],
    "Size": ["S", "M", "L", "XL"],
    "Material": ["Cotton", "Silk"]
  }
}
```

### Frontend State

```typescript
interface VariantAttributeValue {
  name: string        // e.g., "Red", "M"
  price: number
  selected: boolean
}

interface VariantAttribute {
  name: string        // e.g., "Color", "Size"
  values: VariantAttributeValue[]
}

const variantAttributes = ref<VariantAttribute[]>([])
```

Replaces the current flat `variants` array.

## Data Flow

1. User selects categories in Step 2 (Categories & Price)
2. User clicks "Next" to navigate to Step 3 (Variants)
3. The `nextStep()` function triggers `fetchVariantAttributes()` instead of `fetchVariants()`
4. API returns grouped attributes
5. Data transforms from API format to editable state structure
6. UI displays grouped sections (always expanded)

### Data Transformation

```typescript
// API returns: { "Color": ["Red", "Blue"], "Size": ["S", "M"] }
// Transform to editable structure:
variantAttributes.value = Object.entries(response.attributes).map(([name, values]) => ({
  name,
  values: values.map(v => ({
    name: v,
    price: 0,  // Will be filled from suggested variants API if needed
    selected: true
  }))
}))
```

### Submit Transformation

```typescript
// Flatten grouped structure for API submission
const variants: { name: string; price: number }[] = []
for (const attr of variantAttributes.value) {
  for (const val of attr.values.filter(v => v.selected)) {
    variants.push({ name: val.name, price: val.price })
  }
}
```

## UI Structure

```
┌─ Variant Attributes ──────────────────────────┐
│                                               │
│ ┌─ Color ─────────────────────────────────┐  │
│ │ [X] Red    Price: [100,000 VND]         │  │
│ │ [X] Blue   Price: [120,000 VND]         │  │
│ │ [+] Add Value                           │  │
│ └──────────────────────────────────────────┘  │
│                                               │
│ ┌─ Size ──────────────────────────────────┐  │
│ │ [X] S      Price: [0 VND]               │  │
│ │ [X] M      Price: [0 VND]               │  │
│ │ [+] Add Value                           │  │
│ └──────────────────────────────────────────┘  │
│                                               │
│ [+ Add Attribute]                             │
└───────────────────────────────────────────────┘
```

**Key Interactions**:
- Checkbox toggles `selected` state
- Price input updates variant price
- "Add Value" creates new variant value within attribute
- "Add Attribute" creates new attribute group
- Delete button on each value/attribute

## Error Handling

| Scenario | Behavior |
|----------|----------|
| WooCommerce API unavailable | Return empty attributes, show warning toast, allow manual entry |
| No categories selected | Skip API call, show empty state with instructions |
| No attributes found | Show empty state, allow manual attribute creation |
| Empty variant name | Validation error on submit |
| Negative price | Validation error on submit |

**Validation Rules**:
1. At least one attribute must have at least one selected value
2. Each variant value must have a non-empty name
3. Each variant value must have price >= 0
4. Price defaults to product's base price if left at 0

## Testing

### Unit Tests

1. **API Endpoint**:
   - Valid categoryIds returns grouped attributes
   - Empty array throws validation error
   - Invalid category ID throws validation error
   - WooCommerce failure returns empty attributes

2. **Repository**:
   - Returns empty object when no products found
   - Merges attributes from multiple products
   - Deduplicates values within same attribute

### Integration Tests

1. **State Management**: `fetchVariantAttributes()` populates state correctly, loading toggles, errors show toast
2. **Data Transformation**: API transforms correctly, submit flattens correctly, unchecked items excluded

### Manual Testing Scenarios

1. Happy Path: Select categories → See grouped attributes → Edit → Submit
2. No Categories: Skip selection → See empty state → Add manual
3. API Down: See warning → Add manual attribute
4. Empty Attributes: See empty state → Add manual
5. Validation: Empty names / negative prices → Show errors

## Implementation Checklist

- [x] Create `/server/api/woocommerce/variant-attributes.post.ts` endpoint
- [x] Update `products.vue` state from flat `variants` to grouped `variantAttributes`
- [x] Replace `fetchVariants()` with `fetchVariantAttributes()`
- [x] Update Step 3 template to render grouped sections
- [x] Add "Add Attribute" and "Add Value" functions
- [x] Update `submitUpload()` to flatten grouped structure
- [x] Update validation logic for grouped structure
- [x] Run `npx nuxt typecheck`
