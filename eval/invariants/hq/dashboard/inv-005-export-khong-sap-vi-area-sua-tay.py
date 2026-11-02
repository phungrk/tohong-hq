#!/usr/bin/env python3
"""Nguồn: T-042 eval đối kháng eval/T-042/adv-02-export-area-danh-sach.py (adversary, 2026-11-02); spec products/T-041-loc-san-pham.md H8; mở rộng câu "vùng lạ do sửa tay file board không làm exporter sập" của inv-004.
Bất biến: scripts/export_dashboard.py không sập vì giá trị `area` sửa tay trong file board, kể cả giá trị bộ đọc frontmatter biến thành list (`area: ["hq/dashboard"]`, `area: []`);
mọi việc vẫn có product thuộc {planner, hq, ""}, các việc vùng hợp lệ vẫn đúng sản phẩm.
Áp dụng từ khi exporter xuất trường `product` (T-042); exporter chưa xuất `product` thì PASS "chưa áp dụng".
Chạy trong repo tohong-hq: python3 eval/invariants/hq/dashboard/inv-005-export-khong-sap-vi-area-sua-tay.py
"""

import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
VALID = {"planner", "hq", ""}
CASES = {  # id -> (dòng area thô trong frontmatter, product kỳ vọng hoặc None = chỉ cần thuộc VALID)
    "T-951": ('area: ["hq/dashboard"]', None),
    "T-952": ('area: ["planner/front", "hq"]', None),
    "T-953": ('area: []', ""),
    "T-954": ('area: "dashboard/model"', "hq"),
    "T-955": ('area: "front/layout"', "planner"),
    "T-956": ('area: "hqx/dashboard"', ""),
}
bad = []
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    fake = tmp / "ledger"
    (fake / "board").mkdir(parents=True); (fake / "org").mkdir()
    shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    src = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
    for tid, (line, _) in CASES.items():
        body = re.sub(r"(?m)^id:.*$", f"id: {tid}", src, count=1)
        body = re.sub(r"(?m)^area:.*$", lambda m: line, body, count=1)
        (fake / "board" / f"{tid}.md").write_text(body, encoding="utf-8")
    out = tmp / "out"
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)],
                       capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(fake)))
    if r.returncode != 0:
        last = (r.stderr.strip().splitlines() or ["?"])[-1][:200]
        bad.append(f"export_dashboard.py sập (thoát {r.returncode}) khi board có area kiểu danh sách (sửa tay): {last}")
    else:
        for name in ("dashboard.json", "tasks.json"):
            data = json.loads((out / name).read_text(encoding="utf-8"))
            tasks = data["tasks"] if isinstance(data, dict) else data
            by = {t["id"]: t for t in tasks}
            if not any("product" in t for t in tasks):
                print("PASS chưa áp dụng: exporter chưa xuất trường product"); sys.exit(0)
            for tid, (line, want) in CASES.items():
                t = by.get(tid)
                if t is None:
                    bad.append(f"{name}: thiếu việc {tid} ({line})"); continue
                got = t.get("product", "<thiếu>")
                if got not in VALID:
                    bad.append(f"{name}: {tid} ({line}) product={got!r} ngoài {{planner, hq, \"\"}}")
                elif want is not None and got != want:
                    bad.append(f"{name}: {tid} ({line}) phải có product={want!r}, thấy {got!r}")

if bad:
    for b in bad: print("FAIL " + b)
    sys.exit(1)
print("PASS")
