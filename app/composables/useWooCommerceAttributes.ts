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
