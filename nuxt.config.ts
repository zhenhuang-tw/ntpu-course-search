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
  runtimeConfig: {
    // 這裡定義僅限伺服器端 (server/api) 讀取的變數
    gasProxyUrl: process.env.NUXT_GAS_PROXY_URL || '', 
  },

  nitro: {
    preset: 'cloudflare-pages',
    prerender: {
      routes: ['/']
    }
  },
  
  // 定義路由規則
  routeRules: {
    // 針對搜尋結果頁面實施 30 分鐘 (1800 秒) 的 SWR 快取
    '/search': { 
      swr: 1800 
    }
  },
})
