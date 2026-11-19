"""把關卡 JSON 的鳥用和遊戲相同的座標公式合成到場景上，輸出預覽圖，方便調位置。
用法：python tools/preview_level.py data/levels/level01.json out.jpg
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
lv = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
out = sys.argv[2]
scene = Image.open(ROOT / "assets/realistic" / lv["scene"]).convert("RGBA")
W, H = scene.size
draw = ImageDraw.Draw(scene)
for b in lv["birds"]:
    p = ROOT / "assets/realistic" / lv.get("birdDir", "birds") / f"{b['species']}.png"
    if not p.exists():
        continue
    im = Image.open(p).convert("RGBA")
    if b.get("flip"):
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    w = max(1, round(b["scale"] * W))
    h = max(1, round(w * im.height / im.width))
    im = im.resize((w, h), Image.LANCZOS)
    x0 = round(b["x"] * W - w / 2); y0 = round(b["y"] * H - h / 2)
    scene.alpha_composite(im, (x0, y0))
    if "--boxes" in sys.argv:
        draw.rectangle([x0, y0, x0 + w, y0 + h], outline=(255, 230, 0, 255), width=2)
scene.convert("RGB").save(out, quality=88)
print(out, W, H)
