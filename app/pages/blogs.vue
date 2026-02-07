<script setup lang="ts">
import type { Post } from '~/entities/Post.schema'
import { useWordPressSync } from '~/composables/useWordPressSync'
import type { TableColumn } from '@nuxt/ui'
import { h } from 'vue'

const posts = ref<Post[]>([])
const loading = ref(false)
const toast = useToast()

const { syncing, progress, sync } = useWordPressSync()

onMounted(async () => {
  await fetchPosts()
})

async function fetchPosts() {
  loading.value = true
  try {
    posts.value = await $fetch<Post[]>('/api/posts')
  } catch (error) {
    console.error('Failed to fetch posts:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to fetch posts',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function handleSync() {
  await sync(async (data) => {
    if (data.status === 'complete') {
      await fetchPosts()
    }
  })
}

const UBadge = resolveComponent('UBadge')

// Columns for UTable
const columns: TableColumn<Post>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => {
      return h('span', { class: 'font-medium' }, row.original.title)
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status
      const color = status === 'publish' ? 'success' : 'neutral'
      return h(UBadge, { color, variant: 'subtle' }, () => status)
    }
  },
  {
    accessorKey: 'wordpress_date',
    header: 'Date',
    cell: ({ row }) => {
      const date = row.original.wordpress_date
      return date ? new Date(date).toLocaleDateString() : '-'
    }
  },
  {
    accessorKey: 'last_synced_at',
    header: 'Last Synced',
    cell: ({ row }) => {
      const date = row.original.last_synced_at
      return date ? new Date(date).toLocaleString() : '-'
    }
  }
]
</script>

<template>
  <div class="container mx-auto p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Blog Posts</h1>

      <UButton
        icon="i-heroicons-arrow-path"
        :loading="syncing"
        :disabled="syncing"
        @click="handleSync"
      >
        Sync from WordPress
      </UButton>
    </div>

    <UAlert
      v-if="syncing && progress.status !== 'idle'"
      :color="progress.status === 'error' ? 'error' : 'info'"
      :title="progress.status === 'error' ? progress.message : 'Syncing...'"
      class="mb-4"
    >
      <template #description>
        <div v-if="progress.status === 'progress' && 'total' in progress">
          {{ progress.processed }} / {{ progress.total }} posts synced
          <UProgress :value="(progress.processed / progress.total) * 100" class="mt-2" />
        </div>
      </template>
    </UAlert>

    <UTable
      :data="posts"
      :columns="columns"
      :loading="loading"
    />
  </div>
</template>
