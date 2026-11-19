"""Build deterministic coloured-pencil counterparts for every realistic game asset,
then overlay the hand-redrawn picture-book illustrations from assets/pencil-cartoon/.

覆蓋規則：assets/pencil-cartoon/manifest.json 中「整關素材都已生成，而且尺寸、alpha 檢查都通過」的關卡，
才用插畫取代濾鏡版；未完成的關卡整關保留濾鏡版，避免同一關混用兩種畫風。插畫補齊後重跑本工具即可。
"""
import json
import shutil
from collections import defaultdict
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "realistic"
DST = ROOT / "assets" / "pencil"
PAPER = DST / "paper-texture.png"
CARTOON = ROOT / "assets" / "pencil-cartoon"


def pencil_rgb(image: Image.Image, paper: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    soft = rgb.filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.GaussianBlur(.55))
    colour = ImageEnhance.Color(soft).enhance(1.28)
    colour = ImageEnhance.Brightness(colour).enhance(1.08)
    colour = ImageOps.posterize(colour, 5)
    raw_edges = ImageOps.autocontrast(rgb.convert("L").filter(ImageFilter.FIND_EDGES))
    lines = ImageOps.invert(raw_edges).filter(ImageFilter.GaussianBlur(.28))
    lines = Image.blend(Image.new("L", lines.size, 255), lines, .42)
    line_rgb = Image.merge("RGB", (lines, lines, lines))
    drawn = ImageChops.multiply(colour, line_rgb)
    texture = paper.resize(drawn.size, Image.Resampling.LANCZOS).convert("RGB")
    return Image.blend(drawn, texture, 0.13)


def main() -> None:
    if not PAPER.exists():
        raise SystemExit(f"Missing generated paper texture: {PAPER}")
    paper = Image.open(PAPER)
    count = 0
    for src in SRC.rglob("*.png"):
        rel = src.relative_to(SRC)
        dst = DST / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        original = Image.open(src)
        alpha = original.getchannel("A") if original.mode == "RGBA" else None
        out = pencil_rgb(original, paper)
        if alpha is not None:
            out.putalpha(alpha)
        out.save(dst, "PNG", optimize=True, compress_level=9)
        count += 1
    print(f"Created {count} coloured-pencil assets in {DST}")
    overlay_cartoon()


def overlay_cartoon() -> None:
    manifest = CARTOON / "manifest.json"
    if not manifest.exists():
        return
    items = json.loads(manifest.read_text(encoding="utf-8"))["assets"]
    by_level = defaultdict(list)
    for item in items:
        by_level[item["level"]].append(item)
    done = []
    for level, group in sorted(by_level.items()):
        ready = all(
            (ROOT / it["output"]).exists() and it["checks"].get("dimensions")
            and (it["kind"] != "bird" or it["checks"].get("alpha"))
            and it.get("status") not in ("pending", "invalid")
            for it in group
        )
        if not ready:
            continue
        for it in group:
            shutil.copyfile(ROOT / it["output"], DST / it["rel"])
        done.append(level)
    print(f"Picture-book illustrations overlaid for levels {done or 'none'}; other levels keep the filtered version")


if __name__ == "__main__":
    main()
