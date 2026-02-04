import tailwindcss from "@tailwindcss/vite"

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['./app/assets/css/main.css'],
  modules: [
    '@nuxt/content',
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/supabase'
  ],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: [],
    },
  },
  runtimeConfig: {
    // Server-side only (private) - can use process.env
    wooCommerceUrl: process.env.WOOCOMMERCE_URL,
    wooCommerceConsumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY,
    wooCommerceConsumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET,
    imgbbApiKey: process.env.IMGBB_API_KEY,
    supabase: {
      url: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    // Watermark microservice configuration
    watermarkApiKey: process.env.WATERMARK_API_KEY || '',
    watermarkBaseUrl: process.env.WATERMARK_BASE_URL || 'http://localhost:8005',
    // Public keys (optional, if needed client-side)
    public: {},
  },
})
