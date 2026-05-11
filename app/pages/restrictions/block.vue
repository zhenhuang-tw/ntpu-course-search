<script setup lang="ts">
/**
 * app/pages/restrictions/block.vue
 * 課程擋修規定 (必須先修過某課程, block restrictions) 頁面
 */
const route = useRoute()
const router = useRouter()

// 1. 定義 API 回傳介面
interface BlockResponse {
  success: boolean
  message: string
  data: {
    title: string
    department: string
    courseCode: string
    rules: Array<{
      blockedCourse: string
      prerequisite: { dept: string, course: string, semester: string, credits: string, gradeLimit: string }
      logic: { group: string, option: string }
      target: { method: string, college: string, dept: string, division: string, class: string }
    }>
  } | null
}

// 2. 獲取資料 (使用重構後的參數 department, course)
const { data: response, pending, error } = await useFetch<BlockResponse>('/api/restrictions/block', {
  query: {
    department: route.query.department,
    course: route.query.course
  }
})

const blockData = computed(() => response.value?.data)

// 3. 設定標題
useHead({
  title: computed(() => blockData.value?.title 
    ? `${blockData.value.title} - 擋修規定` 
    : '擋修規定載入中')
})
</script>

<template>
  <div class="container" style="padding-top: 2rem; padding-bottom: 2rem;">
    
    <nav aria-label="breadcrumb">
      <ul>
        <li><NuxtLink to="/">搜尋課程</NuxtLink></li>
        <li><a href="javascript:void(0)" @click.prevent="router.back()">返回上一頁</a></li>
        <li>擋修規定</li>
      </ul>
    </nav>

    <div v-if="pending" aria-busy="true">正在獲取擋修規定...</div>
    
    <div v-else-if="error || !response?.success">
      <article class="pico-background-pink-100">
        <header><strong>查詢失敗</strong></header>
        <p>{{ response?.message || '校方系統連線異常。' }}</p>
        <button @click="() => $router.back()">回到上一頁</button>
      </article>
    </div>

    <div v-else-if="blockData">
      
      <hgroup>
        <h1>{{ blockData.title }}</h1>
        <p>本課程之先修條件與擋修限制</p>
      </hgroup>

      <div v-if="blockData.rules.length === 0">
        <article class="pico-background-azure-100">
          <p>此課程目前查無明確的先修擋修規則。</p>
        </article>
      </div>

      <div v-else>
        <article v-for="(rule, idx) in blockData.rules" :key="idx" class="rule-card">
          <header>
            <strong>先修科目：<ins>{{ rule.prerequisite.course }}</ins></strong>
          </header>
          
          <div class="grid">
            <div>
              <small style="color: var(--pico-secondary);">【修課條件】</small>
              <ul class="condition-list">
                <li><span class="label">開課系所：</span>{{ rule.prerequisite.dept }}</li>
                <li><span class="label">適用學期：</span>{{ rule.prerequisite.semester }}</li>
                <li><span class="label">學分要求：</span>{{ rule.prerequisite.credits }}</li>
                <li><span class="label">成績限制：</span>須 {{ rule.prerequisite.gradeLimit }} 分以上</li>
                <li><span class="label">擋修選項：</span><span data-tooltip="選項所屬組別代號">{{ rule.logic.group }}</span>. {{ rule.logic.option }}</li>
              </ul>
            </div>

            <div>
              <small style="color: var(--pico-secondary);">【限制對象】</small>
              <div class="target-box">
                <p><strong>方式：</strong> <mark>{{ rule.target.method }}</mark></p>
                <hr style="margin: 0.5rem 0;" />
                <ul class="target-details">
                  <li><span class="target-label">院別：</span>{{ rule.target.college }}</li>
                  <li><span class="target-label">系所：</span>{{ rule.target.dept }}</li>
                  <li><span class="target-label">學部：</span>{{ rule.target.division }}</li>
                  <li><span class="target-label">班別：</span>{{ rule.target.class }}</li>
                </ul>
              </div>
            </div>
          </div>
        </article>
      </div>

      <footer style="margin-top: 2rem;">
        <hr />
        <small>成績限制若為 0，通常代表該先修科目只需要「曾修習過」，詳情請洽教務單位與各教學單位辦公室。</small>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.rule-card {
  border-top: 4px solid var(--pico-primary);
}

.condition-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0 0;
  font-size: 0.9rem;
}

.condition-list li {
  margin-bottom: 0.25rem;
}

.label {
  font-weight: bold;
  color: var(--pico-primary);
  margin-right: 4px;
}

.target-box {
  background-color: var(--pico-code-background-color);
  padding: 1rem;
  border-radius: 8px;
  margin-top: 0.5rem;
}

.target-details {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.85rem;
}

.target-label {
  display: inline-block;
  width: 3.5rem;
  color: var(--pico-secondary);
  font-weight: bold;
}

.rule-card header {
  background-color: var(--pico-card-sectionning-background-color);
}
</style>