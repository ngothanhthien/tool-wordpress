<script setup lang="ts">
import type { Product } from '~/entities/Product.schema'
import type { Category } from '~/entities/Category.schema'
import type { TableColumn } from '@nuxt/ui'
import { ProductStatus } from '~/entities/Product.schema'
import { ProductRepository } from '~/repositories/supabase/product'
import { CategoryRepository } from '~/repositories/supabase/category'

// Image item type for unified drag-and-drop list
interface ImageItem {
  id: string           // Unique ID for drag tracking (e.g., 'existing-1736025600-0')
  src: string          // Image URL
  isExisting: boolean  // Track source for reference (not logic)
  watermarked: boolean // Track watermark status
}

// Variant attribute value type
interface VariantAttributeValue {
  name: string        // e.g., "Red", "M"
  price: number
  selected: boolean
}

// Variant attribute type (groups attributes like Color, Size, etc.)
interface VariantAttribute {
  name: string        // e.g., "Color", "Size"
  values: VariantAttributeValue[]
}

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
const isCategoryDropdownOpen = ref(false)
const uploadLoading = ref(false)
const currentStep = ref(0)
const isImagePreviewOpen = ref(false)
const previewImage = ref('')
const isFetchingVariants = ref(false)
const isWatermarking = ref(false)
const watermarkProgress = ref(0)
const watermarkStatus = ref<'idle' | 'processing' | 'completed' | 'failed'>('idle')
const watermarkErrors = ref<string[]>([])
const isWatermarkErrorModalOpen = ref(false)

// Variant attributes state (for attribute-based variant grouping)
const variantAttributes = ref<VariantAttribute[]>([])

// Stepper items
const stepperItems = [
  {
    title: 'Content',
    description: 'Edit product content',
    icon: 'i-heroicons-document-text',
    value: 0,
  },
  {
    title: 'Media',
    description: 'Select product images',
    icon: 'i-heroicons-photo',
    value: 1,
  },
  {
    title: 'Categories & Price',
    description: 'Select categories and set price',
    icon: 'i-heroicons-tag',
    value: 2,
  },
  {
    title: 'Variants',
    description: 'Configure product variants',
    icon: 'i-heroicons-swatch',
    value: 3,
  },
]

// Form state for upload dialog
const uploadForm = reactive({
  seo_title: '',
  meta_description: '',
  short_description: '',
  html_content: '',
  keywords: [] as string[],
  images: [] as string[],
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cell: ({ row }: { row: any }) => {
      const rawCategories = (row.original as Product).raw_categories || []
      if (rawCategories.length === 0) {
        return h('span', { class: 'text-muted text-sm' }, 'No categories')
      }
      const names = rawCategories.map((c: { name: string }) => c.name).slice(0, 2)
      const display = names.join(', ')
      const remaining = rawCategories.length > 2 ? ` +${rawCategories.length - 2}` : ''
      return h('span', { class: 'text-sm' }, display + remaining)
    },
  },
  {
    accessorKey: 'images',
    header: 'Images',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// Close category dropdown when selection changes
watch(selectedCategories, () => {
  isCategoryDropdownOpen.value = false
}, { deep: true })

// Set categories ref
if (categoriesData.value) {
  categories.value = categoriesData.value
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
  uploadForm.price = product.price
  // Pre-fill selected categories from raw_categories
  selectedCategories.value = (product.raw_categories || [])
    .map(rc => categories.value.find(c => c.id === rc.id))
    .filter((c): c is Category => c !== undefined)
  // Reset upload state
  // Initialize allImages with existing product images
  allImages.value = product.images.map((src, i) => ({
    id: `existing-${Date.now()}-${i}`,
    src,
    isExisting: true,
    watermarked: false
  }))
  newImages.value = []
  selectedFiles.value = []
  uploadingFiles.value = []
  uploadProgress.value = []
  currentStep.value = 0
  isUploadModalOpen.value = true
}

// Close upload modal
function closeUploadModal() {
  isUploadModalOpen.value = false
  selectedProduct.value = null
  selectedCategories.value = []
  isCategoryDropdownOpen.value = false
  currentStep.value = 0
  // Reset upload state
  allImages.value = []
  newImages.value = []
  selectedFiles.value = []
  uploadingFiles.value = []
  uploadProgress.value = []
  variantAttributes.value = []
}

// Remove category from selection (handles Category objects and ID strings)
function removeCategory(category: Category | string) {
  selectedCategories.value = selectedCategories.value.filter(c => {
    if (typeof category === 'string') {
      // If both are strings, compare directly
      if (typeof c === 'string') {
        return c !== category
      }
      // c is an object, compare by id
      return c.id !== category
    }
    // category is an object
    if (typeof c === 'string') {
      return c !== category.id
    }
    // Both are objects, compare by id
    return c.id !== category.id
  })
}

// Get display name for category (handles ID strings, Category objects, and raw strings)
function getCategoryDisplayName(category: Category | string): string {
  if (typeof category === 'string') {
    // If it's a string, it could be an ID - look it up in categories array
    const found = categories.value.find(c => c.id === category)
    if (found) {
      return found.name
    }
    // Not found in categories, return as-is (for newly created items)
    return category
  }
  // Category object - use name if available, otherwise fall back to id
  return category.name || category.id
}

// Go to next step
async function nextStep() {
  if (currentStep.value < stepperItems.length - 1) {
    // Fetch variants when moving from Categories (2) to Variants (3)
    if (currentStep.value === 2 && selectedCategories.value.length > 0) {
      await fetchVariantAttributes()
    }
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

// ========== Image Management Functions ==========

// Delete image from the list
function deleteImage(index: number) {
  allImages.value.splice(index, 1)
}

// Auto-delete on image load error
function onImageLoadError(src: string) {
  const index = allImages.value.findIndex(img => img.src === src)
  if (index > -1) {
    allImages.value.splice(index, 1)

    toast.add({
      title: 'Image Removed',
      description: 'Failed to load image, automatically removed from list',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle',
    })
  }
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

  // Require at least one image
  if (allImages.value.length === 0) {
    toast.add({
      title: 'Validation Error',
      description: 'At least one image is required',
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  // Validate and flatten variant attributes
  const validVariants: { name: string; price: number }[] = []

  for (const attr of variantAttributes.value) {
    // Validate attribute name
    if (!attr.name || attr.name.trim() === '') {
      toast.add({
        title: 'Validation Error',
        description: 'Attribute name cannot be empty',
        color: 'error',
        icon: 'i-heroicons-exclamation-triangle',
      })
      return
    }

    for (const val of attr.values) {
      // Skip unselected values
      if (!val.selected) {
        continue
      }

      // Validate value name
      if (!val.name || val.name.trim() === '') {
        toast.add({
          title: 'Validation Error',
          description: `Variant value name cannot be empty in attribute: ${attr.name}`,
          color: 'error',
          icon: 'i-heroicons-exclamation-triangle',
        })
        return
      }

      // Validate price
      if (typeof val.price !== 'number' || val.price < 0) {
        toast.add({
          title: 'Validation Error',
          description: `Invalid price for variant: ${val.name}`,
          color: 'error',
          icon: 'i-heroicons-exclamation-triangle',
        })
        return
      }

      // Add to flattened list
      validVariants.push({ name: val.name, price: val.price })
    }
  }

  // Require at least one selected variant value
  if (validVariants.length === 0) {
    toast.add({
      title: 'Validation Error',
      description: 'At least one variant value must be selected',
      color: 'error',
      icon: 'i-heroicons-exclamation-triangle',
    })
    return
  }

  uploadLoading.value = true
  try {
    // Use the reordered image list directly
    const imagesToUpload = allImages.value.map(img => img.src)

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
        variants: validVariants,
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

// ========== Image Upload State & Functions ==========

// SSR-safe upload state
const selectedFiles = useState<File[]>('products-selected-files', () => [])
const uploadingFiles = useState<File[]>('products-uploading-files', () => [])
const uploadProgress = useState<number[]>('products-upload-progress', () => [])
const newImages = useState<string[]>('products-new-images', () => [])

// Unified image list for drag-and-drop (combines existing + new images)
const allImages = ref<ImageItem[]>([])

// Drag state
const draggedIndex = ref<number | null>(null)

// ========== Drag & Drop Functions ==========

function onDragStart(index: number, event: DragEvent) {
  draggedIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/html', String(index))
  }
}

function onDragEnd() {
  draggedIndex.value = null
}

function onDrop(targetIndex: number, event: DragEvent) {
  event.preventDefault()

  if (draggedIndex.value === null || draggedIndex.value === targetIndex) {
    return
  }

  const [removed] = allImages.value.splice(draggedIndex.value, 1)
  if (removed) {
    allImages.value.splice(targetIndex, 0, removed)
  }

  draggedIndex.value = null
}

// Helper: Validate file
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please upload JPG, PNG, GIF, or WebP images.' }
  }

  // Check file size (max 32MB for ImgBB)
  const maxSize = 32 * 1024 * 1024 // 32MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 32MB limit.' }
  }

  return { valid: true }
}

// Helper: Convert file to base64
function convertToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const commaIndex = result.indexOf(',')
      const base64 = commaIndex > -1 ? result.slice(commaIndex + 1) : result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Helper: Upload to ImgBB via API
async function uploadToImgBB(base64: string, fileName: string): Promise<string> {
  try {
    const response = await $fetch('/api/upload-image', {
      method: 'POST',
      body: {
        image: base64,
        name: fileName,
      },
    })

    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response from upload server')
    }

    const data = response as { success: boolean; data?: { url?: string }; error?: string }

    if (!data.success || !data.data?.url) {
      throw new Error(data.error || 'Failed to upload image')
    }

    return data.data.url
  } catch (error) {
    console.error('ImgBB upload error:', error)
    throw error
  }
}

// Helper: Check for duplicate URL
function isDuplicateUrl(url: string): boolean {
  return allImages.value.some(img => img.src === url)
}

// Upload handler function
async function uploadFiles(files: File[]) {
  for (const file of files) {
    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      toast.add({
        title: 'Invalid File',
        description: validation.error,
        color: 'error',
        icon: 'i-heroicons-exclamation-triangle',
      })
      continue
    }

    // Add to uploading list
    uploadingFiles.value.push(file)
    const progressIndex = uploadingFiles.value.length - 1
    uploadProgress.value.push(0)

    try {
      // Step 1: Convert to base64
      uploadProgress.value[progressIndex] = 25
      const base64 = await convertToBase64(file)

      // Step 2: Upload to ImgBB
      uploadProgress.value[progressIndex] = 50
      const url = await uploadToImgBB(base64, file.name)

      // Step 3: Complete
      uploadProgress.value[progressIndex] = 100

      // Add to new images if not duplicate
      if (!isDuplicateUrl(url)) {
        newImages.value.push(url)
        // Add to unified image list
        allImages.value.push({
          id: `new-${Date.now()}-${Math.random()}`,
          src: url,
          isExisting: false,
          watermarked: false
        })
        toast.add({
          title: 'Upload Complete',
          description: `${file.name} uploaded successfully`,
          color: 'success',
          icon: 'i-heroicons-check-circle',
        })
      } else {
        toast.add({
          title: 'Duplicate Image',
          description: 'This image is already in the list',
          color: 'warning',
          icon: 'i-heroicons-exclamation-triangle',
        })
      }

      // Remove from uploading list after delay
      setTimeout(() => {
        const idx = uploadingFiles.value.indexOf(file)
        if (idx > -1) {
          uploadingFiles.value.splice(idx, 1)
          uploadProgress.value.splice(idx, 1)
        }
      }, 2000)
    } catch (error) {
      // Remove from uploading list on error
      const idx = uploadingFiles.value.indexOf(file)
      if (idx > -1) {
        uploadingFiles.value.splice(idx, 1)
        uploadProgress.value.splice(idx, 1)
      }

      toast.add({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : `Failed to upload ${file.name}`,
        color: 'error',
        icon: 'i-heroicons-x-circle',
      })
    }
  }
}

// ========== Watermark Functions ==========

/**
 * Start background watermarking for all non-watermarked images
 * Non-blocking - allows navigation while processing
 */
async function startWatermarking() {
  // Skip if already watermarking or all images already watermarked
  if (isWatermarking.value) {
    return
  }

  const needsWatermark = allImages.value.some(img => !img.watermarked)
  if (!needsWatermark) {
    watermarkStatus.value = 'completed'
    return
  }

  isWatermarking.value = true
  watermarkStatus.value = 'processing'
  watermarkErrors.value = []
  watermarkProgress.value = 0

  const total = allImages.value.length
  let completed = 0

  for (const image of allImages.value) {
    // Skip already watermarked images
    if (image.watermarked) {
      completed++
      watermarkProgress.value = Math.round((completed / total) * 100)
      continue
    }

    try {
      const response = await $fetch('/api/watermark', {
        method: 'POST',
        body: { image_url: image.src }
      })

      if (response && typeof response === 'object' && 'success' in response) {
        const result = response as { success: boolean; data?: { watermarked_url: string }; error?: string }

        if (result.success && result.data?.watermarked_url) {
          // Replace URL with watermarked version
          image.src = result.data.watermarked_url
          image.watermarked = true
        } else {
          watermarkErrors.value.push(`Image ${image.id}: ${result.error || 'Unknown error'}`)
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      watermarkErrors.value.push(`Image ${image.id}: ${errorMsg}`)
    }

    completed++
    watermarkProgress.value = Math.round((completed / total) * 100)
  }

  isWatermarking.value = false

  if (watermarkErrors.value.length > 0) {
    watermarkStatus.value = 'failed'
    isWatermarkErrorModalOpen.value = true
  } else {
    watermarkStatus.value = 'completed'
    toast.add({
      title: 'Watermarking Complete',
      description: `Successfully watermarked ${total} image(s)`,
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
  }
}

// ========== Variant Management Functions ==========

// Fetch variant attributes from WooCommerce
async function fetchVariantAttributes() {
  if (selectedCategories.value.length === 0) {
    variantAttributes.value = []
    return
  }

  isFetchingVariants.value = true
  try {
    const categoryIds = selectedCategories.value.map(c => Number(c.id))
    const response = await $fetch('/api/woocommerce/variant-attributes', {
      method: 'POST',
      body: { category_ids: categoryIds },
    })

    if (response && typeof response === 'object' && 'attributes' in response) {
      const data = response as { attributes: Record<string, string[]> }

      // Transform API response to editable state structure
      variantAttributes.value = Object.entries(data.attributes)
        .filter(([_, values]) => values.length > 0)  // Skip empty attributes
        .map(([name, values]) => ({
          name,
          values: values.map(v => ({
            name: v,
            price: uploadForm.price || 0,
            selected: true,
          })),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))  // Sort alphabetically

      const attrCount = variantAttributes.value.length
      const valueCount = variantAttributes.value.reduce((sum, attr) => sum + attr.values.length, 0)

      if (attrCount > 0) {
        toast.add({
          title: 'Attributes Found',
          description: `Found ${attrCount} attribute${attrCount > 1 ? 's' : ''} with ${valueCount} value${valueCount > 1 ? 's' : ''}`,
          color: 'success',
          icon: 'i-heroicons-check-circle',
        })
      }
    }
  } catch (error) {
    console.error('Error fetching variant attributes:', error)
    toast.add({
      title: 'Could not fetch attributes',
      description: 'You can still add attributes manually',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle',
    })
    variantAttributes.value = []
  } finally {
    isFetchingVariants.value = false
  }
}

// Add a new attribute group
function addAttribute() {
  variantAttributes.value.push({
    name: '',
    values: [{
      name: '',
      price: uploadForm.price || 0,
      selected: true,
    }],
  })
}

// Add a new value to an attribute
function addAttributeValue(attributeIndex: number) {
  if (attributeIndex < 0 || attributeIndex >= variantAttributes.value.length) {
    return
  }
  const attr = variantAttributes.value[attributeIndex]
  if (attr) {
    attr.values.push({
      name: '',
      price: uploadForm.price || 0,
      selected: true,
    })
  }
}

// Delete an entire attribute group
function deleteAttribute(index: number) {
  if (index < 0 || index >= variantAttributes.value.length) {
    return
  }
  variantAttributes.value.splice(index, 1)
  toast.add({
    title: 'Attribute Removed',
    description: 'Attribute group removed from list',
    color: 'neutral',
    icon: 'i-heroicons-trash',
  })
}

// Delete a specific value within an attribute
function deleteAttributeValue(attributeIndex: number, valueIndex: number) {
  if (attributeIndex < 0 || attributeIndex >= variantAttributes.value.length) {
    return
  }
  const attr = variantAttributes.value[attributeIndex]
  if (attr) {
    if (valueIndex < 0 || valueIndex >= attr.values.length) {
      return
    }
    attr.values.splice(valueIndex, 1)
    // Remove attribute if no values left
    if (attr.values.length === 0) {
      variantAttributes.value.splice(attributeIndex, 1)
    }
  }
}

// Watch for file selection changes and auto-upload
watch(selectedFiles, (newFiles) => {
  if (newFiles?.length) {
    uploadFiles(newFiles)
    selectedFiles.value = []
  }
})
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
          <UStepper v-model="currentStep" :items="stepperItems" />

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

          <!-- Step 2: Categories & Price -->
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

            <!-- Categories -->
            <UFormField label="Categories">
              <USelectMenu
                v-model="selectedCategories"
                v-model:open="isCategoryDropdownOpen"
                multiple
                :items="categories as any"
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

              <!-- Selected category badges with remove buttons -->
              <div v-if="selectedCategories.length" class="flex flex-wrap gap-2 mt-2">
                <UBadge
                  v-for="category in selectedCategories"
                  :key="typeof category === 'string' ? category : category.id"
                  color="neutral"
                  variant="subtle"
                  class="cursor-default"
                >
                  {{ getCategoryDisplayName(category) }}
                  <button
                    type="button"
                    class="ml-1 hover:text-red-500 dark:hover:text-red-400"
                    :aria-label="`Remove ${getCategoryDisplayName(category)}`"
                    @click.stop="removeCategory(category)"
                  >
                    <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                  </button>
                </UBadge>
              </div>
            </UFormField>
          </div>

          <!-- Step 3: Variants -->
          <div v-show="currentStep === 3" class="space-y-4">
            <!-- Loading state -->
            <div v-if="isFetchingVariants" class="flex items-center justify-center py-8">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary" />
              <span class="ml-2">Fetching attributes from WooCommerce...</span>
            </div>

            <!-- No categories selected -->
            <div v-else-if="selectedCategories.length === 0" class="text-center py-8 border-2 border-dashed rounded-lg">
              <UIcon name="i-heroicons-swatch" class="w-12 h-12 mx-auto text-muted mb-2" />
              <p class="text-muted">No categories selected</p>
              <p class="text-sm text-muted-foreground mb-4">Go back and select categories to fetch suggested attributes</p>
              <UButton
                icon="i-heroicons-arrow-left"
                size="sm"
                @click="prevStep"
              >
                Go to Categories
              </UButton>
            </div>

            <!-- Empty state -->
            <div v-else-if="variantAttributes.length === 0" class="text-center py-8 border-2 border-dashed rounded-lg">
              <UIcon name="i-heroicons-swatch" class="w-12 h-12 mx-auto text-muted mb-2" />
              <p class="text-muted">No variant attributes found</p>
              <p class="text-sm text-muted-foreground mb-4">Add attributes manually to create a variable product</p>
              <UButton
                icon="i-heroicons-plus"
                size="sm"
                @click="addAttribute"
              >
                Add Attribute
              </UButton>
            </div>

            <!-- Grouped attributes list -->
            <div v-else class="space-y-6">
              <!-- Header with add button -->
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-medium">Variant Attributes</h3>
                  <p class="text-xs text-muted">
                    {{ variantAttributes.length }} attribute{{ variantAttributes.length > 1 ? 's' : '' }},
                    {{ variantAttributes.reduce((sum, attr) => sum + attr.values.filter(v => v.selected).length, 0) }} selected value{{ variantAttributes.reduce((sum, attr) => sum + attr.values.filter(v => v.selected).length, 0) !== 1 ? 's' : '' }}
                  </p>
                </div>
                <UButton
                  icon="i-heroicons-plus"
                  size="sm"
                  @click="addAttribute"
                >
                  Add Attribute
                </UButton>
              </div>

              <!-- Attribute groups -->
              <div
                v-for="(attribute, attrIndex) in variantAttributes"
                :key="attrIndex"
                class="border rounded-lg overflow-hidden"
              >
                <!-- Attribute header -->
                <div class="bg-muted/50 px-4 py-3 flex items-center justify-between">
                  <div class="flex-1">
                    <UInput
                      v-model="attribute.name"
                      placeholder="Attribute name (e.g., Color, Size)"
                      size="sm"
                      class="font-medium"
                    />
                  </div>
                  <UButton
                    icon="i-heroicons-trash"
                    size="xs"
                    color="error"
                    variant="ghost"
                    class="ml-2"
                    @click="deleteAttribute(attrIndex)"
                  />
                </div>

                <!-- Attribute values -->
                <div class="p-4 space-y-3">
                  <div
                    v-for="(value, valueIndex) in attribute.values"
                    :key="valueIndex"
                    class="flex items-center gap-3"
                  >
                    <!-- Checkbox -->
                    <UCheckbox
                      v-model="value.selected"
                      :disabled="attribute.values.length === 1"
                    />

                    <!-- Value name -->
                    <UInput
                      v-model="value.name"
                      placeholder="Value name (e.g., Red, M)"
                      size="sm"
                      class="flex-1"
                    />

                    <!-- Price -->
                    <UInputNumber
                      v-model="value.price"
                      placeholder="Price"
                      size="sm"
                      :increment="false"
                      :decrement="false"
                      class="w-32"
                    />

                    <!-- Delete button -->
                    <UButton
                      icon="i-heroicons-x-mark"
                      size="xs"
                      color="error"
                      variant="ghost"
                      :disabled="attribute.values.length === 1"
                      @click="deleteAttributeValue(attrIndex, valueIndex)"
                    />
                  </div>

                  <!-- Add value button -->
                  <UButton
                    icon="i-heroicons-plus"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="addAttributeValue(attrIndex)"
                  >
                    Add Value
                  </UButton>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 1: Media -->
          <div v-show="currentStep === 1" class="space-y-4">
            <!-- File Upload -->
            <UFormField label="Upload New Images">
              <UFileUpload
                v-model="selectedFiles"
                accept="image/*"
                multiple
                :max-size="32 * 1024 * 1024"
                size="md"
                color="primary"
                class="w-full"
              >
                <template #label>
                  <span>Click to upload or drag and drop images here</span>
                </template>
                <template #description>
                  <span>JPG, PNG, GIF, WebP up to 32MB each</span>
                </template>
              </UFileUpload>
            </UFormField>

            <!-- Uploading Files with Progress -->
            <div v-if="uploadingFiles.length > 0" class="space-y-2">
              <p class="text-sm font-medium">Uploading...</p>
              <div
                v-for="(file, index) in uploadingFiles"
                :key="`uploading-${index}`"
                class="p-3 border rounded-lg space-y-2"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm truncate">{{ file.name }}</span>
                  <span class="text-xs text-muted">{{ uploadProgress[index] }}%</span>
                </div>
                <UProgress
                  :value="uploadProgress[index]"
                  :max="100"
                  color="primary"
                  size="sm"
                />
              </div>
            </div>

            <!-- Unified Image Grid with Drag & Drop -->
            <div v-if="allImages.length > 0">
              <p class="text-sm font-medium mb-2">
                Images ({{ allImages.length }}) - Drag to reorder
              </p>
              <div class="grid grid-cols-2 gap-3">
                <div
                  v-for="(image, index) in allImages"
                  :key="image.id"
                  draggable="true"
                  @dragstart="onDragStart(index, $event)"
                  @dragover.prevent
                  @dragenter.prevent
                  @drop="onDrop(index, $event)"
                  @dragend="onDragEnd"
                  :class="[
                    'relative p-2 border rounded-lg transition-all',
                    draggedIndex === index ? 'opacity-50 scale-95' : 'hover:border-primary'
                  ]"
                  class="group"
                >
                  <!-- Drag Handle -->
                  <div class="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move z-10">
                    <div class="bg-gray-200 dark:bg-gray-700 rounded p-1">
                      <UIcon name="i-heroicons-bars-3" class="w-4 h-4" />
                    </div>
                  </div>

                  <!-- Image Preview -->
                  <div class="cursor-pointer" @click="openImagePreview(image.src)">
                    <img
                      :src="image.src"
                      :alt="`Image ${index + 1}`"
                      class="w-full aspect-square object-cover rounded hover:opacity-80 transition-opacity"
                      draggable="false"
                      @error="onImageLoadError(image.src)"
                    >
                  </div>

                  <!-- Position Badge -->
                  <div class="absolute top-2 right-12 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                    {{ index + 1 }}
                  </div>

                  <!-- Delete Button -->
                  <UButton
                    icon="i-heroicons-x-mark"
                    size="sm"
                    color="error"
                    variant="solid"
                    class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    @click="deleteImage(index)"
                  />
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div v-else class="text-center py-8 border-2 border-dashed rounded-lg">
              <UIcon name="i-heroicons-photo" class="w-12 h-12 mx-auto text-muted mb-2" />
              <p class="text-muted">No images selected</p>
              <p class="text-sm text-muted-foreground">Upload images to get started</p>
            </div>
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
          <img :src="previewImage" alt="Full size preview" class="max-w-full max-h-[70vh] object-contain rounded">
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
