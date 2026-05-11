// server/api/restrictions/course.get.ts
// course restrictions (限修) API endpoint

import { getQuery } from 'h3'
import * as cheerio from 'cheerio'

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const yearterm = query.yearterm as string
  const course = query.course as string

  if (!yearterm || !course) {
    return { success: false, message: '缺少必要查詢參數：yearterm 或 course', data: null }
  }

  try {
    // 1. 組裝校方查詢 URL
    const url = `https://sea.cc.ntpu.edu.tw/pls/faculty/common.OPMS_lm.bylimit_checkshow?yearterm=${yearterm}&serial=${course}`
    
    
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
    
    // 檢查是否不設限
    if (htmlUtf8.includes('此課程不設限')) {
      return { 
        success: true, 
        message: '此課程不設限', 
        data: { noRestriction: true, yearterm, course } 
      }
    }

    const $ = cheerio.load(htmlUtf8)

    // 2. 解析課名與限修模式
    // 原始 HTML 結構：『課名』的課程限制資料如下(模式)
    const headerText = $('td.font-w15').text().trim()
    const titleMatch = headerText.match(/『(.*?)』/)
    const modeMatch = headerText.match(/\((.*?)\)/)
    
    const title = titleMatch ? titleMatch[1] : ''
    const mode = modeMatch ? modeMatch[1] : ''

    // 3. 解析限制規則表格
    const rules: Array<{ category: string, conditions: string[] }> = []
    const $table = $('table[border="1"][cellpadding="2"]')
    
    $table.find('tr[bgcolor="#FFFFFF"]').each((_, tr) => {
      const $tds = $(tr).find('td')
      if ($tds.length >= 2) {
        const category = $tds.eq(0).text().replace(/[:：]/g, '').trim()
        // 將條件以逗號或空格切割成陣列，並清理空值
        const conditions = $tds.eq(1).text()
          .split(/[,，\s]+/)
          .map(s => s.trim())
          .filter(s => s !== '' && s !== ')')
          
        if (category) {
          rules.push({ category, conditions })
        }
      }
    })

    return {
      success: true,
      message: '成功取得限修規定',
      data: {
        noRestriction: false,
        yearterm,
        course,
        title,
        mode,
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
    return `course-restrictions-${query.yearterm}-${query.course}`
  }
})