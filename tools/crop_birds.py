"""
從各章的去背 10 鳥拼圖裁出每一隻鳥，輸出透明背景 PNG：
  第 1 章 photo/first-story-birds/first-story-10 birds.png   → assets/realistic/birds/
  第 2 章 photo/second-story-birds/second-story-10 birds.png → assets/realistic/birds/level02/
  第 3–10 章 photo/third…tenth-story-birds/…               → assets/realistic/birds/level03…level10/
  另有 SINGLES：拼圖缺的鳥以單張去背圖補上；REUSE：沿用其他章已裁好的同種鳥圖

作法：每隻鳥先取一個寬鬆的矩形，再用 alpha 連通區塊只保留鳥本體，
去掉標籤膠囊與虛線框，最後緊貼裁切並留少量邊距。

用法：python tools/crop_birds.py [level01 level02 ...]
"""
import shutil
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent

# 每一章一張去背拼圖。rect 為寬鬆矩形 (x0, y0, x1, y1)，只要把鳥整隻框進去即可，
# 標籤、虛線、鄰鳥碎片會由 cut() 以「只留最大區塊」去掉。
SHEETS = [
    {
        "name": "level01",
        "src": ROOT / "photo" / "first-story-birds" / "first-story-10 birds.png",
        "out": ROOT / "assets" / "realistic" / "birds",
        "rects": {
            "eurasian-tree-sparrow":     (10, 195, 318, 460),
            "light-vented-bulbul":       (300, 150, 618, 505),
            "swinhoes-white-eye":        (640, 185, 918, 452),
            "black-crowned-night-heron": (935, 135, 1258, 490),
            "taiwan-barbet":             (1262, 128, 1510, 510),
            "little-egret":              (20, 578, 368, 950),
            "grey-treepie":              (355, 592, 660, 980),
            "oriental-magpie":           (612, 582, 985, 975),
            "black-bulbul":              (955, 598, 1220, 980),
            "spotted-dove":              (1170, 622, 1515, 925),
        },
    },
    {
        "name": "level02",
        "src": ROOT / "photo" / "second-story-birds" / "second-story-10 birds.png",
        "out": ROOT / "assets" / "realistic" / "birds" / "level02",
        "rects": {
            "malayan-night-heron":       (25, 25, 420, 440),
            "common-moorhen":            (310, 165, 690, 428),
            "light-vented-bulbul":       (650, 85, 930, 440),
            "swinhoes-white-eye":        (905, 170, 1245, 428),
            "taiwan-barbet":             (1250, 70, 1520, 440),
            "crested-goshawk":           (25, 535, 372, 902),
            "eurasian-tree-sparrow":     (350, 695, 648, 902),
            "little-egret":              (640, 535, 952, 898),
            "black-crowned-night-heron": (915, 565, 1262, 898),
            "spotted-dove":              (1175, 600, 1520, 885),
        },
    },
    # 第 3–6 章的拼圖沒有虛線框，矩形已避開標籤，改用 thin 模式保留高蹺鴴等細長的腳。
    {
        "name": "level03",
        "src": ROOT / "photo" / "third-story-birds" / "鳥類野外圖鑑貼紙表.png",
        "out": ROOT / "assets" / "realistic" / "birds" / "level03",
        "thin": True,
        "rects": {
            "black-faced-spoonbill":     (15, 44, 413, 465),
            "grey-heron":                (409, 13, 731, 464),
            "little-egret":              (730, 108, 1046, 464),
            "black-crowned-night-heron": (1050, 165, 1373, 463),
            "black-winged-stilt":        (1388, 165, 1662, 461),
            "little-ringed-plover":      (26, 654, 280, 834),
            "spot-billed-duck":          (298, 582, 640, 834),
            "northern-pintail":          (643, 581, 1035, 834),
            "northern-shoveler":         (1003, 632, 1347, 834),
            "osprey":                    (1346, 539, 1660, 835),
        },
    },
    {
        "name": "level04",
        "src": ROOT / "photo" / "forth-story-birds" / "forth-story-16 birds.png",
        "out": ROOT / "assets" / "realistic" / "birds" / "level04",
        "thin": True,
        "rects": {
            "plain-prinia":            (65, 50, 361, 277),
            "taiwan-barbet":           (376, 12, 664, 278),
            "taiwan-scimitar-babbler": (680, 39, 1087, 279),
            "black-kite":              (1140, 6, 1509, 302),
            "spot-billed-duck":        (14, 268, 390, 509),
            "little-ringed-plover":    (406, 285, 740, 509),
            "brown-shrike":            (747, 268, 1098, 500),
            "eastern-yellow-wagtail":  (1147, 283, 1504, 493),
            "eurasian-coot":           (41, 504, 399, 770),
            "eurasian-teal":           (370, 516, 740, 754),
            "northern-shoveler":       (754, 519, 1152, 750),
            "grey-faced-buzzard":      (1163, 478, 1482, 768),
            "wood-sandpiper":          (30, 756, 386, 1005),
            "osprey":                  (328, 727, 762, 1009),
            "white-winged-tern":       (734, 792, 1141, 1009),
            # 右下第 16 隻是重複的黃鶺鴒，不使用
        },
    },
    {
        "name": "level05",
        "src": ROOT / "photo" / "fifth-story-birds" / "fifth-story-20birds.png",
        "out": ROOT / "assets" / "realistic" / "birds" / "level05",
        "thin": True,
        "rects": {
            "black-faced-spoonbill": (30, 12, 358, 309),
            "eurasian-spoonbill":    (363, 16, 655, 307),
            "great-egret":           (666, 12, 973, 319),
            "little-egret":          (977, 47, 1251, 309),
            "grey-heron":            (1248, 12, 1522, 324),
            "black-winged-stilt":    (26, 308, 320, 546),
            "pied-avocet":           (336, 306, 651, 545),
            "little-ringed-plover":  (636, 337, 891, 538),
            "common-greenshank":     (911, 323, 1222, 540),
            "common-redshank":       (1238, 335, 1519, 539),
            "eurasian-curlew":       (13, 538, 372, 762),
            "northern-pintail":      (286, 541, 640, 757),
            "eurasian-wigeon":       (628, 547, 910, 752),
            "northern-shoveler":     (936, 558, 1251, 758),
            "eurasian-teal":         (1241, 556, 1528, 760),
            "great-cormorant":       (12, 746, 308, 1002),
            "osprey":                (323, 746, 600, 999),
            "eastern-marsh-harrier": (619, 754, 910, 1004),
            "oriental-magpie-robin": (925, 789, 1227, 995),
            "light-vented-bulbul":   (1235, 785, 1517, 998),
        },
    },
    {
        "name": "level06",
        "src": ROOT / "photo" / "sixth-story-birds" / "sixfth-story-20birds.png",
        "out": ROOT / "assets" / "realistic" / "birds" / "level06",
        "thin": True,
        "rects": {
            "swinhoes-pheasant":        (6, 1, 367, 253),
            "mikado-pheasant":          (324, 10, 629, 251),
            "taiwan-partridge":         (624, 31, 825, 259),
            "taiwan-laughingthrush":    (796, 53, 1103, 253),
            "taiwan-yuhina":            (1066, 45, 1282, 256),
            "flamecrest":               (1258, 78, 1436, 251),
            "taiwan-liocichla":         (315, 256, 616, 451),
            "grey-cheeked-fulvetta":    (584, 262, 828, 453),
            "green-backed-tit":         (788, 270, 1049, 453),
            "coal-tit":                 (1012, 283, 1244, 451),
            "rusty-laughingthrush":     (3, 446, 352, 643),
            "white-browed-bush-robin":  (307, 459, 546, 647),
            "collared-bush-robin":      (520, 459, 745, 650),
            "ferruginous-flycatcher":   (711, 461, 963, 658),
            "vivid-niltava":            (924, 458, 1188, 656),
            "white-tailed-robin":       (1186, 462, 1440, 666),
            "brown-bullfinch":          (10, 657, 249, 881),
            "black-eagle":              (227, 649, 498, 921),
            "chinese-sparrowhawk":      (487, 653, 698, 914),
            "white-backed-woodpecker":  (712, 661, 901, 943),
            "grey-chinned-minivet":     (866, 677, 1189, 890),
            "yellow-browed-warbler":    (17, 914, 279, 1081),
            "taiwan-rosefinch":         (253, 908, 535, 1082),
            "daurian-redstart":         (1035, 889, 1283, 1080),
            # 未使用（無法可靠辨識、與上列重複，或已有單張圖）：第 2 列左 1、右 1，第 4 列右 1，第 5 列第 3、4、6 隻
        },
    },
    # 第 7–10 章：矩形由 alpha 連通區塊自動量出（外擴 2–3px）；第 8 章是有編號標籤與淡色卡片底的圖卡，
    # 卡片底與標籤的 alpha 約 25–63，以 alphaOn 64 排除，矩形只框鳥本體。
    {
        "name": "level07",
        "src": ROOT / "photo" / "seventh-story-birds" / "seventh-story-30 birds.png",
        "out": ROOT / "assets" / "realistic" / "birds" / "level07",
        "thin": True,
        "rects": {
            "black-faced-spoonbill":     (28, 17, 273, 276),
            "grey-heron":                (289, 12, 515, 277),
            "great-egret":               (517, 8, 751, 277),
            "intermediate-egret":        (762, 27, 965, 273),
            "little-egret":              (997, 57, 1210, 273),
            "eastern-cattle-egret":      (1249, 41, 1423, 273),
            "black-crowned-night-heron": (35, 292, 262, 491),
            "yellow-bittern":            (536, 292, 723, 489),
            "spot-billed-duck":          (969, 312, 1218, 484),
            "eurasian-teal":             (1219, 355, 1434, 461),
            "northern-shoveler":         (15, 515, 281, 643),
            "northern-pintail":          (263, 498, 529, 669),
            "black-winged-stilt":        (706, 462, 932, 682),
            "little-ringed-plover":      (1221, 501, 1432, 660),
            "wood-sandpiper":            (231, 674, 443, 846),
            "common-greenshank":         (437, 674, 669, 844),
            "common-redshank":           (669, 683, 902, 843),
            "common-sandpiper":          (918, 703, 1146, 843),
            "eurasian-curlew":           (1120, 646, 1435, 846),
            "white-winged-tern":         (190, 850, 363, 1034),
            "little-tern":               (355, 877, 560, 1065),
            "whiskered-tern":            (546, 855, 832, 1063),
            "black-kite":                (772, 841, 1027, 1082),
            "black-winged-kite":         (1057, 832, 1240, 1057),
            # 未使用：夜鷺亞成鳥、第二隻黃小鷺、紅頭潛鴨、反嘴鴴、另一隻環頸鴴、深色燕鷗、大冠鷲（CSV 沒有或重複）
        },
    },
    {
        "name": "level08",
        "src": ROOT / "photo" / "eighth-story-birds" / "eighth-story-30birds.png",
        "out": ROOT / "assets" / "realistic" / "birds" / "level08",
        "thin": True,
        "alphaOn": 64,
        "rects": {
            "black-eagle":                 (26, 60, 154, 196),
            "grey-faced-buzzard":          (193, 59, 313, 191),
            "mikado-pheasant":             (619, 62, 758, 176),
            "taiwan-rosefinch":            (929, 68, 1063, 180),
            "taiwan-laughingthrush":       (1234, 82, 1365, 165),
            "flamecrest":                  (1391, 72, 1496, 172),
            "green-backed-tit":            (183, 220, 316, 323),
            "coal-tit":                    (333, 223, 456, 323),
            "yellow-bellied-bush-warbler": (936, 222, 1062, 319),
            "taiwan-whistling-thrush":     (1381, 217, 1512, 327),
            "pale-thrush":                 (194, 366, 315, 476),
            "daurian-redstart":            (334, 370, 454, 472),
            "spotted-nutcracker":          (1078, 369, 1197, 477),
            "eurasian-jay":                (1222, 368, 1360, 476),
            # 酒紅朱雀（紅色雄鳥）與台灣朱雀是同一種 Carpodacus formosanus，用作 taiwan-rosefinch。
            # 未使用：大冠鷲、黃魚鴞、竹雞、台灣朱雀（褐色）、紅頭山雀、冠羽畫眉、繡眼畫眉、白耳畫眉、棕面鶯、
            # 栗背林鴝、白眉鶇、鉛色水鶇、岩鷚、褐翼鶇、臺灣鷦鶯、紅嘴山鴉（非高山鳥、外觀與鳥種不符，或改用 L6 圖）
        },
    },
    {
        "name": "level09",
        "src": ROOT / "photo" / "ninth-story-birds" / "ninth-story-36birds.png",
        "out": ROOT / "assets" / "realistic" / "birds" / "level09",
        "thin": True,
        "rects": {
            "chinese-sparrowhawk":          (14, 5, 205, 187),
            "grey-faced-buzzard":           (249, 4, 495, 190),
            "oriental-honey-buzzard":       (483, 5, 727, 199),
            "japanese-sparrowhawk":         (721, 4, 985, 193),
            "crested-goshawk":              (991, 7, 1153, 212),
            "crested-serpent-eagle":        (1251, 5, 1410, 193),
            "black-kite":                   (14, 185, 271, 384),
            "osprey":                       (255, 181, 510, 372),
            "peregrine-falcon":             (509, 183, 730, 380),
            "common-kestrel":               (744, 189, 984, 388),
            "black-winged-kite":            (987, 201, 1168, 388),
            "pacific-swift":                (1234, 192, 1416, 388),
            "white-throated-needletail":    (33, 374, 226, 562),
            "house-swift":                  (276, 374, 456, 560),
            "barn-swallow":                 (717, 377, 968, 555),
            "oriental-dollarbird":          (996, 378, 1180, 568),
            "styans-bulbul":                (46, 548, 263, 725),
            "swinhoes-white-eye":           (494, 572, 725, 710),
            "taiwan-barbet":                (744, 550, 944, 717),
            "grey-treepie":                 (952, 537, 1191, 730),
            "taiwan-scimitar-babbler":      (1172, 562, 1432, 717),
            "taiwan-hwamei":                (28, 716, 263, 889),
            "oriental-magpie-robin":        (270, 715, 503, 872),
            "brown-shrike":                 (505, 716, 712, 896),
            "blue-rock-thrush":             (708, 710, 924, 877),
            "grey-wagtail":                 (926, 731, 1214, 864),
            "white-wagtail":                (1188, 728, 1438, 873),
            "black-naped-monarch":          (14, 891, 239, 1062),
            "grey-capped-pygmy-woodpecker": (291, 880, 395, 1077),
            "large-billed-crow":            (469, 874, 720, 1066),
            "white-breasted-waterhen":      (722, 879, 962, 1067),
            "collared-scops-owl":           (1024, 868, 1145, 1069),
            "crested-myna":                 (1243, 868, 1439, 1073),
            # 赤腹鷹與黑鳶在拼圖中相連，以 y≈186 分開。未使用：紅耳鵯樣貌（白頭翁改用 L5）、灰色鵯（紅嘴黑鵯改用 L1，
            # 拼圖的嘴腳不是紅色）、背面的家燕（洋燕沒有圖）
        },
    },
    {
        "name": "level10",
        "src": ROOT / "photo" / "tenth-story-birds" / "tenth-story-36birds.png",
        "out": ROOT / "assets" / "realistic" / "birds" / "level10",
        "thin": True,
        "rects": {
            "black-faced-spoonbill":     (26, 16, 250, 215),
            "great-cormorant":           (475, 27, 754, 209),
            "grey-heron":                (767, 19, 951, 215),
            "great-egret":               (1000, 12, 1185, 215),
            "intermediate-egret":        (1248, 12, 1427, 209),
            "little-egret":              (21, 217, 216, 406),
            "black-crowned-night-heron": (266, 224, 444, 401),
            "eastern-cattle-egret":      (507, 213, 670, 406),
            "black-winged-stilt":        (976, 219, 1196, 416),
            "pied-avocet":               (1221, 227, 1440, 409),
            "kentish-plover":            (25, 434, 209, 584),
            "grey-plover":               (245, 413, 437, 585),
            "eurasian-curlew":           (477, 411, 717, 588),
            "whimbrel":                  (718, 417, 952, 591),
            "common-greenshank":         (973, 426, 1194, 596),
            "common-redshank":           (1220, 419, 1424, 590),
            "bar-tailed-godwit":         (19, 590, 249, 774),
            "black-tailed-godwit":       (239, 588, 493, 772),
            "wood-sandpiper":            (490, 598, 698, 772),
            "dunlin":                    (721, 626, 938, 762),
            "red-necked-stint":          (972, 637, 1196, 761),
            "curlew-sandpiper":          (1229, 608, 1414, 761),
            "northern-pintail":          (4, 763, 242, 886),
            "eurasian-wigeon":           (255, 774, 476, 886),
            "northern-shoveler":         (487, 782, 723, 879),
            "eurasian-teal":             (746, 775, 960, 883),
            "whiskered-tern":            (970, 777, 1196, 899),
            "little-tern":               (18, 928, 231, 1061),
            "caspian-tern":              (222, 897, 463, 1071),
            "osprey":                    (719, 879, 930, 1068),
            "peregrine-falcon":          (975, 896, 1178, 1067),
            "black-winged-kite":         (1216, 886, 1424, 1065),
            # 未使用：第二隻琵鷺、黃小鷺樣貌（綠簑鷺沒有圖）、黑頭燕鷗、紅嘴鷗
        },
    },
]

# 拼圖缺的鳥另外生成的單張去背圖（photo/<章>/<中文名>.png），整張當作一隻鳥裁切
SINGLES = {
    "level04": {"black-winged-stilt": "forth-story-birds/高蹺鴴.png"},
    "level05": {
        "spot-billed-duck":   "fifth-story-birds/花嘴鴨.png",
        "little-tern":        "fifth-story-birds/小燕鷗.png",
        "whiskered-tern":     "fifth-story-birds/黑腹燕鷗.png",
        "black-winged-kite":  "fifth-story-birds/黑翅鳶.png",
    },
    "level06": {
        "taiwan-whistling-thrush": "sixth-story-birds/台灣紫嘯鶇.png",
        "eyebrowed-thrush":        "sixth-story-birds/白眉鶇.png",
        "pale-thrush":             "sixth-story-birds/白腹鶇.png",
        "grey-faced-buzzard":      "sixth-story-birds/灰面鵟鷹.png",
        "eurasian-jay":            "sixth-story-birds/松鴉.png",
        "crested-serpent-eagle":   "sixth-story-birds/林鵰.png",  # 檔名沿用 CSV 舊名；Spilornis cheela 的中文名是大冠鷲
    },
}
SINGLE_MAX = 420       # 單張圖解析度遠高於拼圖，縮到和拼圖裁出的鳥差不多大

# 沿用其他章已裁好的鳥圖（該章拼圖沒有、或畫錯的鳥），在所有拼圖處理完後複製：{章: {鳥: 來源章}}
REUSE = {
    "level07": {"osprey": "level05", "common-moorhen": "level02", "eurasian-coot": "level04",
                "brown-shrike": "level04", "white-breasted-waterhen": "level09"},
    "level08": {"collared-bush-robin": "level06", "taiwan-yuhina": "level06", "white-browed-bush-robin": "level06",
                "ferruginous-flycatcher": "level06", "chinese-sparrowhawk": "level06", "eyebrowed-thrush": "level06",
                "oriental-honey-buzzard": "level09", "white-throated-needletail": "level09"},
    "level09": {"light-vented-bulbul": "level05", "black-bulbul": "level01"},
    "level10": {"little-ringed-plover": "level07", "common-sandpiper": "level07"},
}
BIRDS = ROOT / "assets" / "realistic" / "birds"


def bird_dir(name):
    return BIRDS if name == "level01" else BIRDS / name


ALPHA_ON = 24          # 視為「有東西」的 alpha 門檻
PAD = 6


def cut(img: np.ndarray, rect, thin=False, alpha_on=ALPHA_ON):
    x0, y0, x1, y1 = rect
    sub = img[y0:y1, x0:x1].copy()
    a = sub[..., 3]
    solid = a > alpha_on

    if thin:
        # 沒有虛線框的拼圖：直接用原始 alpha 連通區塊，細腳、嘴尖都不會被削掉
        lab, n = ndimage.label(solid, structure=np.ones((3, 3)))
        if n == 0:
            raise RuntimeError(f"no pixels in {rect}")
        sizes = ndimage.sum(np.ones_like(a), lab, index=range(1, n + 1))
        # 往外留 2px 讓半透明羽緣保持柔和
        keep = ndimage.binary_dilation(lab == int(np.argmax(sizes)) + 1, structure=np.ones((3, 3)), iterations=2)
        sub[..., 3] = np.where(keep, a, 0)
        return trim(sub, alpha_on)

    # 先做 opening 把 1–3px 的虛線框切斷，避免它和鳥連成一塊
    opened = ndimage.binary_opening(solid, structure=np.ones((3, 3)), iterations=2)
    lab, n = ndimage.label(opened, structure=np.ones((3, 3)))
    if n == 0:
        raise RuntimeError(f"no pixels in {rect}")
    sizes = ndimage.sum(np.ones_like(a), lab, index=range(1, n + 1))
    main_id = int(np.argmax(sizes)) + 1

    # 只保留最大區塊 = 鳥本體（標籤膠囊、虛線框、鄰鳥的尾巴都是分離的小區塊）
    keep = [main_id]

    # 還原被 opening 削掉的細節（腳、嘴尖、羽緣），但只在原本有像素的地方
    grown = ndimage.binary_dilation(np.isin(lab, keep), structure=np.ones((3, 3)), iterations=4)
    sub[..., 3] = np.where(grown & (a > 0), a, 0)
    return trim(sub, alpha_on)


def trim(sub: np.ndarray, alpha_on=ALPHA_ON):
    """緊貼鳥本體裁切並留少量邊距"""
    ys, xs = np.nonzero(sub[..., 3] > alpha_on)
    by0, by1 = max(ys.min() - PAD, 0), min(ys.max() + PAD + 1, sub.shape[0])
    bx0, bx1 = max(xs.min() - PAD, 0), min(xs.max() + PAD + 1, sub.shape[1])
    return sub[by0:by1, bx0:bx1]


def process(sheet):
    img = np.array(Image.open(sheet["src"]).convert("RGBA"))
    out = sheet["out"]
    out.mkdir(parents=True, exist_ok=True)
    tiles = []
    for species, rect in sheet["rects"].items():
        bird = cut(img, rect, sheet.get("thin", False), sheet.get("alphaOn", ALPHA_ON))
        Image.fromarray(bird).save(out / f"{species}.png", optimize=True)
        tiles.append((species, bird))
        print(f"  {species:28s} {bird.shape[1]}x{bird.shape[0]}")
    for species, rel in SINGLES.get(sheet["name"], {}).items():
        im = np.array(Image.open(ROOT / "photo" / rel).convert("RGBA"))
        t = Image.fromarray(cut(im, (0, 0, im.shape[1], im.shape[0]), thin=True))
        t.thumbnail((SINGLE_MAX, SINGLE_MAX), Image.LANCZOS)
        t.save(out / f"{species}.png", optimize=True)
        tiles.append((species, np.array(t)))
        print(f"  {species:28s} {t.width}x{t.height}  <- {rel}")

    # 檢查用對照表（白底），方便肉眼確認沒有殘留標籤或虛線
    cell = 260
    rows = (len(tiles) + 4) // 5
    sheet_img = Image.new("RGBA", (cell * 5, cell * rows), (255, 255, 255, 255))
    for i, (_, bird) in enumerate(tiles):
        t = Image.fromarray(bird)
        t.thumbnail((cell - 10, cell - 10))
        sheet_img.alpha_composite(t, ((i % 5) * cell + (cell - t.width) // 2, (i // 5) * cell + (cell - t.height) // 2))
    preview = ROOT / "tools" / f"_contact-sheet-{sheet['name']}.png"
    sheet_img.convert("RGB").save(preview)
    print("  contact sheet ->", preview.relative_to(ROOT))


def main():
    only = sys.argv[1:]  # 可指定章節名稱，例如 python tools/crop_birds.py level02
    for sheet in SHEETS:
        if only and sheet["name"] not in only:
            continue
        print(sheet["name"], "<-", sheet["src"].relative_to(ROOT))
        process(sheet)
    for name, items in REUSE.items():
        if only and name not in only:
            continue
        for species, src in items.items():
            f = bird_dir(src) / f"{species}.png"
            if not f.exists():
                sys.exit(f"缺少 {f.relative_to(ROOT)}：請先裁切 {src}（python tools/crop_birds.py {src}）")
            shutil.copyfile(f, bird_dir(name) / f"{species}.png")
            print(f"  {name}/{species:28s} <- {src}")


if __name__ == "__main__":
    main()
