// https://nuxt.com/docs/api/configuration/nuxt-config

const appName = '臺北大學課程查詢'
const appDomain = 'https://ntpu-course-search.pages.dev'

export default defineNuxtConfig({
  compatibilityDate: '2026-05-10',
  devtools: { enabled: true },
  css: ['@picocss/pico/css/pico.pumpkin.min.css'],
  
  app: {
    head: {
      htmlAttrs: {
        lang: 'zh-TW'
      },
      titleTemplate: '%s - ' + appName,
      title: '響應式的課程查詢系統',
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1'
        }
      ]
    }
  },

  nitro: {
    preset: 'cloudflare_pages',
    prerender: {
      routes: ['/']
    }
  }
})
