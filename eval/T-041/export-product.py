#!/usr/bin/env python3
"""Eval tầng 1 của T-041, tiêu chí 6: export_dashboard.py xuất trường `product` cho mỗi việc.
  cd /home/claude/tohong-hq && python3 eval/T-041/export-product.py
In `PASS` hoặc `FAIL <lý do>`, mã thoát 0/1. Dùng script export_dashboard.py THẬT, hai lần:
  (1) trên sổ cái thật của repo này: mỗi việc có `product` thuộc {planner, hq, ""} và bằng sản phẩm của task.normalize_area(area)
      (vùng cũ front/*, back/* -> planner; dashboard/* -> hq; vùng rỗng -> ""); cả dashboard.json lẫn tasks.json;
  (2) trên một bản sao sổ cái (biến TOHONG_ROOT) có đủ các vùng mà sổ cái thật hiện không có hoặc không còn: back/*, hqx/*, planner-x/*,
      kỳ vọng ghi cứng ở đây (không lấy từ normalize_area) và exporter không được sập vì vùng lạ.
"""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
VALID = {"planner", "hq", ""}
bad = []


def export(root, out):
    env = dict(os.environ, TOHONG_ROOT=str(root))
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)], capture_output=True, text=True, env=env)
    if r.returncode != 0:
        bad.append(f"export_dashboard.py thoát {r.returncode}: {(r.stderr.strip().splitlines() or ['?'])[-1][:200]}")
        return None
    return json.loads((out / "dashboard.json").read_text(encoding="utf-8"))["tasks"], json.loads((out / "tasks.json").read_text(encoding="utf-8"))


def check_oracle(tasks, tag):
    import task as T
    for t in tasks:
        if "product" not in t:
            bad.append(f"{tag}: việc {t['id']} thiếu trường product"); continue
        if t["product"] not in VALID:
            bad.append(f"{tag}: việc {t['id']} product={t['product']!r} ngoài {{planner, hq, \"\"}} (area={t.get('area')!r})"); continue
        try:
            want = T.normalize_area(t.get("area", "")).split("/")[0]
        except T.LedgerError:
            want = ""
        if want not in VALID:
            want = ""
        if t["product"] != want:
            bad.append(f"{tag}: việc {t['id']} area={t.get('area')!r} phải có product={want!r}, thấy {t['product']!r}")


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    res = export(ROOT, tmp / "real")
    if res:
        tasks, tasks_json = res
        check_oracle(tasks, "sổ cái thật (dashboard.json)")
        if [t.get("product") for t in tasks_json] != [t.get("product") for t in tasks]:
            bad.append("tasks.json và dashboard.json phải có cùng trường product cho từng việc")
        if not tasks:
            bad.append("sổ cái thật không có việc nào để kiểm")

    # (2) bản sao sổ cái với đủ loại vùng
    fake = tmp / "ledger"
    (fake / "board").mkdir(parents=True); (fake / "org").mkdir()
    shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    src = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
    CASES = {  # id -> (area, product kỳ vọng) ghi cứng theo quyết định 2026-11-02 và ADR-011
        "T-901": ("dashboard/model", "hq"), "T-902": ("front/layout", "planner"), "T-903": ("back/api", "planner"),
        "T-904": ("hq/dashboard/model", "hq"), "T-905": ("planner/front/vendor-list", "planner"), "T-906": ("", ""),
        "T-907": ("hqx/dashboard", ""), "T-908": ("planner-x/front", ""), "T-909": ("dashboard", "hq"), "T-910": ("front", "planner"),
    }
    for tid, (area, _) in CASES.items():
        body = re.sub(r"(?m)^id:.*$", f"id: {tid}", src, count=1)
        body = re.sub(r"(?m)^area:.*$", f'area: "{area}"', body, count=1)
        (fake / "board" / f"{tid}.md").write_text(body, encoding="utf-8")
    res2 = export(fake, tmp / "fake")
    if res2:
        by = {t["id"]: t for t in res2[0]}
        for tid, (area, want) in CASES.items():
            got = by.get(tid, {}).get("product", "<thiếu>")
            if got != want:
                bad.append(f"bản sao sổ cái: {tid} area={area!r} phải có product={want!r}, thấy {got!r}")

if bad:
    for b in bad[:12]: print("FAIL " + b)
    if len(bad) > 12: print(f"FAIL ... và {len(bad) - 12} lỗi cùng loại")
    sys.exit(1)
print("PASS")
