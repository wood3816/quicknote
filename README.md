# 隨手記 PWA v1.0.0

## 本版功能
- 輸入框隨內容自動換行、增高，最大高度 220px。
- 每次輸入都寫入 IndexedDB，並保留 LocalStorage 草稿影子備援。
- 最後一次輸入後 30 秒，自動完成目前紀錄、清空輸入框並準備下一筆。
- 獨立「Ⅱ / ▶」30 秒暫停、繼續按鈕；暫停期間仍即時儲存。
- 暫停後若繼續修改文字，倒數重設為 30 秒並維持暫停；按 ▶ 後再開始倒數。
- 日期與時間記錄到秒。
- 歷史紀錄緊湊排列，時間靠右同行顯示。
- 日曆依日期篩選、搜尋關鍵字醒目標記。
- 淺色 / 深色 / 跟隨系統。
- 修改、複製、分享、上移、下移、移到最上、移到最下。
- 刪除後 5 秒內可復原。
- JSON 備份與匯入。
- PWA 離線使用與版本更新檢查。
- GitHub Pages 使用相對路徑，可部署在 repository 子路徑。

## GitHub Pages 部署
1. 建立 GitHub Repository。
2. 將本資料夾「裡面的所有檔案」上傳到 Repository 根目錄。
3. GitHub → Repository → Settings → Pages。
4. Source 選 `Deploy from a branch`。
5. Branch 選 `main`，Folder 選 `/(root)`，Save。
6. GitHub Pages 部署完成後，用 HTTPS 網址開啟。
7. iPhone：Safari → 分享 → 加入主畫面。
8. Android：Chrome → 選單 → 安裝應用程式 / 加到主畫面。

## 更新版本
主要版本號在 `config.js`：

`VERSION: "1.0.0"`

每次發布新版，同步把 `version.json` 的 version 改成同一版本，例如 `1.0.1`。Service Worker 快取會使用新版本名稱，App 也會檢查新版。

## 重要資料說明
隨手記內容儲存在手機瀏覽器 / PWA 的 IndexedDB，不會上傳到 GitHub。清除網站資料、換手機或某些系統清理行為仍可能刪除本機資料，因此建議定期使用「設定 → 匯出備份（JSON）」。
