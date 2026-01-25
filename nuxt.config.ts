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
    // Public keys (optional, if needed client-side)
    public: {},
  },
})
