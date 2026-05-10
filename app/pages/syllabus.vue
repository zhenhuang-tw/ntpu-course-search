<script setup lang="ts">
/**
 * 課程大綱頁面
 * 採用 Pico CSS (Class 版本) 與原生 HTML 語意化標籤實作響應式佈局
 */
const route = useRoute()
const router = useRouter()

// 1. 定義 API 回傳介面，對齊扁平化與物件化的新結構
interface MethodItem {
  name: string
  checked: boolean
  value?: string
}

interface SyllabusResponse {
  success: boolean
  message: string
  data: {
    basic: {
      course: string, year: string, term: string, titleZh: string, titleEn: string,
      major: Array<{ grade: string, hasEnterLimit: boolean, enterLimitUrl: string, enterLimitCode: string[] }>,
      teacher: string, duration: string, credits: string, hours: string
    }
    objectives: string
    outline: string
    textbook: string
    references: string
    evaluation: {
      regular: { percentage: number, methods: MethodItem[] }
      midterm: { percentage: number, methods: MethodItem[] }
      final: { percentage: number, methods: MethodItem[] }
      note: string
    }
    schedule: {
      teachingWeeks: Array<{ week: string, date: string, content: string, methods: string }>
      showExtraWeeks: boolean
      showFlexible: boolean
      flexibleLearning: {
        methods: Array<{ teachingWay: string, hasThisWay: boolean }>
        description: string
      }
    }
  } | null
}

// 2. 獲取資料
const { data: response, pending, error } = await useFetch<SyllabusResponse>('/api/syllabus', {
  query: {
    course: route.query.course,
    year: route.query.year,
    term: route.query.term
  }
})

// 將資料引用重命名為 course 使原始碼更具語意性
const course = computed(() => response.value?.data)

// 3. 設定動態標題
useHead({
  title: computed(() => course.value?.basic.titleZh 
    ? `${course.value.basic.titleZh} - 課程大綱` 
    : '課程大綱載入中')
})
</script>

<template>
  <div class="container" style="padding-top: 2rem; padding-bottom: 2rem;">
    
    <div v-if="pending" aria-busy="true">正在獲取最新課程大綱...</div>
    <div v-else-if="error || !response?.success">
      <article class="pico-background-pink-100">
        <header><strong>發生錯誤</strong></header>
        <p>{{ response?.message || '無法連線至校方系統，請確認網址參數是否正確。' }}</p>
        <button class="secondary" @click="() => $router.back()">回上一頁</button>
      </article>
    </div>

    <div v-else-if="course">
      
      <hgroup>
        <h1>{{ course.basic.titleZh }}</h1>
        <p>{{ course.basic.year }} 學年度第 {{ course.basic.term }} 學期 ， 授課老師：{{ course.basic.teacher }} 老師</p>
      </hgroup>
      <p style="color: var(--pico-muted-color); font-size: 0.85rem;">{{ course.basic.titleEn }}</p>

      <nav aria-label="breadcrumb">
        <ul>
          <li><NuxtLink to="/">搜尋首頁</NuxtLink></li>
          <li><a href="javascript:void(0)" @click.prevent="router.back()" data-tooltip="返回瀏覽紀錄的上一頁">返回搜尋結果</a></li>
          <li>課程大綱</li>
        </ul>
      </nav>

      <hr />

      <div class="grid">
        
        <aside>
          
          <article>
            <header><strong>基本資訊</strong></header>
            <ul style="list-style-type: none; padding: 0; margin: 0; font-size: 0.9rem;">
              <li><strong>課號：</strong> <code style="display:inline;">{{ course.basic.course }}</code> (<a 
                :href="`https://sea.cc.ntpu.edu.tw/pls/dev_stud/course_query.queryguide?g_year=${course.basic.year}&g_term=${course.basic.term}&g_serial=${course.basic.course}&show_info=all`" 
                style="display:inline;" 
                class="secondary" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                校版大綱
              </a>)</li>
              <li>
                <strong>應修系級：</strong> 
                <span v-for="(item, idx) in course.basic.major" :key="idx">
                  {{ item.grade }}
                  <span v-if="item.hasEnterLimit">
                    <NuxtLink :to="item.enterLimitUrl" style="color: var(--pico-ins-color);display: inline;">
                      [擋]
                    </NuxtLink>
                  </span>
                  <span v-if="idx < course.basic.major.length - 1">, </span>
                </span>
              </li>
              <li><strong>修課期程：</strong> {{ course.basic.duration }}學年</li>
              <li><strong>學分：</strong> {{ course.basic.credits }} 學分</li>
              <li><strong>時數：</strong> {{ course.basic.hours }} 小時</li>
            </ul>
          </article>

        </aside>

        <section>
          
          <article>
            <header><strong>教學目標</strong></header>
            <p style="white-space: pre-wrap; font-size: 0.95rem;">{{ course.objectives || '無資料' }}</p>
          </article>

          <article>
            <header><strong>內容綱要</strong></header>
            <p style="white-space: pre-wrap; font-size: 0.95rem;">{{ course.outline || '無資料' }}</p>
          </article>

        </section>

      </div> <article>
        <header><strong>評量方式</strong></header>
        <div class="overflow-auto">
          <table class="striped" style="font-size: 0.85rem;">
            <thead>
              <tr>
                <th width="33.3%">平時 ({{ course.evaluation.regular.percentage }}%)</th>
                <th width="33.3%">期中 ({{ course.evaluation.midterm.percentage }}%)</th>
                <th width="33.3%">期末 ({{ course.evaluation.final.percentage }}%)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td v-for="(evalData, idx) in [course.evaluation.regular, course.evaluation.midterm, course.evaluation.final]" :key="'eval-'+idx">
                  <ul style="list-style: none; padding-left: 0; margin-bottom: 0;">
                    <li v-for="(method, mIdx) in evalData.methods" :key="'m-'+mIdx" 
                        :style="{ color: method.checked ? 'var(--pico-color)' : 'var(--pico-muted-color)', marginBottom: '0.25rem' }">
                      <label style="font-size: 0.85rem; margin-bottom: 0;">
                        <input type="checkbox" :checked="method.checked" disabled />
                        {{ method.name }}
                        <span v-if="method.value" style="color: var(--pico-primary);">({{ method.value }})</span>
                      </label>
                    </li>
                  </ul>
                </td>
              </tr>
              <tr v-if="course.evaluation.note">
                <td colspan="3" style="font-size: 0.8rem; color: var(--pico-muted-color);">
                  <strong>備註：</strong>{{ course.evaluation.note }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article>
        <header><strong>教學預定進度</strong></header>
        <div class="overflow-auto">
          <table class="striped" style="font-size: 0.85rem; min-width: 600px;">
            <thead>
              <tr>
                <th width="12%">週別</th>
                <th width="15%">日期</th>
                <th width="48%">教學預定進度</th>
                <th width="25%">教學方法與教學活動</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(week, rIdx) in course.schedule.teachingWeeks" :key="'week-'+rIdx">
                <tr v-if="course.schedule.showExtraWeeks || rIdx < 16">
                  <td style="white-space: pre-wrap;">{{ week.week }}</td>
                  <td style="white-space: pre-wrap;">{{ week.date }}</td>
                  <td style="white-space: pre-wrap;">{{ week.content }}</td>
                  <td style="white-space: pre-wrap;">{{ week.methods }}</td>
                </tr>
              </template>
              
              <tr v-if="course.schedule.showFlexible">
                <td colspan="2" style="text-align: center; font-weight: bold; vertical-align: middle;">
                  彈性補充教學
                </td>
                <td colspan="2">
                  <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
                    <label v-for="(way, wIdx) in course.schedule.flexibleLearning.methods" :key="'way-'+wIdx"
                           :style="{ color: way.hasThisWay ? 'var(--pico-color)' : 'var(--pico-muted-color)', fontSize: '0.8rem' }">
                      <input type="checkbox" :checked="way.hasThisWay" disabled /> {{ way.teachingWay }}
                    </label>
                  </div>
                  <div style="white-space: pre-wrap; background-color: var(--pico-code-background-color); padding: 0.5rem; border-radius: 4px; font-size: 0.85rem;">
                    {{ course.schedule.flexibleLearning.description }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
      
      <div class="grid">
          <details open>
            <summary><strong>指定用書</strong></summary>
            <p style="white-space: pre-wrap; font-size: 0.9rem;">{{ course.textbook || '無資料' }}</p>
          </details>

          <details open>
            <summary><strong>參考資料</strong></summary>
            <p style="white-space: pre-wrap; font-size: 0.9rem;">{{ course.references || '無資料' }}</p>
          </details>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* 針對長表格設定橫向捲動，確保手機版不會破版 */
.overflow-auto {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin-bottom: 1rem;
}

/* Pico CSS 卡片內容間距微調 */
article {
  margin-bottom: 1.5rem;
}

header {
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--pico-muted-border-color);
}
</style>