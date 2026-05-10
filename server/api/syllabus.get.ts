import { defineEventHandler, getQuery } from 'h3'
import * as cheerio from 'cheerio'
import iconv from 'iconv-lite'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const course = query.course as string
  const year = query.year as string
  const term = query.term as string

  if (!course || !year || !term) {
    return { success: false, message: '缺少必要查詢參數：course, year 或 term', data: null }
  }

  try {
    const url = `https://sea.cc.ntpu.edu.tw/pls/dev_stud/course_query.queryguide?g_year=${year}&g_term=${term}&g_serial=${course}&show_info=all`
    const response = await fetch(url)
    
    if (!response.ok) throw new Error('校方系統無回應')

    const arrayBuffer = await response.arrayBuffer()
    const htmlUtf8 = iconv.decode(Buffer.from(arrayBuffer), 'big5')
    const $ = cheerio.load(htmlUtf8)

    // 1. 輔助函式：利用正則表達式擷取特定標籤內的文字
    const extractByRegex = (regex: RegExp, html: string) => {
      const match = html.match(regex)
      return match && match[1] ? match[1].trim() : ''
    }

    // 2. 擷取基本資料
    const titleZh = extractByRegex(/課程中文名稱.*?[：:]\s*<b[^>]*>(.*?)<\/b>/i, htmlUtf8)
    const titleEn = extractByRegex(/課程英文名稱.*?[：:]\s*<b[^>]*>(.*?)<\/b>/i, htmlUtf8)
    
    // 應修系級處理
    const majorRawHtml = extractByRegex(/應修系級.*?[：:]\s*<b[^>]*>(.*?)<\/b>/i, htmlUtf8)
    const majorParts = majorRawHtml.split(',').map(s => s.trim()).filter(s => s !== '')
    
    const major = majorParts.map(partHtml => {
      const $part = cheerio.load(partHtml, null, false)
      const grade = $part.text().replace(/&nbsp;/g, '').trim()
      
      let hasEnterLimit = false
      let enterLimitUrl = ''
      let enterLimitCode: string[] = []

      const $a = $part('a[href*="enter_course_limits"]')
      if ($a.length > 0) {
        hasEnterLimit = true
        const href = $a.attr('href') || ''
        const cdeptMatch = href.match(/cdept=([^&]+)/)
        const coursenoMatch = href.match(/courseno=([^&]+)/)
        
        if (cdeptMatch && cdeptMatch[1] && coursenoMatch && coursenoMatch[1]) {
          enterLimitCode = [cdeptMatch[1], coursenoMatch[1]]
          enterLimitUrl = `/restrictions/block?department=${cdeptMatch[1]}&course=${coursenoMatch[1]}`
        }
      } else if (partHtml.includes('btn.gif') || partHtml.includes('有擋修')) {
        hasEnterLimit = true
      }

      return {
        grade,
        hasEnterLimit,
        enterLimitUrl,
        enterLimitCode
      }
    })

    let teacherHtml = extractByRegex(/授課教師.*?[：:]\s*<b[^>]*>(.*?)<\/b>/i, htmlUtf8)
    const teacher = teacherHtml.replace(/<br\s*\/?>/gi, '、')

    const duration = extractByRegex(/全半學年.*?[：:]\s*<b[^>]*>(.*?)<\/b>/i, htmlUtf8)
    const credits = extractByRegex(/學　　分.*?[：:]\s*<b[^>]*>(.*?)<\/b>/i, htmlUtf8)
    const hours = extractByRegex(/時　　數.*?[：:]\s*<b[^>]*>(.*?)<\/b>/i, htmlUtf8)

    // 3. 擷取長篇文字 (教學目標、內容綱要等)
    const extractSectionText = (keyword: string) => {
      // 尋找包含特定關鍵字的 td，然後取得其內的文字 (排除原本關鍵字本身)
      const $td = $(`td:contains("${keyword}")`).last()
      if (!$td.length) return ''
      
      const $content = $td.find('.font-c13')
      if ($content.length) {
        let html = $content.html() || ''
        html = html.replace(/<br\s*\/?>/gi, '\n')
        return cheerio.load(html).text().trim()
      }
      return ''
    }

    const objectives = extractSectionText('教學目標')
    const outline = extractSectionText('內容綱要')
    const textbook = extractSectionText('指定用書')
    const references = extractSectionText('其他參考資料')

    // 4. 解析評量方式轉換為物件
    const parseEvaluation = () => {
      const result = {
        regular: { percentage: 0, methods: [] as any[] },
        midterm: { percentage: 0, methods: [] as any[] },
        final: { percentage: 0, methods: [] as any[] },
        note: ""
      }
      
      const $td = $(`td:contains("評量方式")`).last()
      const $table = $td.find('table').first()
      if (!$table.length) return result

      // 擷取百分比數字
      const $ths = $table.find('th')
      if ($ths.length >= 3) {
        const parsePercent = (text: string) => {
          const match = text.match(/(\d+)\s*%/);
          return match ? Number(match[1]) : 0;
        }
        result.regular.percentage = parsePercent($ths.eq(0).text())
        result.midterm.percentage = parsePercent($ths.eq(1).text())
        result.final.percentage = parsePercent($ths.eq(2).text())
      }

      // 擷取評量細項
      const $methodRow = $table.find('tr').filter((_, el) => $(el).find('input[type="checkbox"]').length > 0).first()
      const parseMethods = (tdIndex: number) => {
        const methods: any[] = []
        if (!$methodRow.length) return methods
        const tdHtml = $methodRow.find('td').eq(tdIndex).html() || ''
        const $cell = cheerio.load(tdHtml, null, false)
        
        $cell('input[type="checkbox"]').each((_, chk) => {
          const checked = $cell(chk).attr('checked') !== undefined
          
          // 解析 checkbox 旁邊的文字節點或字體標籤
          let name = ''
          const nextNode = (chk as any).nextSibling
          if (nextNode && nextNode.type === 'text') {
            name = nextNode.data?.trim() || ''
          }
          if (!name) {
            name = $cell(chk).next('font').text().trim()
          }
          
          const methodObj: any = { name, checked }
          
          // 針對「其他」欄位提取輸入框內容
          if (name.includes('其他') || name.includes('Others')) {
            const $txt = $cell('input[type="text"], input:not([type="checkbox"]):not([type="hidden"]):not([type="button"])')
            if ($txt.length) {
              methodObj.value = $txt.val() || ''
            }
          }
          methods.push(methodObj)
        })
        return methods
      }

      if ($table.find('tr').length > 1) {
        result.regular.methods = parseMethods(0)
        result.midterm.methods = parseMethods(1)
        result.final.methods = parseMethods(2)
      }

      // 擷取備註
      const $noteRow = $table.find('tr').last()
      if ($noteRow.length) {
        let noteHtml = $noteRow.html() || ''
        noteHtml = noteHtml.replace(/<br\s*\/?>/gi, '\n')
        let noteText = cheerio.load(noteHtml).text().replace(/備註/g, '').trim()
        result.note = noteText
      }

      return result
    }

    // 5. 解析教學進度轉換為結構化物件
    const parseSchedule = () => {
      // 掃描頁面底部是否包含指令腳本，以判斷是否顯示
      const showExtraWeeks = !htmlUtf8.includes("document.getElementById('schedule_w17').style.display = 'none';")
      const showFlexible = !htmlUtf8.includes("document.getElementById('extra_teaching').style.display = 'none';")

      const teachingWeeks: any[] = []
      const flexibleLearning = {
        methods: [] as any[],
        description: ""
      }

      // 使用 filter 與 startsWith 精準定位標題 td
      const $td = $('td').filter((_, el) => $(el).text().trim().startsWith('教學進度')).first()
      const $table = $td.find('table').first()

      if ($table.length) {
        // 輔助函式：清理儲存格內的多餘空白與換行，保留 <br> 語意
        const cleanCellHtml = (html: string) => {
          const $c = cheerio.load(html || '', null, false)
          $c('br').replaceWith('\n')
          return $c.text().split('\n').map(l => l.trim()).filter(l => l !== '').join('\n')
        }

        // 各週進度
        $table.find('tr[id^="schedule_w"]').each((_, tr) => {
          const $tds = $(tr).find('td')
          if ($tds.length >= 4) {
            teachingWeeks.push({
              week: cleanCellHtml($tds.eq(0).html() || ''),
              date: cleanCellHtml($tds.eq(1).html() || ''),
              content: cleanCellHtml($tds.eq(2).html() || ''),
              methods: cleanCellHtml($tds.eq(3).html() || '')
            })
          }
        })

        // 彈性補充教學
        const $extraTr = $table.find('tr#extra_teaching')
        if ($extraTr.length) {
          const tdHtml = $extraTr.find('td').last().html() || ''
          const $cell = cheerio.load(tdHtml, null, false)

          $cell('input[type="checkbox"]').each((_, chk) => {
            const hasThisWay = $cell(chk).attr('checked') !== undefined
            let teachingWay = ''
            const nextNode = (chk as any).nextSibling
            if (nextNode && nextNode.type === 'text') {
              teachingWay = nextNode.data?.trim() || ''
            }
            if (teachingWay) {
               flexibleLearning.methods.push({ teachingWay, hasThisWay })
            }
          })
          
          flexibleLearning.description = $cell('textarea').text().trim() || $cell('textarea').val() as string || ''
        }
      }

      return {
        teachingWeeks,
        showExtraWeeks,
        showFlexible,
        flexibleLearning
      }
    }

    const evaluationObj = parseEvaluation()
    const scheduleObj = parseSchedule()

    // 6. 輸出結構資料
    return {
      success: true,
      message: '成功取得課程大綱',
      data: {
        basic: { course, year, term, titleZh, titleEn, major, teacher, duration, credits, hours },
        objectives,
        outline,
        textbook,
        references,
        evaluation: evaluationObj,
        schedule: scheduleObj
      }
    }

  } catch (error: any) {
    return { success: false, message: error.message || '伺服器發生錯誤', data: null }
  }
})