"""檢查關卡：鳥種與鳥圖都存在、鳥框在場景內，而且每一隻鳥都能「單獨入鏡」。

公式與遊戲相同（js/capture.js、js/camera.js、js/device.js、js/config.js）：
  - 鳥框：寬 = scale，高 = scale × 場景寬高比 × 鳥圖高寬比
  - 視野：寬 = (1/3) / 倍率，高 = 寬 × 場景寬高比；中心夾在場景內
  - 入鏡：鳥框 60% 以上在視野內；或鳥身中心在視野內且鳥佔滿視野一半以上
對每隻鳥試手機 1–6X（每 0.25）與望遠鏡 10–20X（每 0.5）：視野中心對準鳥，
再加上玩家實際對不準的誤差（±min(視野/6, 1X 半步)，3×3 個偏移取最差情況），
要有某個倍率「每個偏移都只拍到這一隻」才算可拍。

用法：python tools/check_level.py data/levels/level07.json [level08.json ...]
"""
import json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.stdout.reconfigure(encoding="utf-8")   # 輸出被導向檔案或管線時（cp950）也能印中文
BASE_FOV, BASE_STEPS, COVER, FILL, STAY = 1 / 3, 20, 0.6, 0.5, 0.15
ZOOMS = [("phone", 1 + 0.25 * i) for i in range(21)] + [("scope", 10 + 0.5 * i) for i in range(21)]


def bird_box(b, aspect):
    w = b["scale"]
    h = w * aspect * (b["ar"] if b.get("art") == "cutout" else 1)
    return (b["x"] - w / 2, b["y"] - h / 2, b["x"] + w / 2, b["y"] + h / 2)


def in_frame(box, view):
    iw = min(box[2], view[2]) - max(box[0], view[0])
    ih = min(box[3], view[3]) - max(box[1], view[1])
    if iw <= 0 or ih <= 0:
        return False
    inter = iw * ih
    if inter / ((box[2] - box[0]) * (box[3] - box[1])) >= COVER:
        return True
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    centered = view[0] <= cx <= view[2] and view[1] <= cy <= view[3]
    return centered and inter / ((view[2] - view[0]) * (view[3] - view[1])) >= FILL


def view_at(cx, cy, zoom, aspect):
    w = BASE_FOV / zoom
    h = w * aspect
    hw, hh = min(w, 1) / 2, min(h, 1) / 2
    cx = min(max(cx, hw), 1 - hw)
    cy = min(max(cy, hh), 1 - hh)
    return (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)


def check(path):
    p = Path(path)
    lv = json.loads(p.read_text(encoding="utf-8"))
    db = json.loads((ROOT / "data" / "birds.json").read_text(encoding="utf-8"))
    scene = Image.open(ROOT / "assets" / "realistic" / lv["scene"])
    aspect = scene.width / scene.height
    bird_dir = ROOT / "assets" / "realistic" / lv.get("birdDir", "birds")
    errors, warns = [], []
    birds = lv["birds"]
    for b in birds:
        f = bird_dir / f"{b['species']}.png"
        if b["species"] not in db:
            errors.append(f"{b['species']}：birds.json 沒有這個鳥種")
        if not f.exists():
            errors.append(f"{b['species']}：缺少鳥圖 {f.relative_to(ROOT)}")
            b["ar"] = 1
        else:
            im = Image.open(f)
            b["ar"] = im.height / im.width
    if len({b["species"] for b in birds}) != len(birds):
        errors.append("同一種鳥出現兩次（遊戲以鳥種當鍵，只能有一隻）")
    boxes = [bird_box(b, aspect) for b in birds]
    half1x = ((1 - BASE_FOV) / BASE_STEPS / 2, (1 - min(BASE_FOV * aspect, 1)) / BASE_STEPS / 2)

    rows = []
    for i, (b, box) in enumerate(zip(birds, boxes)):
        if box[0] < 0 or box[1] < 0 or box[2] > 1 or box[3] > 1:
            warns.append(f"{b['species']}：鳥框超出場景")
        ok = {}
        for dev, z in ZOOMS:
            w = BASE_FOV / z
            tx, ty = min(w / 6, half1x[0]), min(w * aspect / 6, half1x[1])
            good = True
            for ox in (-tx, 0, tx):
                for oy in (-ty, 0, ty):
                    v = view_at(b["x"] + ox, b["y"] + oy, z, aspect)
                    hits = [j for j, bx in enumerate(boxes) if in_frame(bx, v)]
                    if hits != [i]:
                        good = False
                        break
                if not good:
                    break
            if good and dev not in ok:
                ok[dev] = z
        stay_z = STAY * BASE_FOV / b["scale"]
        name = db.get(b["species"], {}).get("zh", b["species"])
        if not ok:
            errors.append(f"{b['species']}（{name}）：任何倍率都無法單獨入鏡（離其他鳥太近）")
        rows.append((b["species"], name, ok.get("phone"), ok.get("scope"), stay_z, b.get("stay")))

    print(f"{p.name}：{len(birds)} 隻，過關 {lv.get('requiredSpecies')} 種，場景 {scene.width}x{scene.height}")
    print(f"  {'鳥種':30s} {'名稱':8s} 手機最低  望遠鏡最低  開始倒數  停留")
    for sp, name, ph, sc, sz, st in rows:
        f = lambda z: f"{z:5.2f}X" if z else "   —  "
        print(f"  {sp:30s} {name:8s} {f(ph)}   {f(sc)}    {sz:5.1f}X   {st or '—'}")
    for w in warns:
        print("  警告：" + w)
    for e in errors:
        print("  錯誤：" + e)
    return not errors


if __name__ == "__main__":
    results = [check(a) for a in sys.argv[1:]]
    sys.exit(0 if all(results) else 1)
