<script setup lang="ts">
import type { Product } from '~/entities/Product.schema'
import type { Category } from '~/entities/Category.schema'
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import { ProductStatus } from '~/entities/Product.schema'
import { ProductRepository } from '~/repositories/supabase/product'
import { CategoryRepository } from '~/repositories/supabase/category'

definePageMeta({
  layout: 'default',
})

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

const supabase = useSupabaseClient()
const toast = useToast()

// State
const globalFilter = ref('')
const statusFilter = ref<Product['status'] | null>(null)
const categories = ref<Category[]>([])
const isUploadModalOpen = ref(false)
const selectedProduct = ref<Product | null>(null)
const selectedCategories = ref<Category[]>([])
const uploadLoading = ref(false)
const currentStep = ref(0)
const isImagePreviewOpen = ref(false)
const previewImage = ref('')

// Stepper items
const stepperItems = [
  {
    title: 'Content',
    description: 'Edit product content',
    icon: 'i-heroicons-document-text',
    value: 0,
  },
  {
    title: 'Categories',
    description: 'Select product categories',
    icon: 'i-heroicons-tag',
    value: 1,
  },
  {
    title: 'Media & Price',
    description: 'Set images and price',
    icon: 'i-heroicons-photo',
    value: 2,
  },
]

const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
})

// Form state for upload dialog
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
})

// Status colors
const statusColors: Record<string, 'success' | 'error' | 'warning' | 'info' | 'neutral'> = {
  draft: 'neutral',
  processing: 'info',
  success: 'success',
  failed: 'error',
}

// Define table columns
const columns: TableColumn<Product>[] = [
  {
    accessorKey: 'seo_title',
    header: 'Title',
    cell: ({ row }: { row: any }) => {
      const title = row.getValue('seo_title') as string
      const previewUrl = (row.original as Product).preview_url

      if (previewUrl) {
        return h('a', {
          href: previewUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'font-medium text-primary hover:underline cursor-pointer',
        }, title)
      }

      return h('span', { class: 'font-medium' }, title)
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: { row: any }) => {
      const status = row.getValue('status') as string
      const color = statusColors[status] || 'neutral'
      return h(UBadge, {
        variant: 'subtle',
        color,
      }, () => status.toUpperCase())
    },
  },
  {
    accessorKey: 'raw_categories',
    header: 'Categories',
    cell: ({ row }: { row: any }) => {
      const rawCategories = (row.original as Product).raw_categories || []
      if (rawCategories.length === 0) {
        return h('span', { class: 'text-muted text-sm' }, 'No categories')
      }
      const names = rawCategories.map((c: any) => c.name).slice(0, 2)
      const display = names.join(', ')
      const remaining = rawCategories.length > 2 ? ` +${rawCategories.length - 2}` : ''
      return h('span', { class: 'text-sm' }, display + remaining)
    },
  },
  {
    accessorKey: 'images',
    header: 'Images',
    cell: ({ row }: { row: any }) => {
      const images = row.getValue('images') as string[]
      if (images.length === 0) {
        return h('span', { class: 'text-muted text-sm' }, 'No images')
      }
      return h('div', { class: 'flex gap-1' }, [
        h('img', {
          src: images[0],
          alt: 'Product image',
          class: 'w-10 h-10 object-cover rounded',
        }),
        images.length > 1
          ? h('span', { class: 'text-xs text-muted' }, `+${images.length - 1}`)
          : null,
      ])
    },
  },
  {
    accessorKey: 'price',
    header: 'Price',
    cell: ({ row }: { row: any }) => {
      const price = row.getValue('price') as number | null
      if (price === null) {
        return h('span', { class: 'text-muted text-sm' }, 'N/A')
      }
      const formatted = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(price)
      return h('span', { class: 'text-sm' }, formatted)
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }: { row: any }) => {
      const date = row.getValue('created_at') as string
      const formatted = new Date(date).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      return h('span', { class: 'text-sm' }, formatted)
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
    cell: ({ row }: { row: any }) => {
      const product = row.original as Product
      const canUpload = product.status === ProductStatus.DRAFT || product.status === ProductStatus.FAILED

      if (!canUpload) {
        return h('span', { class: 'text-muted text-sm' }, '-')
      }

      return h(UButton, {
        size: 'xs',
        color: 'primary',
        label: 'Upload',
        icon: 'i-heroicons-arrow-up-tray',
        onClick: () => openUploadModal(product),
      })
    },
  },
]

// Use useAsyncData for data fetching with reactive dependencies
const { data, pending, error, refresh } = await useAsyncData(
  'products',
  async () => {
    const repo = new ProductRepository(supabase)
    const result = await repo.findAllWithCategory({
      status: statusFilter.value,
    })

    return {
      products: result,
      total: result.length,
    }
  },
  {
    watch: [statusFilter],
  },
)

// Fetch categories for selection
const { data: categoriesData, error: categoriesError } = await useAsyncData(
  'categories',
  async () => {
    const categoryRepo = new CategoryRepository(supabase)
    return categoryRepo.findAll()
  },
)

// Handle errors
watchEffect(() => {
  if (error.value) {
    console.error('Error fetching products:', error.value)
    toast.add({
      title: 'Error',
      description: 'Failed to load products',
      color: 'error',
    })
  }
})

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

// Format price
function formatPrice(price: number | null) {
  if (price === null) return 'N/A'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price)
}

// Open upload modal
function openUploadModal(product: Product) {
  selectedProduct.value = product
  uploadForm.seo_title = product.seo_title
  uploadForm.meta_description = product.meta_description
  uploadForm.short_description = product.short_description
  uploadForm.html_content = product.html_content
  uploadForm.keywords = [...product.keywords]
  uploadForm.images = [...product.images]
  uploadForm.uploadImages = product.images.map(() => false)
  uploadForm.imageLoaded = product.images.map(() => true)
  uploadForm.price = product.price
  // Pre-fill selected categories from raw_categories
  selectedCategories.value = (product.raw_categories || [])
    .map(rc => categories.value.find(c => c.id === rc.id))
    .filter((c): c is Category => c !== undefined)
  currentStep.value = 0
  isUploadModalOpen.value = true
}

// Close upload modal
function closeUploadModal() {
  isUploadModalOpen.value = false
  selectedProduct.value = null
  selectedCategories.value = []
  currentStep.value = 0
}

// Go to next step
function nextStep() {
  if (currentStep.value < stepperItems.length - 1) {
    currentStep.value++
  }
}

// Go to previous step
function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

// Open image preview
function openImagePreview(image: string) {
  previewImage.value = image
  isImagePreviewOpen.value = true
}

// Handle image load error
function onImageError(index: number) {
  uploadForm.imageLoaded[index] = false
}

// Submit upload
async function submitUpload() {
  if (!selectedProduct.value) return

  // Validate price is required
  if (uploadForm.price === null || uploadForm.price === undefined) {
    toast.add({
      title: 'Validation Error',
      description: 'Price is required',
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  uploadLoading.value = true
  try {
    // Filter images based on checkbox selection
    const imagesToUpload = uploadForm.images.filter((_, index) => uploadForm.uploadImages[index])

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
        categories: selectedCategories.value,
      },
    })

    toast.add({
      title: 'Success',
      description: 'Product uploaded successfully',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    closeUploadModal()
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Upload Failed',
      description: error instanceof Error ? error.message : 'Failed to upload product',
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    uploadLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-4 p-4 h-screen overflow-hidden">
    <!-- Header & Filter -->
    <div class="w-full max-w-6xl flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">Products</h1>
      <div class="flex items-center gap-2">
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

    <!-- Products Table Card -->
    <UPageCard class="w-full max-w-6xl flex-1 overflow-auto">
      <UTable
        :data="data?.products ?? []"
        :columns="columns"
        :loading="pending"
        :global-filter="globalFilter"
        class="flex-1"
      >
        <template #empty>
          <div class="py-8 text-center text-muted">
            <p class="text-lg font-medium">No products found</p>
          </div>
        </template>
      </UTable>
    </UPageCard>

    <!-- Upload Modal -->
    <UModal
      v-model:open="isUploadModalOpen"
      title="Upload Product"
      :ui="{ footer: 'justify-end' }"
      class="max-w-2xl"
    >
      <template #body>
        <div v-if="selectedProduct" class="space-y-6">
          <!-- Stepper -->
          <UStepper :items="stepperItems" v-model="currentStep" />

          <!-- Step 0: Content -->
          <div v-show="currentStep === 0" class="space-y-4">
            <!-- SEO Title -->
            <UFormField label="SEO Title" required>
              <UInput v-model="uploadForm.seo_title" class="w-full" placeholder="Enter SEO title" />
            </UFormField>

            <!-- Meta Description -->
            <UFormField label="Meta Description" required>
              <UTextarea v-model="uploadForm.meta_description" class="w-full" placeholder="Enter meta description" :rows="4" />
            </UFormField>

            <!-- Keywords -->
            <UFormField label="Keywords">
              <UInputTags v-model="uploadForm.keywords" class="w-full" placeholder="Add keywords" />
            </UFormField>

            <!-- Short Description -->
            <UFormField label="Short Description" required>
              <UTextarea v-model="uploadForm.short_description" class="w-full" placeholder="Enter short description" :rows="4" />
            </UFormField>

            <!-- HTML Content (Preview) -->
            <UFormField label="HTML Content">
              <UTextarea v-model="uploadForm.html_content" class="w-full" placeholder="HTML content" :rows="5" readonly />
            </UFormField>
          </div>

          <!-- Step 1: Categories -->
          <div v-show="currentStep === 1" class="space-y-4">
            <!-- Categories -->
            <UFormField label="Categories">
              <USelectMenu
                v-model="selectedCategories"
                :items="categories as any"
                multiple
                create-item
                placeholder="Search categories or add new..."
                value-key="id"
                label-key="name"
                by="id"
                class="w-full"
              >
                <template #item-label="{ item }">
                  {{ item.name }}
                  <span class="text-muted text-xs ml-2">{{ item.slug }}</span>
                </template>
              </USelectMenu>
            </UFormField>
          </div>

          <!-- Step 2: Media & Price -->
          <div v-show="currentStep === 2" class="space-y-4">
            <!-- Price -->
            <UFormField label="Price (VND)" required>
              <UInputNumber
                v-model="uploadForm.price"
                placeholder="Enter price"
                :increment="false"
                :decrement="false"
              />
            </UFormField>

            <!-- Images with upload checkbox -->
            <UFormField v-if="uploadForm.images.length > 0" label="Images">
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="(image, index) in uploadForm.images"
                  v-show="uploadForm.imageLoaded[index]"
                  :key="index"
                  class="flex items-center gap-3 p-2 border rounded-lg"
                >
                  <UCheckbox v-model="uploadForm.uploadImages[index]" :name="`image-${index}`" />
                  <div class="flex-1 cursor-pointer" @click="openImagePreview(image)">
                    <img
                      :src="image"
                      :alt="`Image ${index + 1}`"
                      class="w-full object-cover rounded hover:opacity-80 transition-opacity"
                      @error="onImageError(index)"
                    />
                  </div>
                </div>
              </div>
            </UFormField>
          </div>
        </div>
      </template>

      <template #footer>
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          :disabled="uploadLoading"
          @click="closeUploadModal"
        />
        <UButton
          v-if="currentStep > 0"
          label="Back"
          color="neutral"
          variant="outline"
          :disabled="uploadLoading"
          @click="prevStep"
        />
        <UButton
          v-if="currentStep < stepperItems.length - 1"
          label="Next"
          @click="nextStep"
        />
        <UButton
          v-if="currentStep === stepperItems.length - 1"
          label="Submit Upload"
          :loading="uploadLoading"
          @click="submitUpload"
        />
      </template>
    </UModal>

    <!-- Image Preview Modal -->
    <UModal
      v-model:open="isImagePreviewOpen"
      title="Image Preview"
      :ui="{ footer: 'justify-end' }"
      class="max-w-4xl"
    >
      <template #body>
        <div class="flex justify-center items-center">
          <img :src="previewImage" alt="Full size preview" class="max-w-full max-h-[70vh] object-contain rounded" />
        </div>
      </template>

      <template #footer>
        <UButton
          label="Close"
          @click="isImagePreviewOpen = false"
        />
      </template>
    </UModal>
  </div>
</template>
