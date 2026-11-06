#!/usr/bin/env python3
"""T-074 tiêu chí 3: luật so với baseline (không tụt quá N điểm) và ngưỡng phủ nhãn ghi rõ trong spec kèm lý do, đánh đổi, điều kiện sai; lệnh eval dùng đúng con số đó."""
import os, re, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
def fail(m): print("FAIL " + m); sys.exit(1)
p = os.path.join(ROOT, "products/T-074-bo-eval-top5.md")
if not os.path.exists(p): fail("chưa có products/T-074-bo-eval-top5.md")
s = open(p, encoding="utf-8").read()
a = re.search(r"^NGUONG_TUT_TOI_DA:\s*(\d+)\s*$", s, re.M); b = re.search(r"^NGUONG_PHU_NHAN:\s*(\d+)\s*$", s, re.M)
if not (a and b): fail("spec thiếu dòng NGUONG_TUT_TOI_DA: <số> hoặc NGUONG_PHU_NHAN: <số>")
sec = re.search(r"### Luật so với baseline(.*?)(?=\n## |\n### |\Z)", s, re.S)
if not sec: fail("spec thiếu mục '### Luật so với baseline'")
for need in ("Vì sao", "Đánh đổi", "Điều kiện khiến sai"):
    if need not in sec.group(1): fail(f"mục Luật so với baseline thiếu '{need}'")
r = subprocess.run(["node", "eval/T-074/match_eval.mjs", "--print-threshold"], cwd=ROOT, capture_output=True, text=True)
if r.stdout.split() != [a.group(1), b.group(1)]: fail(f"lệnh eval dùng ngưỡng '{r.stdout.strip()}' khác spec '{a.group(1)} {b.group(1)}'")
if a.group(1) != "10": fail("Capu chốt không tụt quá 10 điểm; spec ghi " + a.group(1))
if "baseline" not in sec.group(1) or "lần đầu" not in sec.group(1): fail("mục phải nói rõ lần đầu chỉ đo baseline, không đạt/rớt")
print(f"PASS luật không tụt quá {a.group(1)} điểm so với baseline (phủ nhãn >= {b.group(1)}%) có lý do trong spec và khớp lệnh eval")
