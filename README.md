# NTPU Course Search (臺北大學課程查詢)

A modern course search interface for National Taipei University.

## Tech Stack

- Nuxt 4
- TypeScript
- Pico CSS (Class-less)

## Development

```bash
pnpm install
pnpm dev
```

Note: A proxy is required, as explained below.

## Google Apps Script (GAS) Proxy

This project utilizes a Google Apps Script (GAS) as a proxy to fetch data from the NTPU course query system.

### Why is a Proxy needed?
The NTPU Computer & Information Center's firewall seems to drop requests from Cloudflare Pages' edge nodes. By deploying a GAS proxy, we leverage Google's highly trusted IP addresses to bypass this firewall. 

### How to Deploy Your Own Proxy (For Contributors)
If you are forking this project or deploying it on your own server, you need to set up your own GAS proxy:

1. Go to [Google Apps Script](https://script.google.com/) and click **New Project**.
2. Replace the default `myFunction()` with the source code provided below.
3. Click **Deploy** > **New deployment** in the top right corner.
4. Click the gear icon ⚙️ next to "Select type" and choose **Web app**.
5. Set the configuration:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone` *(Crucial step!)*
6. Click **Deploy** and authorize the script if prompted.
7. Copy the generated **Web app URL**.
8. Replace the `NUXT_GAS_PROXY_URL` environmental variable with your new URL.

### Proxy Source Code (`Code.gs`)
```javascript
function doGet(e) {
  // 1. 從請求網址中取出目標網址 (url 參數)
  var targetUrl = e.parameter.url;

  if (!targetUrl) {
    return ContentService.createTextOutput("錯誤：缺少 url 參數")
                         .setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    // 2. 讓 Google 伺服器去向學校要資料 (附帶基礎偽裝)
    var response = UrlFetchApp.fetch(targetUrl, {
      "method": "get",
      "muteHttpExceptions": true, // 即使學校網頁報錯，也不要讓 GAS 崩潰
      "headers": {
        // 遵守爬蟲禮儀：宣告專案名稱、專案網址與聯絡信箱
        "User-Agent": "專案名稱/版本 (+專案網址; 您的聯絡信箱)",
        "Referer": "https://sea.cc.ntpu.edu.tw/"
      }
    });

    // 3. 學校網頁是 Big5 編碼，直接讓 GAS 轉成 UTF-8！
    var html = response.getContentText("big5");

    // 4. 將乾淨的 UTF-8 HTML 純文字回傳給 Nuxt API
    return ContentService.createTextOutput(html)
                         .setMimeType(ContentService.MimeType.TEXT);
                         
  } catch (err) {
    return ContentService.createTextOutput("GAS 抓取失敗: " + err.message)
                         .setMimeType(ContentService.MimeType.TEXT);
  }
}
function doPost(e) {
  var targetUrl = e.parameter.url;

  if (!targetUrl) {
    return ContentService.createTextOutput("錯誤：缺少 url 參數")
                         .setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    // 取得 Nuxt 前端傳來的 POST Payload (bodyString) 與 Content-Type
    var payload = e.postData ? e.postData.contents : "";
    var contentType = e.postData ? e.postData.type : "application/x-www-form-urlencoded";

    var response = UrlFetchApp.fetch(targetUrl, {
      "method": "post",
      "contentType": contentType, // 動態套用傳入的 Content-Type
      "payload": payload,         // 轉發 bodyString
      "muteHttpExceptions": true,
      "headers": {
        "User-Agent": "同上",
        "Referer": "https://sea.cc.ntpu.edu.tw/"
      }
    });

    var html = response.getContentText("big5");

    return ContentService.createTextOutput(html)
                         .setMimeType(ContentService.MimeType.TEXT);
                         
  } catch (err) {
    return ContentService.createTextOutput("GAS POST 抓取失敗: " + err.message)
                         .setMimeType(ContentService.MimeType.TEXT);
  }
}
```