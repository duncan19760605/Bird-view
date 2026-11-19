"""由 photo/bird-view-icon.png 產生各平台圖示：
  build/icon.ico                                  Windows（exe 與安裝程式，16–256 多尺寸）
  android-app/android/app/src/main/res/mipmap-*   Android 一般圖示、圓形圖示與 adaptive icon 前景
  android-app/android/app/src/main/res/drawable*/splash.png  啟動畫面（深綠底＋置中圖示，保留原尺寸）

用法：python tools/make_icons.py [--android]
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "photo" / "bird-view-icon.png"
DENS = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
BG = (18, 41, 31, 255)     # 遊戲的深綠底色 #12291f


def square(im):
    w, h = im.size
    s = max(w, h)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(im, ((s - w) // 2, (s - h) // 2))
    return out


def main():
    src = square(Image.open(SRC).convert("RGBA"))
    (ROOT / "build").mkdir(exist_ok=True)
    ico = ROOT / "build" / "icon.ico"
    src.save(ico, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("->", ico.relative_to(ROOT))

    if "--android" in sys.argv:
        res = ROOT / "android-app" / "android" / "app" / "src" / "main" / "res"
        for d, px in DENS.items():
            folder = res / f"mipmap-{d}"
            folder.mkdir(parents=True, exist_ok=True)
            icon = src.resize((px, px), Image.LANCZOS)
            icon.save(folder / "ic_launcher.png")
            mask = Image.new("L", (px, px), 0)
            ImageDraw.Draw(mask).ellipse((0, 0, px - 1, px - 1), fill=255)
            rnd = Image.new("RGBA", (px, px), (0, 0, 0, 0))
            rnd.paste(icon, (0, 0), mask)
            rnd.save(folder / "ic_launcher_round.png")
            # adaptive icon 前景：108dp 畫布，圖示放在中央 72dp 安全區
            fg_px = px * 108 // 48
            fg = Image.new("RGBA", (fg_px, fg_px), (0, 0, 0, 0))
            inner = src.resize((px * 72 // 48, px * 72 // 48), Image.LANCZOS)
            fg.paste(inner, ((fg_px - inner.width) // 2, (fg_px - inner.height) // 2), inner)
            fg.save(folder / "ic_launcher_foreground.png")
        (res / "values" / "ic_launcher_background.xml").write_text(
            '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
            '    <color name="ic_launcher_background">#12291F</color>\n</resources>\n',
            encoding="utf-8")
        for sp in res.glob("drawable*/splash.png"):
            w, h = Image.open(sp).size
            canvas = Image.new("RGBA", (w, h), BG)
            side = int(min(w, h) * 0.55)
            icon = src.resize((side, side), Image.LANCZOS)
            canvas.paste(icon, ((w - side) // 2, (h - side) // 2), icon)
            canvas.convert("RGB").save(sp)
        print("-> android mipmap-*、splash")


if __name__ == "__main__":
    main()
