#!/usr/bin/env python3
"""T-074 tiêu chí 3: ngưỡng ghi rõ trong spec kèm lý do và đánh đổi; lệnh eval dùng đúng con số đó."""
import os, re, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
def fail(m): print("FAIL " + m); sys.exit(1)
p = os.path.join(ROOT, "products/T-074-bo-eval-top5.md")
if not os.path.exists(p): fail("chưa có products/T-074-bo-eval-top5.md")
s = open(p, encoding="utf-8").read()
a = re.search(r"^NGUONG_TI_LE_TOP5:\s*(\d+)\s*$", s, re.M); b = re.search(r"^NGUONG_LIFT:\s*(\d+)\s*$", s, re.M)
if not (a and b): fail("spec thiếu dòng NGUONG_TI_LE_TOP5: <số> hoặc NGUONG_LIFT: <số>")
sec = re.search(r"### Ngưỡng(.*?)(?=\n## |\n### |\Z)", s, re.S)
if not sec: fail("spec thiếu mục '### Ngưỡng'")
for need in ("Vì sao", "Đánh đổi", "Điều kiện khiến sai"):
    if need not in sec.group(1): fail(f"mục Ngưỡng thiếu '{need}'")
r = subprocess.run(["node", "eval/T-074/match_eval.mjs", "--print-threshold"], cwd=ROOT, capture_output=True, text=True)
if r.stdout.split() != [a.group(1), b.group(1)]: fail(f"lệnh eval dùng ngưỡng '{r.stdout.strip()}' khác spec '{a.group(1)} {b.group(1)}'")
print(f"PASS ngưỡng {a.group(1)}% (hơn đối chứng {b.group(1)} điểm) có lý do trong spec và khớp lệnh eval")
