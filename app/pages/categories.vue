<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  layout: 'default',
})

// Resolve components at module level to avoid hydration mismatches
const UBadge = resolveComponent('UBadge')

const toast = useToast()

// Reactive state
const isSyncing = ref(false)

// Category type
type Category = {
  id: string
  name: string
  slug: string
  updated_at: string
}

// Fetch stats on server side using useAsyncData
const { data: stats, pending: isLoading, refresh: loadStats, error } = await useAsyncData(
  'categories-stats',
  () => $fetch<{ count: number; last_updated: string | null }>('/api/categories/stats'),
  {
    default: () => ({ count: 0, last_updated: null }),
  }
)

// Fetch categories on server side using useAsyncData
const { data: categories, pending: isLoadingCategories, refresh: loadCategories, error: categoriesError } = await useAsyncData(
  'categories-list',
  () => $fetch<Category[]>('/api/categories'),
  {
    default: () => [],
  }
)

// Show error toast if fetch failed
watchEffect(() => {
  if (error.value) {
    const message = error.value instanceof Error
      ? error.value.message
      : 'Failed to load stats'
    console.error('Failed to load stats:', error.value)
    toast.add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  }
  if (categoriesError.value) {
    const message = categoriesError.value instanceof Error
      ? categoriesError.value.message
      : 'Failed to load categories'
    console.error('Failed to load categories:', categoriesError.value)
    toast.add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  }
})

// Table columns definition
const columns: TableColumn<Category>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => `#${row.getValue('id')}`,
    meta: {
      class: {
        td: 'font-mono text-sm',
      },
    },
  },
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'slug',
    header: 'Slug',
    cell: ({ row }) => h(UBadge, {
      variant: 'subtle',
      color: 'neutral',
      class: 'font-mono text-xs',
    }, () => row.getValue('slug')),
  },
  {
    accessorKey: 'updated_at',
    header: 'Last Updated',
    cell: ({ row }) => {
      const date = new Date(row.getValue('updated_at'))
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    },
  },
]

// Sync categories
async function syncCategories() {
  isSyncing.value = true
  try {
    const response = await $fetch('/api/sync/woocommerce/categories', {
      method: 'POST',
    })

    toast.add({
      title: 'Success',
      description: `${response.count} categories synced`,
      color: 'success',
    })

    // Refresh both stats and categories
    await Promise.all([loadStats(), loadCategories()])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sync categories'
    toast.add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  } finally {
    isSyncing.value = false
  }
}

// Empty state message for table
const emptyStateText = computed(
  () => categories.value.length === 0 ? 'No categories synced yet. Click "Sync Categories" to get started.' : ''
)

// Relative time formatter (e.g., "2 hours ago")
function relativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}
</script>

<template>
  <div class="flex flex-col items-center gap-4 p-4 h-screen overflow-hidden">
    <!-- Minimal Stats Bar -->
    <div class="w-full max-w-4xl flex items-center justify-between gap-4">
      <div class="flex items-center gap-6 text-sm">
        <span class="text-gray-500">{{ stats.count }} categories</span>
        <span class="text-gray-400">
          {{ stats.last_updated
            ? `synced ${relativeTime(stats.last_updated)}`
            : 'never synced' }}
        </span>
      </div>
      <UButton
        size="md"
        :loading="isSyncing"
        :disabled="isSyncing"
        @click="syncCategories"
      >
        {{ isSyncing ? 'Syncing...' : 'Start Sync' }}
      </UButton>
    </div>

    <!-- Categories Table Card -->
    <UPageCard class="w-full max-w-4xl flex-1 overflow-auto">
      <template #header>
        <h2 class="text-lg font-semibold">
          Categories
        </h2>
      </template>

      <UTable
        :data="categories"
        :columns="columns"
        :loading="isLoadingCategories"
        :empty="emptyStateText"
        :sticky="true"
      />
    </UPageCard>
  </div>
</template>
