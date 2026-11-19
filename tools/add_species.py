"""補齊 data/birds.json：找出關卡 JSON 用到、但 birds.json 還沒有的鳥種，從各章 CSV 帶入資料。

鍵與 CSV 列的對應：英文名轉成鍵（小寫、去掉撇號與括號、非英數字改成 -，例如 Styan's Bulbul → styans-bulbul），
或用學名比對。同一種鳥出現在多章 CSV 時取最早的一章。既有條目一律不覆寫。
CSV 沒有的鳥寫在 MANUAL。

用法：python tools/add_species.py          （寫回 birds.json 並列出新增的鳥種）
      python tools/add_species.py --dry    （只列出，不寫入）
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.stdout.reconfigure(encoding="utf-8")   # 輸出被導向檔案或管線時（cp950）也能印中文
CHAPTERS = ["first", "second", "third", "forth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]

# CSV 沒有、但關卡有收錄的鳥
MANUAL = {
    "spotted-nutcracker": {
        "zh": "星鴉", "en": "Spotted Nutcracker", "sci": "Nucifraga caryocatactes", "length": "32–35 cm",
        "size": "中型", "habitat": "高山針葉林、林緣", "suggestZoom": "2–3X",
        "note": "深巧克力褐色的身體布滿白色斑點，尾下覆羽白色；秋天在松林間採食並儲藏松子，台灣為特有亞種。",
    },
}


def slug(en):
    en = re.sub(r"\(.*?\)", "", en).replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", en.lower()).strip("-")


def col(row, *names, suffix=None):
    for n in names:
        if row.get(n):
            return row[n].strip()
    if suffix:
        for k, v in row.items():
            if k and k.endswith(suffix) and v:
                return v.strip()
    return ""


def entry(row):
    looks = col(row, "主要顏色")
    sex = col(row, "雄雌差異")
    young = col(row, "幼鳥差異")
    note = "；".join(x for x in [sex, young] if x)
    return {
        "zh": col(row, "鳥類名稱"), "en": col(row, "英文名"), "sci": col(row, "學名"),
        "length": col(row, "體長"), "size": col(row, "體型", "大小分類"),
        "habitat": col(row, suffix="建議棲地") or col(row, "建議場景"),
        "suggestZoom": col(row, "建議倍率", "建議遊戲倍率").replace("／", " / "),
        "note": "。".join(x for x in [looks, note] if x) + "。",
    }


def csv_rows():
    for ch in CHAPTERS:
        for f in sorted(ROOT.glob(f"{ch}-story-*.csv")):
            with open(f, encoding="utf-8-sig", newline="") as fh:
                for row in csv.DictReader(fh):
                    if row.get("英文名"):
                        yield f.name, row


def main(dry):
    db_path = ROOT / "data" / "birds.json"
    db = json.loads(db_path.read_text(encoding="utf-8"))
    used = []
    for p in sorted((ROOT / "data" / "levels").glob("level*.json")):
        for b in json.loads(p.read_text(encoding="utf-8")).get("birds", []):
            if b["species"] not in db and b["species"] not in used:
                used.append(b["species"])
    if not used:
        print("birds.json 已涵蓋所有關卡用到的鳥種")
        return
    found = {}
    for name, row in csv_rows():
        k = slug(row["英文名"])
        if k in used and k not in found:
            found[k] = (name, row)
    missing = []
    for k in used:
        if k in MANUAL:
            e, src = dict(MANUAL[k]), "MANUAL"
        elif k in found:
            e, src = entry(found[k][1]), found[k][0]
        else:
            missing.append(k)
            continue
        e.update({"source": "ai-generated", "photographer": "", "signature": "", "license": "", "gps": "", "exif": ""})
        db[k] = e
        print(f"  + {k:30s} {e['zh']:8s} {e['sci']:32s} <- {src}")
    if missing:
        sys.exit(f"找不到資料：{', '.join(missing)}（CSV 英文名轉成的鍵不同，或需加到 MANUAL）")
    if not dry:
        db_path.write_text(json.dumps(db, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"birds.json：{len(db)} 種")


if __name__ == "__main__":
    main("--dry" in sys.argv)
