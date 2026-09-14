# 隨手記 v1.1.6 — GitHub Pages 版

這個版本已改成 GitHub Pages 專用部署格式。

## 保留功能
- 輸入每一個字立即儲存到瀏覽器本機
- 30 秒倒數「30秒後建立」；最後一次輸入後倒數歸零，自動清空輸入框並建立下一筆
- 儲存時間顯示到秒
- 日期、星期、即時儲存狀態
- 版本號顯示
- 日曆分類
- 關鍵字搜尋
- 修改、刪除、移動順序
- 淺色／深色模式
- PWA／離線使用

## GitHub Pages 部署方式（推薦：GitHub Actions）
1. 在 GitHub 建立一個新的 repository，例如 `quicknote`。
2. 將本資料夾內的所有檔案上傳到 repository 根目錄。請注意 `.github` 與 `.nojekyll` 也要一起上傳。
3. 進入 Repository → Settings → Pages。
4. 在 Build and deployment 的 Source 選擇 `GitHub Actions`。
5. 回到 Actions，等待 `Deploy 隨手記 to GitHub Pages` 完成。
6. 部署完成後，網址通常為：`https://你的GitHub帳號.github.io/儲存庫名稱/`。
7. 用 iPhone Safari 開啟後，可透過「分享 → 加入主畫面」安裝成 App。

## 之後更新
只要把新版檔案 push 到 `main` 分支，GitHub Actions 就會自動重新部署。

## 資料注意事項
隨手記內容儲存在瀏覽器 localStorage，不會上傳到 GitHub。更換網址、清除瀏覽器網站資料或換手機時，原資料不會自動同步。正式長期使用建議後續加入匯出／備份功能。

## 為什麼加入 .nojekyll
這是一個純 HTML/CSS/JavaScript PWA，不需要 Jekyll 處理；`.nojekyll` 可避免 GitHub Pages 對靜態檔案做不必要的 Jekyll 處理。
