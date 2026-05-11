<script setup lang="ts">
/**
 * 全域佈局
 * 整合 Pico CSS 亮暗色模式切換邏輯
 */

// 主題狀態：'light' | 'dark' | 'auto'
const theme = ref('auto')

// 切換主題功能
const toggleTheme = () => {
  const target = theme.value === 'dark' ? 'light' : 'dark'
  theme.value = target
  updateHtmlTheme(target)
}

// 更新 HTML 標籤屬性
const updateHtmlTheme = (currentTheme: string) => {
  if (import.meta.client) {
    document.documentElement.setAttribute('data-theme', currentTheme)
    // 將偏好儲存在本地
    localStorage.setItem('user-theme', currentTheme)
  }
}

onMounted(() => {
  // 1. 優先讀取先前儲存的偏好
  const savedTheme = localStorage.getItem('user-theme')
  
  if (savedTheme) {
    theme.value = savedTheme
    updateHtmlTheme(savedTheme)
  } else {
    // 2. 若無儲存偏好，則跟隨系統 (Pico CSS 預設即支援媒體查詢，此處確保狀態同步)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    theme.value = prefersDark ? 'dark' : 'light'
    // 不主動 setAttribute 以利瀏覽器自動切換，或強制同步：
    updateHtmlTheme(theme.value)
  }
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    
    <header class="container">
      <nav>
        <ul>
          <li>
            <NuxtLink to="/"><strong>臺北大學課程查詢</strong></NuxtLink>
          </li>
        </ul>
        <ul>
          <li>
            <NuxtLink to="/">
              搜尋<span class="desktop-only">課程</span>
            </NuxtLink>
          </li>
          <li class="desktop-only">
            <a 
              href="https://sea.cc.ntpu.edu.tw/pls/dev_stud/course_query_all.CHI_MAIN" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              校版系統
            </a>
          </li>
          <li>
            <button 
              class="outline contrast" 
              @click="toggleTheme" 
              style="padding: 4px 8px; margin-bottom: 0;"
            >
              <span v-if="theme === 'dark'">☀️ 亮<span class="desktop-only">色</span></span>
              <span v-else>🌙 暗<span class="desktop-only">色</span></span>
            </button>
          </li>
        </ul>
      </nav>
    </header>

    <main>
      <article class="global-disclaimer container">
        <small>
          這不是國立臺北大學製作的課程查詢系統，不保證資訊正確無誤，請以資訊中心製作的
          <NuxtLink to="https://sea.cc.ntpu.edu.tw/pls/dev_stud/course_query_all.CHI_MAIN" target="_blank" external rel="noopener noreferrer">校版課程查詢系統</NuxtLink>
          中，課務組、進修教育組提供的正式資料為準。
        </small>
      </article>

      <NuxtPage />
    </main>

    <footer class="container">
      <hr />
      <p>
        <NuxtLink 
          to="https://github.com/zhenhuang-tw/ntpu-course-search" 
          target="_blank" 
          external
          rel="noopener noreferrer"
        >
          GitHub
        </NuxtLink>
      </p>
    </footer>
  </div>
</template>

<style>
main {
  padding-top: 1rem;
}
/* 警語區塊樣式微調 */
.global-disclaimer {
  margin-bottom: 0.5rem;
  padding: 1rem;
  border-left: 4px solid var(--pico-secondary-border);
  background-color: var(--pico-card-background-color);
}

/* 確保按鈕在導航列中的垂直對齊 */
nav ul li button {
  font-size: 0.8rem;
}

/* Pico 的 md breakpoint 是 768px */
@media (max-width: 768px) {
  .desktop-only {
    display: none;
  }
}
</style>