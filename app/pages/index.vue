<script setup lang="ts">
/**
 * app/pages/index.vue
 * 課程查詢頁面
 * 提供一個 HTML Form 讓使用者提供查詢條件
 */
const router = useRouter()

// 1. 依現在時間推算預設學年度與學期
// 預設規則：
//   x年 8/3 ~ 12/15  → 第 1 學期，學年度 = x - 1911
//   x年 12/16 ~ 隔年 8/2 → 第 2 學期，學年度 = x - 1911（跨年後仍取 12/16 所在之西元年）
// 注意：此非精確之提供查詢時間，蓋學校每年運作不同。
const getDefaultYearTerm = (): { year: string; term: string } => {
  const now = new Date()
  const month = now.getMonth() + 1 // 1–12
  const day = now.getDate()

  // 將日期壓縮為 MMDD 整數，方便範圍比較
  const mmdd = month * 100 + day

  if (mmdd >= 803 && mmdd <= 1215) {
    // 可查第 1 學期：x年 8/3 ~ 12/15
    return {
      year: String(now.getFullYear() - 1911),
      term: '1',
    }
  } else if (mmdd >= 1216) {
    // 可查第 2 學期（年底）：x年 12/16 ~ 12/31
    return {
      year: String(now.getFullYear() - 1911),
      term: '2',
    }
  } else {
    // 前半第 2 學期（跨年）：x年 1/1 ~ 8/2，學年度屬於前一西元年
    return {
      year: String(now.getFullYear() - 1 - 1911),
      term: '2',
    }
  }
}

// 2. 定義語意化表單狀態
const searchForm = reactive({
  ...getDefaultYearTerm(),
  courseCode: '',
  courseName: '',
  teacherName: '',
  dayOfWeek: '',
  startSlot: 'A',
  endSlot: 'M'
})

// 3. 生成年份選項
const currentYear = 114
const startYear = 90
const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => {
  return (currentYear - i).toString().padStart(3, '0')
})

// 4. 節次定義
const timeSlots = [
  { val: 'A', label: '1 (08:10~09:00)' },
  { val: 'B', label: '2 (09:10~10:00)' },
  { val: 'C', label: '3 (10:10~11:00)' },
  { val: 'D', label: '4 (11:10~12:00)' },
  { val: 'E', label: '5 (13:10~14:00)' },
  { val: 'F', label: '6 (14:10~15:00)' },
  { val: 'G', label: '7 (15:10~16:00)' },
  { val: 'H', label: '8 (16:10~17:00)' },
  { val: 'I', label: '9 (17:10~18:00)' },
  { val: 'J', label: 'A (18:30~19:20)' },
  { val: 'K', label: 'B (19:25~20:15)' },
  { val: 'L', label: 'C (20:25~21:15)' },
  { val: 'M', label: 'D (21:20~22:10)' }
]

// 5. 提交處理
const submitSearch = () => {
  router.push({
    path: '/search',
    query: { ...searchForm }
  })
}

// 6. 重置處理
const resetForm = () => {
  Object.assign(searchForm, {
    ...getDefaultYearTerm(),
    courseCode: '',
    courseName: '',
    teacherName: '',
    dayOfWeek: '',
    startSlot: 'A',
    endSlot: 'M'
  })
}

// 7. 控制說明彈窗
const isGuideVisible = ref(false)
</script>

<template>
  <section class="container">
    <hgroup>
      <h1>課程搜尋</h1>
      <p>請輸入查詢條件，開始探索學期課程</p>
    </hgroup>

    <form @submit.prevent="submitSearch">
      <div class="grid">
        <label for="year">
          學年度
          <select id="year" v-model="searchForm.year">
            <option value="">全部</option>
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
        </label>

        <label for="term">
          學期
          <select id="term" v-model="searchForm.term">
            <option value="">全部</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
      </div>

      <div class="grid">
        <label for="courseCode">
          課程流水碼
          <input type="text" id="courseCode" v-model="searchForm.courseCode" placeholder="如：M6135" />
        </label>
        <label for="courseName">
          課程名稱
          <input type="text" id="courseName" v-model="searchForm.courseName" placeholder="關鍵字搜尋" />
        </label>
        <label for="teacherName">
          教師姓名
          <input type="text" id="teacherName" v-model="searchForm.teacherName" placeholder="關鍵字搜尋" />
        </label>
      </div>

      <fieldset>
        <legend>上課時間篩選</legend>
        <div class="grid">
          <label for="dayOfWeek">
            星期
            <select id="dayOfWeek" v-model="searchForm.dayOfWeek">
              <option value="">=不限=</option>
              <option value="1">週一</option>
              <option value="2">週二</option>
              <option value="3">週三</option>
              <option value="4">週四</option>
              <option value="5">週五</option>
              <option value="6">週六</option>
              <option value="7">週日</option>
            </select>
          </label>
          <label for="startSlot">
            起始節次
            <select id="startSlot" v-model="searchForm.startSlot">
              <option value="A">=不限=</option>
              <option v-for="s in timeSlots" :key="'start-' + s.val" :value="s.val">{{ s.label }}</option>
            </select>
          </label>
          <label for="endSlot">
            結束節次
            <select id="endSlot" v-model="searchForm.endSlot">
              <option value="M">=不限=</option>
              <option v-for="s in timeSlots" :key="'end-' + s.val" :value="s.val">{{ s.label }}</option>
            </select>
          </label>
        </div>
        <small>
          <a href="javascript:void(0)" @click="isGuideVisible = true">如何使用節次搜尋說明？</a>
        </small>
      </fieldset>

      <div class="grid">
        <button type="submit">開始搜尋</button>
        <button type="button" class="secondary" @click="resetForm">重置表單</button>
      </div>
    </form>

    <dialog :open="isGuideVisible">
      <article>
        <header>
          <button aria-label="Close" rel="prev" @click="isGuideVisible = false"></button>
          <p><strong>查詢技巧說明</strong></p>
        </header>
        <p>
          1. <strong>特定節次</strong>：若想找週一第 4 節，請設定為「週一」、「第 4 節」到「第 4 節」。<br />
          2. <strong>包含範圍</strong>：若想找包含第 4 節的課，請設定起始為「不限」，結束為「第 4 節」，系統會找出所有涵蓋該節次的課程。
        </p>
        <footer>
          <button class="secondary" @click="isGuideVisible = false">了解</button>
        </footer>
      </article>
    </dialog>
  </section>
</template>