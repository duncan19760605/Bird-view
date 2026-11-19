"""把遊戲執行需要的檔案複製到 build/web/，給 Windows（Electron）與 Android（Capacitor）打包共用。
不包含原始素材（photo/）、工具、CSV、原型 html 與參考音檔以外的開發檔。

用法：python tools/stage_web.py [--with-test-audio]
  --with-test-audio  一併放入 audio-protocol/*.wav（?audiotest 模擬收音用，正式版不需要）
"""
import shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build" / "web"
DIRS = ["css", "js", "data", "assets"]
FILES = ["index.html", "audio-protocol/protocol.json"]


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for d in DIRS:
        shutil.copytree(ROOT / d, OUT / d, ignore=shutil.ignore_patterns("*.svg~", ".*", "pencil-cartoon"))   # 插畫原檔與預覽，執行時不需要
    for f in FILES:
        (OUT / f).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / f, OUT / f)
    if "--with-test-audio" in sys.argv:
        for w in (ROOT / "audio-protocol").glob("*.wav"):
            shutil.copy2(w, OUT / "audio-protocol" / w.name)
    shutil.copy2(ROOT / "photo" / "bird-view-icon.png", OUT / "icon.png")
    size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    print(f"build/web: {sum(1 for p in OUT.rglob('*') if p.is_file())} files, {size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
