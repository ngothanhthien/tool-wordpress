<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// Resolve components at module level to avoid hydration mismatches
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')

const route = useRoute()
const user = useSupabaseUser()
const supabase = useSupabaseClient()

// Sidebar navigation items - reactive based on current route
const items = computed<NavigationMenuItem[][]>(() => [
  [
    {
      label: 'Dashboard',
      icon: 'i-lucide-layout-dashboard',
      to: '/',
      active: route.path === '/'
    },
    {
      label: 'Products',
      icon: 'i-lucide-package',
      to: '/products',
      active: route.path === '/products'
    }
  ]
])

// Computed for user display
const userEmail = computed(() => user.value?.user_metadata?.email || user.value?.email)

// Handle logout
const toast = useToast()

async function handleLogout() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    toast.add({
      title: 'Error',
      description: error.message,
      color: 'error'
    })
  }
}
</script>

<template>
  <UDashboardGroup>
    <!-- Sidebar -->
    <UDashboardSidebar collapsible>
      <template #header="{ collapsed }">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shrink-0">
            <UIcon name="i-lucide-box" class="w-5 h-5" />
          </div>
          <div v-if="!collapsed">
            <h1 class="font-semibold text-sm">Tool WP</h1>
            <p class="text-xs text-muted-foreground">Product Manager</p>
          </div>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="items[0]"
          orientation="vertical"
        />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground shrink-0">
            <UIcon name="i-lucide-user" class="w-4 h-4" />
          </div>
          <div v-if="!collapsed" class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ userEmail }}</p>
            <p class="text-xs text-muted-foreground">Logged in</p>
          </div>
          <UButton
            v-if="!collapsed"
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Logout"
            @click="handleLogout"
          />
        </div>
      </template>
    </UDashboardSidebar>

    <!-- Main content area -->
    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar :title="items[0]?.find((i) => i.active)?.label ?? 'Dashboard'" />
      </template>

      <div class="p-6">
        <slot />
      </div>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
