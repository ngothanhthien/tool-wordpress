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

// Brand type matching the API response
type Brand = {
  id: string
  name: string
  slug: string
  updated_at: string
}

// Fetch stats on server side using useAsyncData
const { data: stats, pending: isLoading, refresh: loadStats, error } = await useAsyncData(
  'brands-stats',
  () => $fetch<{ count: number; last_updated: string | null }>('/api/brands/stats'),
  {
    default: () => ({ count: 0, last_updated: null }),
  }
)

// Fetch brands on server side using useAsyncData
const { data: brands, pending: isLoadingBrands, refresh: loadBrands, error: brandsError } = await useAsyncData(
  'brands-list',
  () => $fetch<Brand[]>('/api/brands'),
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
  if (brandsError.value) {
    const message = brandsError.value instanceof Error
      ? brandsError.value.message
      : 'Failed to load brands'
    console.error('Failed to load brands:', brandsError.value)
    toast.add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  }
})

// Table columns definition
const columns: TableColumn<Brand>[] = [
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

// Sync brands
async function syncBrands() {
  isSyncing.value = true
  try {
    const response = await $fetch('/api/sync/woocommerce/brands', {
      method: 'POST',
    })

    toast.add({
      title: 'Success',
      description: `${response.count} brands synced`,
      color: 'success',
    })

    // Refresh both stats and brands
    await Promise.all([loadStats(), loadBrands()])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sync brands'
    toast.add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  } finally {
    isSyncing.value = false
  }
}

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
        <h1 class="text-xl font-bold">Brands</h1>
        <div class="flex items-center gap-2 text-gray-500">
          <span>{{ stats.count }} brands</span>
          <span class="text-gray-400">•</span>
          <span class="text-gray-400">
            {{ stats.last_updated
              ? `synced ${relativeTime(stats.last_updated)}`
              : 'never synced' }}
          </span>
        </div>
      </div>
      <UButton
        size="md"
        :loading="isSyncing"
        :disabled="isSyncing"
        @click="syncBrands"
      >
        {{ isSyncing ? 'Syncing...' : 'Start Sync' }}
      </UButton>
    </div>

    <!-- Brands Table Card -->
    <div class="w-full max-w-4xl flex-1 overflow-auto bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
      <UTable
        :data="brands"
        :columns="columns"
        :loading="isLoadingBrands"
        class="w-full"
      >
        <template #empty>
          <div class="flex flex-col items-center justify-center py-12 text-gray-500">
            <p>No brands synced yet. Click "Start Sync" to get started.</p>
          </div>
        </template>
      </UTable>
    </div>
  </div>
</template>
