<script setup lang="ts">
import type { N8NProcess } from '~/entities/N8NProccess.schema'
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import { N8NProcessRepository } from '~/repositories/supabase/n8n-process'
import { N8NProcessStatus } from '~/entities/N8NProccess.schema'

definePageMeta({
  layout: 'default',
})

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')

// Helper function to format time
function formatTimeAgo(date: string | Date | null) {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

type StatusValue = typeof N8NProcessStatus[keyof typeof N8NProcessStatus] | undefined

const supabase = useSupabaseClient()
const n8nProcessRepo = new N8NProcessRepository(supabase)
const toast = useToast()

const globalFilter = ref('')
const statusFilter = ref<StatusValue>()

// Modal state for create product
const isModalOpen = ref(false)
const productLinks = ref('')
const isSubmitting = ref(false)

// Modal state for view detail
const isDetailModalOpen = ref(false)
const selectedProcess = ref<N8NProcess | null>(null)

const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
})

const statusColors: Record<string, 'success' | 'error' | 'warning' | 'info' | 'neutral'> = {
  pending: 'warning',
  running: 'info',
  success: 'success',
  failed: 'error',
  cancelled: 'neutral',
}


const columns: TableColumn<N8NProcess>[] = [
  {
    accessorKey: 'process_name',
    header: 'Process Name',
    cell: ({ row }) => {
      const name = row.getValue('process_name') as string
      return h('span', { class: 'font-medium text-highlighted' }, name || '-')
    },
  },
  {
    accessorKey: 'n8n_workflow_id',
    header: 'Workflow ID',
    cell: ({ row }) => {
      const workflowId = row.getValue('n8n_workflow_id') as string
      return h('code', { class: 'text-xs bg-muted px-2 py-1 rounded font-mono' }, workflowId)
    },
  },
  {
    accessorKey: 'n8n_execution_id',
    header: 'Execution ID',
    cell: ({ row }) => {
      const executionId = row.getValue('n8n_execution_id') as string
      return h('code', { class: 'text-xs bg-muted px-2 py-1 rounded font-mono' }, executionId)
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const color = statusColors[status] || 'neutral'
      return h(UBadge, {
        variant: 'subtle',
        color,
        class: 'capitalize',
      }, () => status)
    },
  },
  {
    accessorKey: 'started_at',
    header: 'Started At',
    cell: ({ row }) => {
      const date = row.getValue('started_at') as string | null
      return h('span', { class: 'text-xs' }, formatTimeAgo(date))
    },
  },
  {
    accessorKey: 'finished_at',
    header: 'Finished At',
    cell: ({ row }) => {
      const date = row.getValue('finished_at') as string | null
      return h('span', { class: 'text-xs' }, formatTimeAgo(date))
    },
  },
  {
    accessorKey: 'input_payload',
    header: 'Input Payload',
    cell: ({ row }) => {
      const payload = row.getValue('input_payload') as Record<string, any> | null
      if (!payload) return h('span', { class: 'text-muted text-xs' }, '-')
      return h('pre', { class: 'text-xs bg-muted px-2 py-1 rounded font-mono max-w-xs max-h-20 overflow-auto' }, JSON.stringify(payload, null, 2))
    },
  },
  {
    accessorKey: 'error_message',
    header: 'Error',
    cell: ({ row }) => {
      const error = row.getValue('error_message') as string | null
      if (!error) return h('span', { class: 'text-muted text-xs' }, '-')
      const truncated = error.length > 50 ? error.slice(0, 50) + '...' : error
      return h('span', { class: 'text-xs text-error max-w-xs truncate block' }, truncated)
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    meta: {
      class: {
        td: 'text-right'
      }
    },
    cell: ({ row }) => {
      const items = [{
        type: 'label',
        label: 'Actions'
      }, {
        label: 'View Detail',
        icon: 'i-lucide-eye',
        onSelect() {
          openDetailModal(row.original)
        }
      }]

      return h(UDropdownMenu, {
        'content': {
          align: 'end'
        },
        items,
        'aria-label': 'Actions dropdown'
      }, () => h(UButton, {
        'icon': 'i-lucide-ellipsis-vertical',
        'color': 'neutral',
        'variant': 'ghost',
        'aria-label': 'Actions dropdown'
      }))
    },
  },
]

// Use useAsyncData for data fetching with reactive dependencies
const { data, pending, error, refresh } = await useAsyncData(
  'n8n-processes',
  async () => {
    const result = await n8nProcessRepo.fetchProcesses({
      pagination: pagination.value,
      filter: globalFilter.value || undefined,
      status: statusFilter.value,
      processName: 'generate_product',
    })

    if (result.error) {
      throw new Error(result.error)
    }

    return {
      processes: result.data,
      total: result.total,
    }
  },
  {
    watch: [pagination, globalFilter, statusFilter],
  },
)

// Handle errors
watchEffect(() => {
  if (error.value) {
    console.error('Error fetching processes:', error.value)
    toast.add({
      title: 'Error',
      description: 'Failed to load processes',
      color: 'error',
    })
  }
})

// Wrapper for button click handler
function handleRefresh() {
  refresh()
}

// Handle create product submission
async function handleSubmit() {
  if (!productLinks.value.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'Please enter at least one product link',
      color: 'error',
    })
    return
  }

  isSubmitting.value = true

  try {
    const response = await $fetch('/api/generate-product', {
      method: 'POST',
      body: {
        chatInput: productLinks.value.trim(),
      },
    })

    if (response.error) {
      toast.add({
        title: 'Error',
        description: response.error,
        color: 'error',
      })
    } else {
      toast.add({
        title: 'Success',
        description: response.message || 'Product generation started',
        color: 'success',
      })
      isModalOpen.value = false
      productLinks.value = ''
      refresh()
    }
  } catch (error) {
    console.error('Error creating product:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to generate product',
      color: 'error',
    })
  } finally {
    isSubmitting.value = false
  }
}

function closeModal() {
  isModalOpen.value = false
  productLinks.value = ''
}

function openModal() {
  isModalOpen.value = true
}

// Detail modal functions
function openDetailModal(process: N8NProcess) {
  selectedProcess.value = process
  isDetailModalOpen.value = true
}

function closeDetailModal() {
  isDetailModalOpen.value = false
  selectedProcess.value = null
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">
          Prepare Data Workflow
        </h1>
        <p class="text-muted text-sm">
          Monitor and manage your n8n workflow executions
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-plus"
          @click="openModal"
        >
          Create Product
        </UButton>
        <UButton
          icon="i-lucide-refresh-cw"
          :loading="pending"
          variant="outline"
          @click="handleRefresh"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-4">
      <UInput
        v-model="globalFilter"
        icon="i-lucide-search"
        placeholder="Search processes..."
        class="max-w-sm"
      />
      <USelect
        v-model="statusFilter"
        :items="[
          { label: 'All Statuses', value: undefined },
          { label: 'Pending', value: 'pending' },
          { label: 'Running', value: 'running' },
          { label: 'Completed', value: 'completed' },
          { label: 'Failed', value: 'failed' },
          { label: 'Cancelled', value: 'cancelled' },
        ]"
        placeholder="Filter by status"
        class="w-48"
        value-key="value"
      />
    </div>

    <!-- Table -->
    <UTable
      :data="data?.processes ?? []"
      :columns="columns"
      :loading="pending"
      :pagination="pagination"
      :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
      :global-filter="globalFilter"
      class="flex-1 border rounded-lg"
    >
      <template #empty>
        <div class="py-8 text-center text-muted">
          <p class="text-lg font-medium">No processes found</p>
          <p class="text-sm">Try adjusting your search or filters</p>
        </div>
      </template>
    </UTable>

    <!-- Pagination -->
    <div v-if="data?.total" class="flex items-center justify-between border-t pt-4">
      <p class="text-sm text-muted">
        Showing {{ (pagination.pageIndex * pagination.pageSize) + 1 }}-{{ Math.min((pagination.pageIndex + 1) * pagination.pageSize, data.total) }} of {{ data.total }} processes
      </p>
      <UPagination
        :page="pagination.pageIndex + 1"
        :items-per-page="pagination.pageSize"
        :total="data?.total ?? 0"
        @update:page="(p) => pagination.pageIndex = p - 1"
      />
    </div>

    <!-- Create Product Modal -->
    <UModal
      v-model:open="isModalOpen"
      title="Create Product"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div class="space-y-1">
          <p class="text-sm text-muted">Product Link</p>
          <p class="text-xs text-muted-foreground">Enter product links, one per line</p>
          <UTextarea
            v-model="productLinks"
            placeholder="Link separate by line"
            :rows="6"
            :disabled="isSubmitting"
            class="w-full"
          />
        </div>
      </template>

      <template #footer>
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          :disabled="isSubmitting"
          @click="closeModal"
        />
        <UButton
          label="Submit"
          :loading="isSubmitting"
          @click="handleSubmit"
        />
      </template>
    </UModal>

    <!-- View Detail Modal -->
    <UModal
      v-model:open="isDetailModalOpen"
      title="Process Details"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body v-if="selectedProcess">
        <div class="space-y-4">
          <div class="space-y-1">
            <p class="text-sm text-muted">Process Name</p>
            <p class="text-sm font-medium">{{ selectedProcess.process_name || '-' }}</p>
          </div>

          <div class="space-y-1">
            <p class="text-sm text-muted">N8N Workflow ID</p>
            <p class="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">{{ selectedProcess.n8n_workflow_id }}</p>
          </div>

          <div class="space-y-1">
            <p class="text-sm text-muted">N8N Execution ID</p>
            <p class="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">{{ selectedProcess.n8n_execution_id }}</p>
          </div>

          <div class="space-y-1">
            <p class="text-sm text-muted">Status</p>
            <UBadge
              :color="statusColors[selectedProcess.status] || 'neutral'"
              variant="subtle"
              class="capitalize"
            >
              {{ selectedProcess.status }}
            </UBadge>
          </div>

          <div class="space-y-1">
            <p class="text-sm text-muted">Started At</p>
            <p class="text-sm">{{ formatTimeAgo(selectedProcess.started_at || null) }}</p>
          </div>

          <div class="space-y-1">
            <p class="text-sm text-muted">Finished At</p>
            <p class="text-sm">{{ formatTimeAgo(selectedProcess.finished_at || null) }}</p>
          </div>

          <div class="space-y-1">
            <p class="text-sm text-muted">Triggered By</p>
            <p class="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">{{ selectedProcess.triggered_by || '-' }}</p>
          </div>

          <div v-if="selectedProcess.error_message" class="space-y-1">
            <p class="text-sm text-muted">Error Message</p>
            <p class="text-sm text-error">{{ selectedProcess.error_message }}</p>
          </div>

          <div v-if="selectedProcess.input_payload" class="space-y-1">
            <p class="text-sm text-muted">Input Payload</p>
            <pre class="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48">{{ JSON.stringify(selectedProcess.input_payload, null, 2) }}</pre>
          </div>

          <div v-if="selectedProcess.output_payload" class="space-y-1">
            <p class="text-sm text-muted">Output Payload</p>
            <pre class="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48">{{ JSON.stringify(selectedProcess.output_payload, null, 2) }}</pre>
          </div>
        </div>
      </template>

      <template #footer>
        <UButton
          label="Close"
          color="neutral"
          variant="outline"
          @click="closeDetailModal"
        />
      </template>
    </UModal>
  </div>
</template>
