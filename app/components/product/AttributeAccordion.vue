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
              @click.stop="toggleAll(item.id, !isAllSelected(item.id) as boolean)"
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

      <template #body="{ item }">
        <div class="p-4 space-y-2">
          <div
            v-for="term in item.terms"
            :key="term.id"
            class="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <UCheckbox
              :model-value="term.selected"
              @update:model-value="toggleTerm(item.id, term.id, $event as boolean)"
            />
            <span class="flex-1">{{ term.name }}</span>
            <UInputNumber
              :model-value="term.price"
              @update:model-value="updatePrice(item.id, term.id, $event as number)"
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
  const totalLength = attr?.terms.length || 0
  return selected > 0 && selected < totalLength
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
