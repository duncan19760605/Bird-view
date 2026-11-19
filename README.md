# 走，賞鳥趣

九宮格（12346789）操控的賞鳥遊戲。純前端靜態專案（ES Modules），16:9 橫幅，適用手機／平板／電視。
可用鍵盤、滑鼠／觸控，或踩**九宮格地墊**操作。地墊為 Genius Holdings 的 [MotionPad](https://motionpad.genius-gh.com/zh-hant) 硬體，本遊戲相容 MotionPad 地墊：踩踏時地墊發出超聲波，由裝置麥克風接收。

| 版本 | 檔案 |
|---|---|
| Windows v0.4.6 | `release/BirdView-Setup-v0.4.6.exe`（安裝後桌面捷徑「走，賞鳥趣」） |
| Android v0.4.6 | `release/BirdView-v0.4.6.apk`（橫向全螢幕，觸控九宮格＋麥克風） |

**下載**：安裝檔請到 GitHub 的 [Releases](https://github.com/duncan19760605/Bird-view/releases) 下載（版本庫不含 `.exe`／`.apk`）。
版本庫也不含原始拼圖 `photo/`、插畫原檔 `assets/pencil-cartoon/` 與簽章金鑰；遊戲實際使用的素材都在 `assets/` 內，clone 後即可執行。

v0.3：10 關皆加入完整彩繪鉛筆素材、每關 MIDI 配樂與可關閉的分關鳥鳴音景；保留並強化超聲波地墊校正流程。

v0.4：第 1–6 關彩繪鉛筆改為兒童童書插畫；音樂與鳥鳴音量可分別調整（0–100%）；選單可選操控方式
「地墊（超聲波）／觸控螢幕／鍵盤」；收音設定新增「一鍵引導校正」與「只重踩失敗的格子」。

v0.4.5：第 7–10 關的彩繪鉛筆也換成兒童童書插畫，10 關全部完成。

v0.4.6：更正 7、9 號超聲波頻率（7＝21500 Hz、9＝22990 Hz，原本輸入對調；舊存檔自動更正）；背景音樂與鳥鳴音量放大 3 倍。

## 執行

### 2026-10-11 原始碼更新

- 新增五種開放授權實錄鳥鳴：麻雀、白頭翁、珠頸斑鳩、黑翅長腳鷸、煤山雀；依關卡鳥種選播，十關均有匹配。音量沿用鳥鳴滑桿，靜音／退出停止播放，載入失敗使用合成音。來源、作者、CC BY-SA 授權、處理與 hash 見 [鳥鳴授權頁](assets/bird-calls/CREDITS.html) 與 [manifest](assets/bird-calls/manifest.json)。
- [bird-view-development.html](bird-view-development.html)：繁體中文／英文切換，SVG／離線 Mermaid，整理玩法、架構、開發證據、多 AI 協作、提示詞、收音設備及遊戲延伸。
- `MotionPad-STEM-Agent/`：可供不同 coding agent 使用的指引、skill、收音／鏡頭模組快照、STEM 範例及驗證工具（僅保存在開發者本機，不在公開版本庫中）。
- 修正第 1–3 關仍指示「按 5 換望遠鏡」的舊提示，改為同時按 1＋7。

本次更新未重建既有 EXE／APK。執行原始碼可使用新鳥鳴；Electron 開發版需先重新 stage。驗證結果見 [report.json](docs/verification/report.json)：音景 23 項、文件／STEM UI 15 項、十關檢查、既有音訊與遊戲模擬通過。−10 dB 低訊號診斷僅 6／8 格單次正確觸發；真地墊與 Android 麥克風仍需現場驗收。

新增音景測試：先 `python tools/stage_web.py --with-test-audio`，再於 desktop 執行 `node_modules\.bin\electron.cmd . --selftest=soundscape`。正式打包前重新執行不含 `--with-test-audio` 的 stage。

ES Modules 不能用 `file://` 直開，需要一個靜態伺服器：

```bash
cd /d/DSH-works/Game-design/Bird-view && python -m http.server 8080
```

然後開 <http://localhost:8080/>。（Windows 也可直接雙擊 `serve.cmd`。）

## 操作

選單的「操控方式」三選一（存在 `localStorage['bird-view.control']`；第一次使用時，手機／平板預設觸控，電腦預設鍵盤）：

| 操控方式 | 麥克風 | 畫面右下九宮格 |
|---|---|---|
| 地墊（超聲波） | 開啟收音，開局與每關前做 10 秒背景校正 | 只做監看：踩到的格子會亮起，不接受點按 |
| 觸控螢幕 | 不開、不要求權限 | 按鍵加大，方便手指點按（兩指同按 1＋7 換裝置） |
| 鍵盤 | 不開、不要求權限 | 縮小成按鍵提示 |

三種方式下鍵盤都可當備用。開不了麥克風時會自動退回觸控或鍵盤。

| 鍵 | 功能 |
|---|---|
| 2 / 8 | 上 / 下（手機鍵盤語意：2 在上排＝往上） |
| 4 / 6 | 左 / 右 |
| 7 / 1 | 放大 / 縮小 |
| 1 ＋ 7（同時） | 切換裝置（手機 ⇄ 單筒望遠鏡，取得望遠鏡後才有作用） |
| 9 | 攝影 |
| 3 | 退出（回關卡選單 / 看圖鑑） |
| 5 | 休息格，沒有功能（地墊 5 號同樣是休息區；按鍵盤 5 會提示「同時按 1＋7 切換裝置」） |

方向鍵、`+`／`-`、空白鍵、Esc 也對應到相同功能；畫面右下的九宮格按鈕可直接點按／觸控（兩指同時按 1 與 7 即可切換）。
「同時」的判定在 `js/input.js`：1 或 7 先暫存 0.3 秒（`CONFIG.CHORD_MS`），期間另一顆也按下、或另一顆正被按住，就合成「切換裝置」，
暫存的那一下不會先縮放；所以單按 1/7 的縮放會晚約 0.3 秒，按住連發則照常連續變焦。
選單與對話框也能只用九宮格操作：選單 2/4/6/8 移動關卡焦點、9 進入、3 看圖鑑；對話框 4/6 換按鈕、9 確認、3 取消。
Android 的返回鍵等於 3。

## 地墊超聲波控制（麥克風）

實體控制器是 Genius Holdings 的 **MotionPad 九宮格地墊**（官網：<https://motionpad.genius-gh.com/zh-hant>）。
本遊戲不需要連線或安裝驅動程式：地墊每一格被踩下時發出各自的超聲波頻率，手機、平板或電腦的麥克風收音後由遊戲判斷踩到哪一格。

3×3 地墊：踩下 1–4、6–9 號格會發出各自的超聲波頻率，**5 號是休息區，沒有頻率、不產生任何事件**；
切換裝置是**雙腳同時踩 1 和 7**。收音與校正依 MotionPad 創作者工具包中 `motionpad-audio-receiver` 的規則實作
（工具包受授權限制，不在本版本庫中）：

| 位置 | 1 左上 | 2 上 | 3 右上 | 4 左 | 6 右 | 7 左下 | 8 下 | 9 右下 |
|---|---|---|---|---|---|---|---|---|
| 參考頻率 Hz | 18000 | 18810 | 19500 | 20000 | 21000 | 21500 | 22000 | 22990 |

參考頻率由 `audio-protocol/button-0N.wav` 分析而來（`python tools/analyze_audio.py` → `audio-protocol/protocol.json`），只是預設值；
實際頻率、訊號強度與閾值要在現場用「收音設定與校正」量測：

**一鍵引導校正**（建議）：選單 →「收音設定與校正」→ 選麥克風 →「一鍵引導校正（9）」。程式會依序開啟收音、
做 10 秒背景校正（站在 5 號）、提示逐格踩 1 2 3 4 6 7 8 9，最後自動套用通過的格子；右側摘要列出每格的結果、SNR、餘裕與目前閾值。
有格子未通過時，按「只重踩失敗的格子」即可補測，不必全部重踩。第一次選「地墊」且各格仍是預設閾值時，也會直接提示開始引導。

下列 ①–④ 是引導流程的內部步驟，也保留在「進階」區可以分步執行：

1. 選單 →「收音設定與校正」→ 選麥克風 →「① 開啟收音」（48 kHz、單聲道、關閉 AGC／降噪／回音消除；收音不回播、不保存）。
2. 「② 背景校正 10 秒」：站在 5 號休息區不要踩踏。暖機 85 ms 後，以 10 秒矩形時間加權積分得到每個頻道的背景功率
   （4096 FFT、半頻寬 ±40 Hz、帶內 `10^(dB/10)` 線性平均）。短暫的敲擊聲（高於中位數 12 dB、持續 < 300 ms）不計入背景
   （原始平均另存 `rawMeans`）；同樣的高訊號持續 ≥ 300 ms 視為有人踩踏，校正失效。取樣中斷超過 250 ms、出現無效值、
   某頻道背景低於 −150 dB（這支麥克風收不到該頻率）、頁面轉到背景、裝置中斷也都會讓校正失效。
3. 「③ 逐格踩踏檢查」：依提示踩 1 2 3 4 6 7 8 9。每一格記錄整次踩踏的實測峰值頻率、訊號功率（中位數、P10）、
   對其他頻道造成的串擾，以及踩踏中途的訊號下陷時間。
4. 「④ 套用建議」：每格閾值 = 下限與訊號的 dB 中點，下限 = max(背景 × 全域倍率 4, 其他格最大串擾 × 2)，
   以「自訂倍率」存入（超出 0.1–1000 倍改存「手動閾值」，畫面以 dB 顯示）；放開確認時間改為最長下陷 × 1.5 + 40 ms，
   避免一次踩踏被判成多次；實測頻率偏離超過半頻寬時改用實測頻率並自動重做背景校正。

偵測器狀態：`鎖定 → (低於閾值×0.6 持續放開確認時間) → 待命 → (高於閾值持續 40 ms) → 觸發`；
同時有兩格以上超標記為「衝突」，不移動、只提示。開局與每次觸發後都要先放開才能再觸發（按住不會連發）。

- 操控方式選「地墊」後，**每次進入關卡前都會自動做 10 秒背景校正**：先等所有格安靜 1 秒（剛踩 9 進關的聲音不會被算進背景），
  畫面提示站在 5 號；頁面轉到背景或收音中斷後，回到畫面會自動重新校正。
- 若各格還是預設閾值（從未做逐格檢查），選地墊時會建議先做「一鍵引導校正」（預設閾值只比背景高 6 dB，容易被雜音誤觸）。
- 衝突（兩格以上同時超標）不移動，只提示「請只踩一格」，提示最多每 3 秒一次。
  **例外：剛好是 1 與 7 兩格**（中間隔著 4 號，不會是跨格誤踩）＝切換裝置的雙腳手勢。偵測器本身不改，仍記為衝突；
  先落地的那隻腳若已觸發 1 或 7，會因 0.3 秒暫存而被這次切換取消，不會先縮放。
- 各格設定存在 `localStorage['birdview-audio-v2']`；可「匯出設定」（schemaVersion 2 的 JSON）、「匯入設定」（匯入後一定要重新校正），
  「開始監測錄製」可匯出最長 5 分鐘、12 欄（timeMs…state）的數值 CSV（UTF-8 BOM、CRLF），不含任何錄音。
- 用參考音檔模擬（不需地墊）：網址加 `?audiotest`，收音會改用 `environment.wav` 循環，逐格檢查時自動播放對應的 `button-0N.wav`。
- 桌面版自我測試（需先 `python tools/stage_web.py --with-test-audio`，打包前記得再跑一次不帶參數的 `stage_web.py`）：
  `electron . --selftest` 按「一鍵引導校正」（背景校正 → 逐格檢查 → 自動套用）→ 8 格偵測；`electron . --selftest=game` 只用地墊聲音完成
  「操控方式選地墊 → 選單 6/4/6/9 進第 2 關 → 進關前校正 → 7 放大、6 右移 → 同時踩 1＋7 換望遠鏡、1 先 7 後（差 150 ms）
  換回手機、單踩 7 仍是放大 → 3 退出 → 9 回選單」（測試會先給望遠鏡並解鎖第 2 關，結束時還原遊戲進度）。

**尚未以實體地墊驗證**：目前的測試都是用參考音檔模擬。以參考音檔在校正音量下 8 格各觸發一次、背景零誤觸（多次重跑結果一致）；
音量比校正時低 10 dB 時，本版自我測試有 5/8 格維持單次正確觸發，其餘會漏判或重複觸發，所以麥克風位置或音量改變後請重新做逐格檢查。
Android 模擬器的麥克風收不到 18 kHz 以上的聲音（各頻帶約 −133 至 −174 dB），只能驗證介面、權限與流程，收音效果要用真機測。
9 號（約 23 kHz）最弱，與串擾的餘裕只有約 3–4 dB；許多手機麥克風在 20 kHz 以上收音衰減明顯，真機 18–23 kHz 的接收能力需實測。

## 音樂與鳥鳴

- 第 1–10 關各有一首離線 MIDI 配樂（`assets/music/level01.mid` ～ `level10.mid`），由內建 Web Audio 合成器播放，不需網路。
- 選單有「音樂」與「鳥鳴」兩個音量滑桿（0–100%，0 = 關閉），放開滑桿時會試聽約 1 秒；設定存在 `localStorage['bird-view.sound.v1']`。
  v0.4.6 起音量基準為 v0.3 的 3 倍（預設 60% = v0.3 音量 ×3）；舊版存的「關」會轉成 0%。離開關卡立即淡出。
- 鳥鳴依公園、濕地、森林、高山與海岸等棲地使用不同音高、節奏與間隔的合成音景。它只使用約 0.9–4.2 kHz 可聽頻段，不會與 18–23 kHz 地墊偵測頻段重疊。
- 目前鳥鳴是無授權風險的合成音景，不宣稱為特定物種錄音；若未來取得授權野外錄音，可依關卡替換或疊加，並保留獨立音量與鳥鳴開關。

## 玩法規格

**視野與移動**（`js/config.js` 可調）
- 1X 時鏡頭視野寬 = 場景寬的 1/3；倍率 z 時為 `1/(3z)`。
- 1X 時左到右、上到下各剛好 **20 步**。
- 放大後步距 = 視野 / 3，一個視野橫跨 3 步 → 上下左右形成 **3×3 移動**。

**裝置與倍率**
- 手機：3X 光學 + 2X 數位（有段式 1 / 2 / 3 / 6X；6X = 3X 光學 × 2X 數位）。
- 單筒望遠鏡：10–20X（有段式 10 / 15 / 20X），第 1 關記滿 5 種後取得；第 2 關起在關卡中同時按 1＋7 切換。
- 第 1–5 關有段變焦、第 6–10 關無段變焦，由關卡 JSON 的 `zoomMode` 切換（`stepped` / `continuous`）。
- 數位變焦拍到的照片標記為**低解析**（圖鑑中會模糊處理），光學為**高解析**；兩者都能過關。同一種鳥重複拍，高解析版本會覆蓋低解析版本。

**攝影（9）**
- 以目前視野與各鳥的方框求交集，交集達鳥框面積的 60% 才算入鏡；高倍率下鳥比視野還大時（例如望遠鏡 20X 拍鳳頭蒼鷹），鳥身中心在視野內且佔滿視野一半以上也算。
- 剛好 1 種 → 進入賞鳥圖鑑；2 種以上 → 「一張照片只能有一種鳥」；0 種 → 存入風景攝影區。

**停留倒數（第 2 關起）**
- 關卡 JSON 中有 `stay`（秒）的鳥才會倒數；第 1 關沒有，所以鳥一直停在原地。
- 放大到鳥寬佔視野 15% 以上（`STAY_TRIGGER`）才算「正在觀察」，開始倒數；1X 廣角掃視不會驚動鳥。
- 倒數開始後即使移開視野也不暫停；時間到鳥會淡出離開，這段期間對著那裡拍只會存成風景照。
- 離開 15 秒（`RETURN_AFTER`）後回到原位，倒數補滿。
- 右側面板顯示視野中倒數最急的那隻：鳥名、行為、剩餘秒數。開啟對話框或切到背景時暫停計時。

**過關**
- 記滿指定種數即解鎖下一關：第 1 關 5 種、第 2 關 6 種、第 3 關 7 種、第 4 關 10 種、第 5 關 14 種、第 6 關 18 種、
  第 7 關 20 種、第 8 關 15 種（高山鳥少而小）、第 9 關 23 種、第 10 關 24 種。每關分開計算：第 1 關拍過的麻雀，在第 2 關再拍也算第 2 關的一種。
- 或者同一關**連續 3 天**各有遊玩紀錄（以本地日期判斷），即使沒記滿也解鎖。

**風格切換**
選單上可切換「寫實攝影 / 彩繪鉛筆」。兩者關卡內容、鳥的位置、過關條件完全一致，只換圖層來源：程式優先讀 `assets/pencil/` 的同名檔，不存在時退回 `assets/realistic/` 並套用程式化的鉛筆濾鏡。補上真正的鉛筆素材後會自動改用真圖。

第 1–10 關的彩繪鉛筆都使用逐張重繪的**兒童童書彩鉛插畫**（原檔在 `assets/pencil-cartoon/`；1–6 關於 v0.4、7–10 關於 v0.4.5 接入）。
`python tools/make_pencil_assets.py` 先由寫實圖產生濾鏡版，再把 `assets/pencil-cartoon/manifest.json` 中「整關都已生成且尺寸、alpha 檢查通過」的關卡覆蓋成插畫；
未完成的關卡整關保留濾鏡版，不會同一關混用兩種畫風。之後若重繪或新增插畫，重跑此工具即可。

## 結構

```
index.html              入口（16:9 版面骨架）
css/                    layout / game / dex 三份樣式
js/
  config.js             20 步、3×3、60% 入鏡等參數
  device.js             手機 / 望遠鏡的倍率與視野、步距公式
  camera.js             視野游標：位置、倍率、邊界
  capture.js            入鏡判定與拍照結果
  presence.js           停留倒數：觀察 → 倒數 → 離開 → 回來
  level.js              關卡與鳥類資料載入
  assets.js             風格素材解析與缺圖偵測
  render.js             左側肉眼影像 + 右側鏡頭的同步繪製
  progress.js           localStorage：圖鑑、風景照、遊玩日期、解鎖
  dex.js / ui.js        圖鑑與共用 UI
  input.js              九宮格輸入（鍵盤、按鈕、地墊共用 press()；1＋7 同時判定）
  audio-core.js         地墊收音純邏輯：頻道驗證、帶內功率、10 秒背景校正、閾值、偵測器狀態機、逐格閾值平衡、監測 CSV
  audio-receiver.js     收音：麥克風、20 ms 幀迴圈、校正失效條件、事件、設定保存／匯入匯出、測試音檔輸入
  audio-setup.js        「收音設定與校正」畫面
  main.js               流程串接
data/
  birds.json            鳥類圖鑑資料（含授權 / GPS / EXIF 欄位）
  levels/level01..10.json
assets/
  realistic/scenes/     park.png（1 大安森林公園）、botanical.png（2 植物園）、guandu.png（3 關渡）、
                        tianliaoyang.png（4 田寮洋）、aogu.png（5 鰲鼓）、dasyueshan.png（6 大雪山）、
                        mangrove.png（7 淡水河口紅樹林）、hehuan.png（8 合歡山）、kenting.png（9 墾丁社頂）、
                        taijiang.png（10 台江・七股）
  realistic/birds/      第 1 關去背鳥圖；birds/level02/ ~ level10/ 為第 2–10 關
  pencil/scenes|birds   與寫實素材一一對應的彩繪鉛筆版（含透明鳥圖）
  music/                第 1–10 關各自的離線 MIDI 配樂
audio-protocol/         地墊參考音檔（button-01..09.wav、environment.wav）與 protocol.json（參考頻率）
desktop/                Windows 版（Electron）：main.js、package.json、selftest/
android-app/            Android 版（Capacitor）：capacitor.config.json、android/（Gradle 專案）、keystore/（簽章，勿外流）
installer/              Inno Setup 腳本 bird-view.iss 與繁中介面語系檔
release/                v0.1 安裝檔與 APK
tools/
  analyze_audio.py      分析參考音檔 → audio-protocol/protocol.json
  stage_web.py          把遊戲執行檔案複製到 build/web/（桌面版與 Android 共用）
  make_icons.py         由 photo/bird-view-icon.png 產生 build/icon.ico 與 Android 圖示、啟動畫面
  crop_birds.py         從各章拼圖裁出去背鳥圖（SHEETS 設定；拼圖缺的鳥用 SINGLES 單張圖補，或用 REUSE 沿用其他章的同種鳥圖；
                        可指定章節：python tools/crop_birds.py level02）
  place_birds.py        以「腳的位置 + 鳥寬（像素）」擺鳥，寫回關卡 JSON
  add_species.py        關卡用到、但 data/birds.json 還沒有的鳥種，從各章 CSV 補上資料
  check_level.py        檢查關卡：鳥種與鳥圖都存在，且每隻鳥在某個倍率下都能「單獨入鏡」
  preview_level.py      用遊戲同一套公式合成關卡預覽圖
photo/
  first-story-birds/    第 1 章原始素材（場景、10 鳥拼圖、單張照片）
  second-story-birds/   第 2 章原始素材（10 鳥拼圖、單張照片）
  third…tenth-story-birds/  第 3–10 章原始素材（場景、鳥類拼圖、以中文命名的單張補圖）
first-story-birds.csv … tenth-story-36birds.csv  各章鳥種資料（forth = 第 4 章；第 9、10 章為 *-36birds.csv）
second-story-image-map.html                      第 2 關原型（場景圖、熱區、停留秒數的來源）
bird-image-map.html     早期單頁原型（保留對照）
```

### 新增 / 調整一個關卡

編輯 `data/levels/levelNN.json`：

```json
{
  "id": 3, "title": "溪流賞鳥", "scene": "scenes/stream.png",
  "zoomMode": "stepped", "devices": ["phone", "scope"],
  "requiredSpecies": 7, "consecutiveDaysUnlock": 3,
  "birds": [
    { "species": "little-egret", "x": 0.42, "y": 0.63, "scale": 0.04, "art": "cutout", "flip": false, "hint": "淺灘" }
  ]
}
```

- `x` / `y`：鳥中心在場景圖上的正規化座標（0–1）。
- `scale`：鳥的寬度佔場景寬的比例；高度依圖片比例自動計算，熱區由此產生，不需另外標。
- `art`：`cutout`＝去背圖直接合成在場景上；`inset`＝帶背景照片，以圓形羽化遮罩呈現。
- `flip`：左右翻轉，讓鳥面向合理的方向。
- `behavior` / `stay`：行為描述與停留秒數（有 `stay` 才會倒數）。
- 關卡層級的 `birdDir`：該關鳥圖的資料夾（預設 `birds`，第 2–6 關為 `birds/level02` ~ `birds/level06`），同一種鳥各章可以用不同姿勢的圖。
- `species`：對應 `data/birds.json` 的鍵，也就是 `assets/<風格>/birds/<species>.png` 的檔名。
- 移除關卡 JSON 中的 `"assetStatus": "stub"` 之後，該關才會在選單中變成可點選。

擺鳥建議用工具，依序：
1. `python tools/crop_birds.py levelNN`：裁出該章鳥圖（看 `tools/_contact-sheet-levelNN.png` 確認）。
2. 在 `tools/place_birds.py` 填入每隻鳥「腳的像素位置」與寬度，`python tools/place_birds.py data/levels/levelNN.json` 寫回 JSON。
3. `python tools/add_species.py`：補上 birds.json 缺的鳥種資料。
4. `python tools/check_level.py data/levels/levelNN.json`：每隻鳥都要能單獨入鏡（太近的鳥要拉開）。
5. `python tools/preview_level.py data/levels/levelNN.json out.jpg --boxes`：產出合成預覽確認。

## 打包與發佈

共同步驟（每次改了遊戲都要重做）：

```bash
python tools/stage_web.py
```

```bash
python tools/make_icons.py --android
```

**Windows（Electron + Inno Setup）**

```bash
cd desktop && npm install && npm run package
```

```bash
"/c/Users/ecgm6/AppData/Local/Programs/Inno Setup 6/ISCC.exe" installer/bird-view.iss
```

輸出 `release/BirdView-Setup-v0.4.exe`：免系統管理員權限、可選桌面捷徑（預設勾選）、開始功能表與解除安裝。
桌面版以 `app://bird-view/` 協定載入遊戲，只允許麥克風權限，F11 切換全螢幕。

**Android（Capacitor）**

```bash
cd android-app && npm install && npx cap sync android
```

```bash
cd android-app/android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleRelease
```

Gradle wrapper 設為本機已有的 8.14.3（`android/gradle/wrapper/gradle-wrapper.properties`）；Capacitor 預設的 8.11.1 在這台電腦下載中斷過。

APK 在 `android-app/android/app/build/outputs/apk/release/app-release.apk`，複製為 `release/BirdView-v0.4.apk`。
改版時記得同步版本號：`desktop/package.json`（含 `--app-version`）、`android-app/package.json`、`installer/bird-view.iss`、
`android-app/android/app/build.gradle`（versionCode 要遞增）。
簽章使用 `android-app/keystore/`（`birdview-release.jks` 與 `keystore.properties`）——**請另外備份**，遺失後無法以同一簽章更新已安裝的 App；不要放進 release 或公開的版本庫。

## 素材授權

`data/birds.json` 每一種鳥都保留 `photographer` / `signature` / `license` / `gps` / `exif` 欄位，圖鑑詳情頁會顯示；目前 AI 生成的圖標為 `source: "ai-generated"`。與賞鳥社團或拍鳥專家取得授權後，把攝影者、簽名檔、GPS 與攝影參數填入即可，不需要改程式。

待補素材清單見 [assets/MISSING.md](assets/MISSING.md)。
