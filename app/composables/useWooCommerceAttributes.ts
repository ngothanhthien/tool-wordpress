// app/composables/useWooCommerceAttributes.ts
import type { AttributeState } from '~/entities/WooCommerceAttribute.schema'

export function useWooCommerceAttributes() {
  // Attributes state - always initialized as empty array
  const attributes = ref<AttributeState[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** Fetch WooCommerce product attributes from API */
  async function fetchAttributes() {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{
        attributes: AttributeState[]
      }>('/api/woocommerce/product-attributes')

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
      error.value = e.message || 'Failed to load product attributes'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Toggle expansion state of an attribute section */
  function toggleAttributeExpanded(id: number) {
    const attr = attributes.value.find(a => a.id === id)
    if (attr) {
      attr.expanded = !attr.expanded
    }
  }

  /** Toggle selection state of a single term */
  function toggleTermSelected(attributeId: number, termId: number) {
    const attr = attributes.value.find(a => a.id === attributeId)
    if (attr) {
      const term = attr.terms.find(t => t.id === termId)
      if (term) {
        term.selected = !term.selected
      }
    }
  }

  /** Toggle selection state for all terms in an attribute */
  function toggleAllTerms(attributeId: number, selected: boolean) {
    const attr = attributes.value.find(a => a.id === attributeId)
    if (attr) {
      attr.terms.forEach(term => {
        term.selected = selected
      })
    }
  }

  /** Update price modifier for a specific term */
  function updateTermPrice(attributeId: number, termId: number, price: number) {
    const attr = attributes.value.find(a => a.id === attributeId)
    if (attr) {
      const term = attr.terms.find(t => t.id === termId)
      if (term) {
        term.price = price
      }
    }
  }

  /** Get all attributes with their selected terms */
  function getSelectedTerms() {
    return attributes.value
      .filter(attr => attr.terms.some(t => t.selected))
      .map(attr => ({
        id: attr.id,
        name: attr.name,
        options: attr.terms.filter(t => t.selected).map(t => t.name)
      }))
  }

  /** Get total count of all selected terms across all attributes */
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
