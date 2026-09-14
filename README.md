# 隨手記 v1.1.7 — GitHub Pages 版

這版新增「資料備份／搬移」功能，適合把舊 Netlify 網址上的隨手記搬到 GitHub Pages。

## 新增功能

- 頂部新增「⇅」資料備份按鈕。
- **匯出備份**：將所有隨手記匯出成 JSON。
- **匯入備份**：與目前資料合併，不會先刪除現有紀錄。
- 匯入保留原本的內容、建立日期、時間。
- 完全相同的紀錄會自動略過，避免重複匯入。
- 備份檔同時相容「完整 v1.1.7 備份格式」與舊版 localStorage 的純陣列 JSON。

## GitHub Pages 更新方式（你目前使用的方式）

Repository：`wood3816/quicknote`

1. 解壓縮本程式包。
2. 在 GitHub Repository 選 **Add file → Upload files**。
3. 上傳／取代根目錄中的 `index.html`、`app.js`、`styles.css`、`sw.js`、`manifest.webmanifest`、`README.md`，以及需要的 `icons`。
4. Commit 到 `main`。
5. **Settings → Pages** 維持：
   - Source：`Deploy from a branch`
   - Branch：`main`
   - Folder：`/(root)`
6. 等 GitHub Pages 重新發布。

網站網址：`https://wood3816.github.io/quicknote/`

## 舊 Netlify 紀錄怎麼搬

因為 Netlify 與 GitHub Pages 是不同網域，瀏覽器基於安全規則不能讓新網址直接讀舊網址的 localStorage。

若舊 Netlify 已經升級到有「⇅ 資料備份」的版本，直接在舊網址匯出 JSON 即可。

如果舊 Netlify 仍是 v1.1.4 / v1.1.5，請使用本程式包附帶的：

`舊Netlify資料匯出_書籤指令.txt`

在**原本存有舊紀錄的那台 iPhone**上，於舊 Netlify 網址執行書籤指令，即可把舊 localStorage 轉成 JSON，再回 GitHub Pages v1.1.7 匯入。

> 搬移完成前，不要清除 Safari 網站資料，也不要刪掉舊 Netlify 網站的主畫面捷徑。
