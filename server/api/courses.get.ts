import { defineEventHandler, getQuery } from 'h3'
import * as cheerio from 'cheerio'
import iconv from 'iconv-lite'

// 輔助函式：將字串轉為 BIG5 的 URL encoded 格式
// 因為 URLSearchParams 預設使用 UTF-8，校方系統需要 BIG5 的 URL Encode
function encodeBig5Url(str: string | undefined): string {
  if (!str) return ''
  const buf = iconv.encode(str, 'big5')
  let encoded = ''
  for (const byte of buf) {
    encoded += '%' + byte.toString(16).toUpperCase()
  }
  return encoded
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  // 1. 組裝送往校方系統的 POST Body
  const params = [
    `qYear=${query.year || ''}`,
    `qTerm=${query.term || ''}`,
    `courseno=${query.courseCode || ''}`,
    `cour=${encodeBig5Url(query.courseName as string)}`,
    `teach=${encodeBig5Url(query.teacherName as string)}`,
    `week=${query.dayOfWeek || ''}`,
    `seq1=${query.startSlot || 'A'}`,
    `seq2=${query.endSlot || 'M'}`
  ]
  const bodyString = params.join('&')

  try {

    // 2-1. 取得環境變數中的 GAS 代理網址
    const config = useRuntimeConfig(event)
    const gasProxyUrl = config.gasProxyUrl
    
    if (!gasProxyUrl) {
      throw createError({ statusCode: 500, statusMessage: '系統設定錯誤：缺少 GAS Proxy URL' })
    }
    
    // 2-2. 目標學校系統網址
    const targetUrl = 'https://sea.cc.ntpu.edu.tw/pls/dev_stud/course_query_all.queryByKeyword'
    
    // 將原本的 POST 參數，全部透過 encodeURIComponent 編碼後塞入 GET 網址中
    const fetchUrl = `${gasProxyUrl}?url=${encodeURIComponent(targetUrl)}&method=POST&payload=${encodeURIComponent(bodyString)}`
    
    let htmlUtf8 = ''

    try {
      
      const response = await fetch(fetchUrl)
      
      if (!response.ok) {
        throw new Error(`GAS 中繼站無回應 (HTTP 狀態碼: ${response.status})`)
      }
      
      htmlUtf8 = await response.text()
      
      if (htmlUtf8.startsWith('錯誤：') || htmlUtf8.startsWith('GAS 抓取失敗:')) {
        throw new Error(htmlUtf8)
      }
      
    } catch (error: any) {
      // 捕捉真實錯誤並拋給前端，避免被 Nitro 直接覆寫為無意義的 500
      throw createError({
        statusCode: 502,
        statusMessage: error.message || '無法連線至校方系統或 GAS 中繼端點'
      })
    }
    
    // 4. 使用 cheerio 解析 DOM
    const $ = cheerio.load(htmlUtf8)
    const courses: any[] = []

    // 針對 tbody 內的每一列資料進行處理
    $('tbody tr').each((_, el) => {
      const $tds = $(el).find('td')
      const tdCount = $tds.length
      
      // 確保是有效的資料列 (至少需包含「關鍵字查詢」模式於非選課期間輸出的 18 個欄位)
      if (tdCount < 18) return

      // 輔助函式：清理文字內容的空白與換行
      const cleanText = (index: number) => $tds.eq(index).text().replace(/\s+/g, ' ').trim()
      const getHtml = (index: number) => $tds.eq(index).html() || ''

      // 1. 處理系所名稱縮寫 (Index 4)
      let department = cleanText(4)
      department = department
        .replace('法律學系司法組', '司法')
        .replace('法律學系財經法組', '財法')
        .replace('法律學系法學組', '法學')
        .replace('法碩法專組', '法專')
        .replace('法碩一般生組', '法研')
        .replace('(進修)法律', '法夜')

      // 2. 應修系級與必選修別 (Index 5 & 6)
      
      // 由於擋修圖示 (<a><img></a>) 不一定包覆文字，以 <br> 切割 HTML 精準配對
      const htmlSource5 = getHtml(5)
      const htmlSource6 = getHtml(6)
      const lines5 = htmlSource5.split(/<br\s*\/?>/i).map(s => s.trim()).filter(s => s !== '')
      const lines6 = htmlSource6.split(/<br\s*\/?>/i).map(s => s.trim()).filter(s => s !== '')

      const designatedFor = lines5.map((lineHtml, i) => {
        const $line = cheerio.load(lineHtml)
        const grade = $line.text().trim() // 去除 HTML 標籤，純取系級文字
        
        let hasEnterLimit = false
        let enterLimitUrl = ''
        let enterLimitCode: string[] = []

        const $a = $line('a[href*="enter_course_limits"]')
        if ($a.length > 0) {
          hasEnterLimit = true
          const href = $a.attr('href') || ''
          const cdeptMatch = href.match(/cdept=([^&]+)/)
          const coursenoMatch = href.match(/courseno=([^&]+)/)
          
          // 明確檢查擷取群組 [1] 是否存在，以避免 TypeScript strict mode 警告
          if (cdeptMatch && cdeptMatch[1] && coursenoMatch && coursenoMatch[1]) {
            enterLimitCode = [cdeptMatch[1], coursenoMatch[1]]
            enterLimitUrl = `/restrictions/block?department=${cdeptMatch[1]}&course=${coursenoMatch[1]}`
          }
        } else if (lineHtml.includes('btn.gif') || lineHtml.includes('有擋修')) {
          // 防呆：若有圖示但無連結，仍標示為擋修
          hasEnterLimit = true
        }

        const typeText = lines6[i] ? cheerio.load(lines6[i]).text().trim() : ''

        return {
          grade,
          hasEnterLimit,
          enterLimitUrl,
          enterLimitCode,
          type: typeText
        }
      }).filter(item => item.grade !== '')

      // 3. 處理課程名稱與大綱連結 (Index 7)
      const $titleTd = cheerio.load(getHtml(7))

      // 3-1. 課程中英文名稱與備註
      const titleZh = $titleTd('a').first().text().trim()

      let fullTitleText = $titleTd.text().trim()
      let titleEn = ''
      titleEn = fullTitleText.replace(titleZh, '').replace(/備註：.*/, '').trim()

      const noticeMatch = fullTitleText.match(/備註：(.*)/)
      const notice = noticeMatch?.[1]?.trim() || ''
      
      // 3-2. 「限修」課程限制
      let commonLimit = {
        hasLimit: false,
        limitUrl: ''
      }
      const $limitLink = $titleTd('a[href*="common.OPMS_lm.bylimit_checkshow"]')
      if ($limitLink.length > 0) {
        commonLimit.hasLimit = true
        const href = $limitLink.attr('href') || ''
        const queryStr = href.split('?')[1] || ''
        
        if (queryStr) {
          // 使用 URLSearchParams 安全解析並重組 query
          const params = new URLSearchParams(queryStr)
          
          // 若存在 serial 參數，將其值取出並改綁定到 course 參數上
          if (params.has('serial')) {
            const serialValue = params.get('serial')!
            params.delete('serial')
            params.set('course', serialValue)
          }
          
          // 重新組裝為內部路由網址 (此時 params.toString() 會輸出如 yearterm=1142&course=M6135)
          commonLimit.limitUrl = `/restrictions/course?${params.toString()}`
        } else {
          commonLimit.limitUrl = '/restrictions/course'
        }
      } else if (getHtml(7).includes('btn_lm.gif') || getHtml(7).includes('有課程限制')) {
        commonLimit.hasLimit = true
      }

      // 3-3. 課程大綱連結處理
      // 為了未來 Nuxt 路由，我們轉為 API 或 Frontend Router 能接受的格式
      const syllabusUrlRaw = $titleTd('a').attr('href') || ''
      let syllabusUrl = ''
      if (syllabusUrlRaw.includes('g_serial=')) {
        const s = syllabusUrlRaw.match(/g_serial=([^&]+)/)
        const y = syllabusUrlRaw.match(/g_year=([^&]+)/)
        const t = syllabusUrlRaw.match(/g_term=([^&]+)/)
        
        if (s && s[1] && y && y[1] && t && t[1]) {
          syllabusUrl = `/syllabus?course=${s[1]}&year=${y[1]}&term=${t[1]}`
        }
      }

      // 4. 選課相關
      // 4-1. 動態處理選課人數 (根據 td 總數量判斷)
      // 判斷方式：選課期間應有 24 個欄位，非選課期間則為 18 個欄位
      let limitCount = cleanText(tdCount >= 24 ? 18 : 16) // 限修總計人數
      let selectedCount = cleanText(tdCount >= 24 ? 21 : 17) // 已選總計人數
      let approvedCount = tdCount >= 24 ? cleanText(22) : '0' // 已核准人數
      let pendingCount = tdCount >= 24 ? cleanText(23) : '0' // 待分發人數

      // 4-2. 處理加簽狀態 (Index 14, 15)
      const allowSign = cleanText(14)
      const signQuota = cleanText(15)
      let signStatus = `加簽: ${allowSign}, ${signQuota}人`
      if (allowSign === '是') signStatus = `允許 ${signQuota} 人加簽`
      if (allowSign === '否') signStatus = `不允許加簽`

      // 4-3. 組合選課相關之提示文字
      const statusText = tdCount >= 24
        ? `限修 ${limitCount} 人\n${selectedCount} 人已選\n${approvedCount} 人已核准\n${pendingCount} 人待分發\n\n${signStatus}`
        : `限修 ${limitCount} 人\n${selectedCount} 人已選\n(目前非選課期間，無核准與分發資料)\n\n${signStatus}`

      // 5. 獲取教師課表連結
      const $teacherTd = cheerio.load(getHtml(8))
      const teachers = $teacherTd('a')
        .map((_, el) => ({
          name: $teacherTd(el).text().trim(),
          scheduleUrl: ($teacherTd(el).attr('href') || '').replace( '../',
            'https://sea.cc.ntpu.edu.tw/pls/'
          ),
        }))
        .get() // 將 Cheerio 陣列轉為原生 JS 陣列

      // 6. 輸出結構化資料
      courses.push({
        year: cleanText(1),
        term: cleanText(2),
        courseCode: cleanText(3),
        department,
        designatedFor,
        commonLimit,
        title: { zh: titleZh, en: titleEn, notice, syllabusUrl },
        teachers,
        duration: cleanText(9), // 半/全
        credits: cleanText(10),
        hours: cleanText(11),
        language: cleanText(12),
        timeAndLocation: cleanText(13),
        registrationInfo: {
          isSelectionPeriod: tdCount >= 24,
          limitCount,
          selectedCount,
          approvedCount,
          pendingCount,
          signStatus,
          statusText
        }
      })
    })

    return {
      success: true,
      message: `成功獲取 ${courses.length} 筆課程`,
      data: courses
    }

  } catch (error: any) {
    return {
      success: false,
      message: error.message || '伺服器發生錯誤',
      data: []
    }
  }
})