<script setup lang="ts">
/**
 * app/pages/restrictions/course.vue
 * course restrictions (限修) frontend page
 */
const route = useRoute()
const router = useRouter()

// 1. 定義 API 回傳介面
interface RestrictionResponse {
  success: boolean
  message: string
  data: {
    noRestriction: boolean
    yearterm: string
    course: string
    title?: string
    mode?: string
    rules?: Array<{ category: string, conditions: string[] }>
  } | null
}

// 2. 獲取資料
const { data: response, pending, error } = await useFetch<RestrictionResponse>('/api/restrictions/course', {
  query: {
    yearterm: route.query.yearterm,
    course: route.query.course
  }
})

const restriction = computed(() => response.value?.data)

// 3. SEO 標題，包含學期、課名
useHead({
  title: computed(() => restriction.value?.title 
    ? `${restriction.value.yearterm}「${restriction.value.title}」課程限修規定` 
    : '限修規定載入中')
})
</script>

<template>
  <div class="container" style="padding-top: 2rem; padding-bottom: 2rem;">
    
    <nav aria-label="breadcrumb">
      <ul>
          <li><NuxtLink to="/">搜尋課程</NuxtLink></li>
          <li><a href="javascript:void(0)" @click.prevent="router.back()" data-tooltip="返回瀏覽紀錄的上一頁">返回搜尋結果</a></li>
        <li>限修規定</li>
      </ul>
    </nav>

    <div v-if="pending" aria-busy="true">正在從系統獲取限修資料...</div>
    
    <div v-else-if="error || !response?.success">
      <article class="pico-background-pink-100">
        <header><strong>查詢失敗</strong></header>
        <p>{{ response?.message || '校方系統連線異常，請稍後再試。' }}</p>
        <button @click="() => $router.back()">回到上一頁</button>
      </article>
    </div>

    <div v-else-if="restriction">
      
      <hgroup>
        <h1 v-if="!restriction.noRestriction">{{ restriction.title }}</h1>
        <h1 v-else>限修 Course Restrictions</h1>
        <p>
          學期：{{ restriction.yearterm }} ． 
          課號：<code style="display: inline;">{{ restriction.course }}</code>
        </p>
      </hgroup>

      <article v-if="restriction.noRestriction" class="pico-background-azure-100" style="text-align: center; padding: 3rem;">
        <p style="font-size: 1.5rem; margin-bottom: 0;">✅ 此課程不設限。</p>
      </article>

      <div v-else>
        <article style="border-left: 8px solid var(--pico-ins-color); margin-bottom: 2rem;">
          <h4 style="margin-bottom: 0;">
            限修模式：<ins>{{ restriction.mode }}</ins>
          </h4>
          <small>
            <template v-if="restriction.mode === '限特定對象修習'">
              您必須具備以下身分，才可以修習
            </template>
            <template v-else-if="restriction.mode === '限特定對象不得修習'">
              您如果具備以下身分，則<strong>不可</strong>修習
            </template>
          </small>
        </article>

        <div class="rules-container">
          <article v-for="(rule, idx) in restriction.rules" :key="idx" style="margin-bottom: 1.5rem;">
            <header style="margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--pico-muted-border-color);">
              <strong>{{ rule.category }}</strong>
            </header>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              <span 
                v-for="(cond, cIdx) in rule.conditions" 
                :key="cIdx"
                class="rule-tag"
              >
                {{ cond }}
              </span>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 自定義規則標籤樣式 */
.rule-tag {
  background-color: var(--pico-secondary-background);
  color: var(--pico-secondary-inverse);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  border: 1px solid var(--pico-muted-border-color);
}

.rules-container article {
  padding: 1rem;
}

kbd {
  font-family: var(--pico-font-family-monospace);
  padding: 2px 6px;
  background-color: var(--pico-code-background-color);
}
</style>