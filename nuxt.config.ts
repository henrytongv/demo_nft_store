export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [
      {
        code: 'es',
        name: 'Español',
        language: 'es-ES',
        file: 'es.json'
      }
    ],
    defaultLocale: 'es',
    strategy: 'no_prefix',
    langDir: 'locales',
    detectBrowserLanguage: false
  },
  runtimeConfig: {
    public: {
      appName: 'Tienda del aventurero'
    }
  }
})
