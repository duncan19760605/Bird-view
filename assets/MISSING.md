# 待補素材清單

程式在載入關卡時會偵測缺圖：找不到的檔案會在瀏覽器 console 以
`[走，賞鳥趣] 缺少素材：[...]` 列出，畫面上以灰色剪影佔位，不會中斷遊戲。

## 1. 第 1–10 關 ✅ 素材齊全

| 關 | 場景 | 鳥圖 | 鳥種數 / 過關 |
|---|---|---|---|
| 1 公園（大安森林公園） | `scenes/park.png` | `birds/*.png` | 8 / 5 |
| 2 植物園（台北市植物園） | `scenes/botanical.png` | `birds/level02/` | 10 / 6 |
| 3 濕地（關渡自然公園） | `scenes/guandu.png` | `birds/level03/` | 10 / 7 |
| 4 農田（田寮洋） | `scenes/tianliaoyang.png` | `birds/level04/` | 16 / 10 |
| 5 海岸濕地（鰲鼓濕地） | `scenes/aogu.png` | `birds/level05/` | 24 / 14 |
| 6 高山森林（大雪山） | `scenes/dasyueshan.png` | `birds/level06/` | 30 / 18（無段變焦） |
| 7 紅樹林（淡水河口・關渡八里） | `scenes/mangrove.png` | `birds/level07/` | 29 / 20 |
| 8 高山草原（合歡山） | `scenes/hehuan.png` | `birds/level08/` | 22 / 15 |
| 9 猛禽過境（墾丁社頂・滿州） | `scenes/kenting.png` | `birds/level09/` | 35 / 23 |
| 10 黑面琵鷺（台江・七股） | `scenes/taijiang.png` | `birds/level10/` | 34 / 24 |

第 6–10 關都是無段變焦。每關都用 `python tools/check_level.py data/levels/levelNN.json` 確認過：每隻鳥在某個倍率下都能單獨入鏡。

## 2. 鳥類去背圖 ✅ 已完成

各章都從去背拼圖裁出透明 PNG，鳥直接合成在場景上。重新裁切：`python tools/crop_birds.py [level03 …]`。

- 第 3 章使用 `photo/third-story-birds/鳥類野外圖鑑貼紙表.png`（`third-story-10 birds.png` 的花嘴鴨畫成了綠頭鴨，不使用）。
- 第 4 章拼圖右下的第 16 隻是重複的黃鶺鴒，不使用。
- 拼圖缺的鳥以單張去背圖（`photo/<章>/<中文名>.png`）補上，設定在 `crop_birds.py` 的 `SINGLES`：
  第 4 章高蹺鴴；第 5 章花嘴鴨、小燕鷗、黑腹燕鷗、黑翅鳶；第 6 章台灣紫嘯鶇、白眉鶇、白腹鶇、灰面鵟鷹、松鴉、大冠鷲（檔名為「林鵰.png」）。
- 第 6 章拼圖有 30 隻，其中 5 隻未使用（無法可靠辨識、與其他鳥重複，或已有單張圖）。
- 第 7–10 章拼圖的裁切矩形由 alpha 連通區塊自動量出；第 8 章是有編號標籤的圖卡（`eighth-story-30birds.png`），
  以 `alphaOn: 64` 排除卡片底色與標籤。各章未使用的鳥寫在 `crop_birds.py` 的註解。
- 拼圖沒有、或畫錯的鳥，以 `crop_birds.py` 的 `REUSE` 沿用其他章已裁好的同種鳥圖：
  第 7 章魚鷹（L5）、紅冠水雞（L2）、白冠雞與紅尾伯勞（L4）、白腹秧雞（L9）；
  第 8 章栗背林鴝、冠羽畫眉、白眉林鴝、紅尾鶲、赤腹鷹、白眉鶇（L6）與東方蜂鷹、白喉針尾雨燕（L9）；
  第 9 章白頭翁（L5）、紅嘴黑鵯（L1）；第 10 章小環頸鴴、磯鷸（L7）。

## 3. 彩繪鉛筆風格素材 ✅ 已完成

| 路徑 | 說明 |
|---|---|
| `assets/pencil/scenes/*.png` | 與 realistic 同名的鉛筆風景 |
| `assets/pencil/birds/*.png`、`assets/pencil/birds/levelNN/*.png` | 與 realistic 同名的鉛筆鳥圖 |

**第 1–10 關都已換成兒童童書彩鉛插畫**（`assets/pencil-cartoon/`，10 張場景、218 張鳥圖，已逐關目視驗收；1–6 關 v0.4、7–10 關 v0.4.5）。

第 1–10 關的 10 張場景與 220 張鳥圖皆已建立一一對應的彩繪鉛筆版，透明鳥圖保留原 alpha，構圖與碰撞框不變。共同紙紋為 `assets/pencil/paper-texture.png`；可用 `tools/make_pencil_assets.py` 重新產生。

## 4. 第 7–10 關：CSV 有但沒有圖（未收錄）

| 關 | 鳥種 | 原因 |
|---|---|---|
| 7 | 翠鳥 | 拼圖沒有 |
| 8 | 台灣叢樹鶯、黃羽鶯嘴、台灣鷦鷯、黃山雀、茶腹鳾、灰林鴿、赤腹鶇、虎鶇、斑點鶇、中杜鵑、鷹鵑 | 拼圖沒有 |
| 8 | 岩鷚、白耳畫眉 | 圖卡的圖與鳥種外觀不符（岩鷚畫成鷚類、白耳畫眉畫成噪眉） |
| 9 | 洋燕 | 拼圖兩隻燕子都是家燕樣貌（長尾叉） |
| 10 | 綠簑鷺 | 拼圖畫成黃小鷺樣貌 |
| 10 | 蒙古鴴 | 拼圖沒有 |

第 8 關另外收錄了 5 種圖卡上有、CSV 沒有的高山鳥：台灣帝雉（黑長尾雉）、星鴉、青背山雀、黃尾鴝、林鵰。
圖卡的「酒紅朱雀」與 CSV 的「台灣朱雀」是同一種（*Carpodacus formosanus*），以紅色雄鳥圖收錄一次。

補圖：單張去背圖放 `photo/<章>/<中文名>.png`，在 `crop_birds.py` 的 `SINGLES` 加一行、`place_birds.py` 加位置，
再依序執行 `crop_birds.py`、`place_birds.py`、`add_species.py`、`check_level.py`。

## 5. 授權資訊

`data/birds.json` 每種鳥都有 `photographer` / `signature` / `license` / `gps` / `exif` 欄位，
圖鑑詳情頁會自動顯示（欄位空白則不顯示）。目前 AI 生成圖標為 `source: "ai-generated"`。
與賞鳥社團、拍鳥專家取得授權後填入即可。

## 6. 待確認

- 第二章拼圖中的「黑冠麻鷺」外觀（褐色縱紋、黃眼）較像**夜鷺亞成鳥**；黑冠麻鷺應為栗褐色、黑色頂冠、藍色眼先。此圖會進圖鑑，建議換圖。
- `photo/first-story-birds/second-story-birds.png` 是 UI 概念圖，鳥種（臺灣擬啄木、翠鳥、原鴿…）與 `second-story-birds.csv` 不符，遊戲未使用。
- **AI 圖外觀與真實鳥種有落差**（已上線，建議之後換圖）：
  - 第 4 章白翅黑燕鷗：圖為灰身黑頭，真實繁殖羽為黑身白翼。
  - 第 4 章紅尾伯勞：頭頂灰色較像灰頭亞種（*lucionensis*），可接受。
  - 第 5 章白琵鷺：粉色嘴（幼鳥特徵），以幼鳥身分收錄。東方澤鵟圖偏金褐色。
  - 第 6 章金翼白眉：圖中沒有金黃色翼緣；黃胸藪眉：圖為紅喉，真實為黃色臉胸；黃腹琉璃：圖中腹部沒有橙黃色；台灣紫嘯鶇（拼圖版）不像，已改用單張圖；赤腹鷹：圖為多縱斑的幼鳥樣貌。
- **CSV 已修正**（`sixth-story-birds.csv`）：白耳畫眉 → 台灣噪眉（金翼白眉）、台灣噪眉 → 黃胸藪眉、鵲鴝 → 栗背林鴝、熊鷹（Black Eagle）→ 林鵰、林鵰（Crested Serpent Eagle）→ 大冠鷲、白眉林鴝狀態改為留鳥、白尾鴝學名改為 *Myiomela leucura*。
- **第 7–10 章 AI 圖的落差**（已上線，建議之後換圖）：
  - 第 7 章黑腹燕鷗：圖為白身、黑色耳斑、紅嘴紅腳，較像紅嘴鷗冬羽，以非繁殖羽收錄；黃小鷺縱紋較多，較像亞成鳥。
  - 第 8 章圖卡解析度低（每隻約 105–140 px），望遠鏡高倍率下會放大變模糊，建議換高解析圖；星鴉圖偏黑白，真實為巧克力褐色帶白點。
  - 第 9 章三隻雨燕外觀相近，依喉部白斑與尾形分配為白喉針尾雨燕、叉尾雨燕、小雨燕。
  - 第 10 章東方環頸鴴的胸帶畫得較完整（較像環頸鴴）；彎嘴濱鷸、黑尾鷸為非繁殖羽。
- **閒置檔案**：`photo/tenth-story-birds/ninth-story.png`、`fifth-story-20birds.png` 是其他章的複本；
  `ninth-story-birds.csv` 與 `ninth-story-36birds.csv` 內容相同；第 8 章的 `第八關_…素材示意.png` 背景是烘焙進圖的棋盤格，未使用。
- **CSV 有但遊戲未收錄**（沒有合適的圖）：第 6 章白喉噪眉、黃山雀（拼圖中的黃腹山雀圖其實是青背山雀樣貌）、赤腹鶇。補上單張去背圖後，在 `crop_birds.py` 的 `SINGLES` 與 `place_birds.py` 加一行即可。
