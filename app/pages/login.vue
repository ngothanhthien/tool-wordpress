<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'
import { AuthRepository } from '~/repositories/supabase/auth'

definePageMeta({
  layout: 'centered',
})

const toast = useToast()
const router = useRouter()
const client = useSupabaseClient()
const authRepository = new AuthRepository(client)

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'Enter your email',
    required: true,
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    required: true,
  },
]

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})

type Schema = z.output<typeof schema>

const isLoading = ref(false)

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  isLoading.value = true
  try {
    const result = await authRepository.login({
      email: payload.data.email,
      password: payload.data.password,
    })

    if (result.success) {
      toast.add({
        title: 'Success',
        description: result.message,
        color: 'success',
      })
      router.push('/')
    } else {
      toast.add({
        title: 'Error',
        description: result.message,
        color: 'error',
      })
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 p-4 min-h-screen">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="schema"
        title="Login"
        description="Enter your credentials to access your account."
        icon="i-heroicons-lock-closed"
        :fields="fields"
        :loading="isLoading"
        submit-label="Sign in"
        @submit="onSubmit"
      />
    </UPageCard>
  </div>
</template>
