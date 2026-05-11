import { getQuery } from 'h3'
import * as cheerio from 'cheerio'

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const department = query.department as string
  const course = query.course as string

  if (!department || !course) {
    return { success: false, message: '缺少必要查詢參數：department, course', data: null }
  }

  try {
    // 1. 獲取校方系統擋修資料
    const url = `https://sea.cc.ntpu.edu.tw/pls/gradu/m0001.enter_course_limits.report?cdept=${department}&courseno=${course}`

    // 取得環境變數
    const config = useRuntimeConfig(event)

    // 組合 GAS 查詢網址
    const gasProxyUrl = config.gasProxyUrl
    if (!gasProxyUrl) {
      throw new Error('系統設定錯誤：缺少 GAS Proxy URL')
    }
    const fetchUrl = `${gasProxyUrl}?url=${encodeURIComponent(url)}`

    // 取得 DOM 並以 cheerio 解析之
    const response = await fetch(fetchUrl)
    if (!response.ok) throw new Error('GAS 中繼站無回應')
    const htmlUtf8 = await response.text()
    // 檢查是不是 GAS 回傳的自訂錯誤訊息
    if (htmlUtf8.startsWith('錯誤：') || htmlUtf8.startsWith('GAS 抓取失敗:')) {
      throw new Error(htmlUtf8)
    }
    const $ = cheerio.load(htmlUtf8)

    // 2. 解析課名標題
    // 原始格式：『行政程序法』的擋修資料如下
    const headerText = $('td.font-w15').text().trim()
    const title = headerText.match(/『(.*?)』/)?.[1] || '未知課程'

    // 3. 解析擋修規則表格 (跳過標題兩列)
    const rules: any[] = []
    const $table = $('table[cellPadding="2"][cellSpacing="1"]')
    
    $table.find('tr.font-b13').each((_, tr) => {
      const $tds = $(tr).find('td')
      // 確保欄位數量符合預期 (14欄)
      if ($tds.length >= 14) {
        rules.push({
          blockedCourse: $tds.eq(1).text().trim(), // 擋修科目 (通常是本課)
          prerequisite: {
            dept: $tds.eq(2).text().trim(),        // 先修科目開課系所
            course: $tds.eq(3).text().trim(),      // 先修科目名稱
            semester: $tds.eq(4).text().trim(),    // 學期
            credits: $tds.eq(5).text().trim(),     // 學分
            gradeLimit: $tds.eq(6).text().trim()   // 成績限制
          },
          logic: {
            group: $tds.eq(7).text().trim(),       // 分組
            option: $tds.eq(8).text().trim()       // 選項
          },
          target: {
            method: $tds.eq(9).text().trim(),      // 方式
            college: $tds.eq(10).text().trim(),    // 院別
            dept: $tds.eq(11).text().trim(),       // 系所別
            division: $tds.eq(12).text().trim(),   // 學部別
            class: $tds.eq(13).text().trim()       // 班別
          }
        })
      }
    })

    return {
      success: true,
      message: '成功取得擋修規定',
      data: {
        title,
        department,
        courseCode: course,
        rules
      }
    }

  } catch (error: any) {
    return { success: false, message: error.message || '伺服器發生錯誤', data: null }
  }
}, {
  // 設定快取規則
  maxAge: 60 * 60 * 24 * 7, // 快取 7 天
  swr: true,
  // 自訂快取鍵值 (Cache Key)：依據課號、學年、學期來區分
  getKey: (event) => {
    const query = getQuery(event)
    return `block-${query.department}-${query.course}`
  }
})