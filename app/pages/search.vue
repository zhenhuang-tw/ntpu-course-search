<script setup lang="ts">
/**
 * 課程搜尋結果頁面
 * 接收路由參數並呼叫後端 API 進行資料展示
 */
const route = useRoute()

// 1. 動態設定頁面標題與 SEO
const searchDisplayTitle = computed(() => {
  const { year, term, courseName, teacherName } = route.query
  const parts = []
  if (year) parts.push(`${year}學年度`)
  if (term) parts.push(`第${term}學期`)
  if (teacherName) parts.push(`${teacherName}老師`)
  if (courseName) parts.push(`搜尋：${courseName}`)
  
  return parts.length > 0 ? parts.join(' ') : '課程搜尋結果'
})

useHead({
  title: searchDisplayTitle.value
})

// 2. 獲取資料 (使用語意化後的 Query 參數)
interface CourseResponse {
  success: boolean
  message: string
  data: any[] // 未來改善時，亦可考慮把 any[] 換成完整的 Course 型別定義
}

const { data: result, pending, error } = await useFetch<CourseResponse>('/api/courses', {
  query: {
    year: route.query.year,
    term: route.query.term,
    courseCode: route.query.courseCode,
    courseName: route.query.courseName,
    teacherName: route.query.teacherName,
    dayOfWeek: route.query.dayOfWeek,
    startSlot: route.query.startSlot,
    endSlot: route.query.endSlot
  }
})

// 3. 選課資訊 Dialog 控制
const selectedInfo = ref<string | null>(null)
const isDialogOpen = ref(false)

const openDialog = (text: string) => {
  selectedInfo.value = text
  isDialogOpen.value = true
}

const closeDialog = () => {
  isDialogOpen.value = false
}

// 4. 判斷是否顯示學年/學期欄位 (若搜尋條件已固定則不重複顯示)
const showYearColumn = computed(() => !route.query.year)
const showTermColumn = computed(() => !route.query.term)
</script>

<template>
  <section>
    <hgroup class="container">
      <h1>搜尋結果</h1>
      <p>條件：{{ searchDisplayTitle }}</p>
    </hgroup>

    
    <div v-if="pending" aria-busy="true" class="container">正在從校方系統獲取最新課程資料...</div>

    <div v-else-if="error || !result?.success" class="container">
      <article class="error">
        <p>無法取得資料：{{ result?.message || '校方系統連線逾時' }}</p>
        <button @click="() => $router.back()">回到首頁重試</button>
      </article>
    </div>

    <div v-else>
      <div class="container grid" style="margin-bottom: 1rem;">
        <p>找到 {{ result.data.length }} 筆課程</p>
        <div style="text-align: right;">
          <NuxtLink to="/" class="outline">重新查詢</NuxtLink>
        </div>
      </div>

      <figure id="course-list">
        <table class="striped">
          <thead>
            <tr>
              <th v-if="showYearColumn">學年</th>
              <th v-if="showTermColumn">學期</th>
              <th><span data-tooltip="開課系所、課號、授課語言">開課</span></th>
              <th>應修系級</th>
              <th>課程名稱</th>
              <th>教師</th>
              <th><span data-tooltip="全學年或半學年、學分數">學</span>/<span data-tooltip="繳費時數">時</span></th>
              <th>時間@地點</th>
              <th>名額</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="course in result.data" :key="course.courseCode">
              <td v-if="showYearColumn">{{ course.year }}</td>
              <td v-if="showTermColumn">{{ course.term }}</td>
              <td>
                {{ course.department }}
                <br /><code>{{ course.courseCode }}</code><br /><small>{{ course.language }}</small>
              </td>
              <td>
                <div v-for="(item, idx) in course.designatedFor" :key="idx">
                  {{ item.grade }}
                  <template v-if="item.hasEnterLimit">
                    <NuxtLink :to="item.enterLimitUrl" style="color: var(--pico-ins-color); display: inline;">
                       [擋]
                    </NuxtLink>
                  </template>
                  <small> ({{ item.type }})</small>
                </div>
              </td>
              <td>
                <div>
                  <strong>{{ course.title.zh }}</strong>
                  <template v-if="course.commonLimit.hasLimit">
                    <NuxtLink :to="course.commonLimit.limitUrl" title="課程限制說明">
                      <ins style="margin-left: 4px; text-decoration: none;">[限]</ins>
                    </NuxtLink>
                  </template>
                </div>
                <div style="font-size: 0.75rem; color: var(--pico-secondary);">{{ course.title.en }}</div>
                <div v-if="course.title.notice" style="font-size: 0.7rem; color: var(--pico-muted-color);">
                  備註：{{ course.title.notice }}
                </div>
                <div v-if="course.title.syllabusUrl" style="margin-top: 4px;">
                  <NuxtLink :to="course.title.syllabusUrl" class="secondary" style="font-size: 0.8rem;">
                    [查看大綱]
                  </NuxtLink>
                </div>
              </td>
              <td>
                <template v-for="(t, i) in course.teachers" :key="i">
                  <a :href="t.scheduleUrl" target="_blank" rel="noopener" style="display: block;">
                    {{ t.name }}
                  </a>
                </template>
              </td>
              <td style="white-space: nowrap;">{{ course.duration }}<small>學年</small>
              <br />{{ course.credits }} <small>學分</small>
              <br />{{ course.hours }} <small>小時</small></td>
              <td>{{ course.timeAndLocation.replace('每週', '\n').trim() }}</td>
              <!--  style="white-space: nowrap;" -->
              <td>
                <button 
                  class="outline contrast" 
                  style="padding: 2px 8px; font-size: 0.8rem; margin: 0;"
                  @click="openDialog(course.registrationInfo.statusText)"
                >
                  查
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </figure>
    </div>

    <dialog :open="isDialogOpen">
      <article>
        <header>
          <button aria-label="Close" rel="prev" @click="closeDialog"></button>
          <p><strong>選課人數統計</strong></p>
        </header>
        <p style="white-space: pre-wrap;">{{ selectedInfo }}</p>
        <footer>
          <button class="secondary" @click="closeDialog">關閉</button>
        </footer>
      </article>
    </dialog>
  </section>
</template>

<style scoped>

figure#course-list {
  max-width: 100% !important;
  width: 100% !important;
  /* 視需求調整內距，避免內容緊貼瀏覽器邊緣 */
  padding-left: 2vw;
  padding-right: 2vw;
}

/* 針對課程表格的微調 */
table {
  font-size: 0.85rem;
}

td {
  vertical-align: middle;
}

code {
  font-size: 0.8rem;
  padding: 2px 4px;
}

.error {
  border: 1px solid var(--pico-del-color);
}
</style>