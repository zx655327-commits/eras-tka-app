# 長時錄音翻譯（Android）

獨立 App，與本 repo 其他內容無關。

## 功能
- 前景服務長時間錄音：切換其他 App、關螢幕都持續錄。
- 來電／通話：Android 會把麥克風交給電話，所以 App 會自動暫停，掛斷後自動恢復，並在逐字稿標註「通話中」時段。
- 即時轉錄：Vosk 離線辨識，支援中文或英文。
- 即時翻譯：ML Kit 離線翻譯，中翻英或英翻中。
- 存檔位置：`Android/data/tw.recorder.longrec/files/rec_日期時間/`，內含 `audio_001.wav`（約每小時自動切一檔）、`transcript.txt` 與 `translation.txt`。

第一次使用要連網下載語音模型（約 45 MB）和翻譯模型（約 30 MB），之後可以完全離線，錄音不會上傳。

## 取得 APK
推送到 GitHub 後，Actions 的「Build recorder APK」會自動編譯，到該次執行的 Artifacts 下載 `LongRecorder-apk` 即可。也可以用 Android Studio 開啟 `recorder-app/` 資料夾直接編譯。

## 建議手機設定
- 設定 → 電池 → 本 App 設為「不限制」或「不最佳化」，避免小米、OPPO、三星等品牌的省電機制把服務關掉。
- 授權麥克風、電話狀態與通知權限。
