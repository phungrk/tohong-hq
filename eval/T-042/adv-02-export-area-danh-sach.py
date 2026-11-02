#!/usr/bin/env python3
"""Eval đối kháng T-042 (adversary, 2026-11-02). Spec products/T-041-loc-san-pham.md H8: "Nếu normalize_area ném LedgerError (vùng ... do sửa tay file board)
thì product là "" và việc xuất vẫn chạy. product luôn thuộc {planner, hq, ""}."

Input phá: file board sửa tay có `area: ["hq/dashboard"]`. Bộ đọc frontmatter của task.py (read_task) đổi giá trị bắt đầu bằng "[" thành list JSON,
nên export_dashboard.product_of gọi task.normalize_area(list) -> AttributeError ('list' object has no attribute 'strip'), không phải LedgerError,
và export_dashboard.py SẬP: dashboard ngừng cập nhật cho cả công ty. Exporter trước T-042 xuất được cùng sổ cái đó; `task.py summary` cũng chạy được.
Mong đợi: exporter thoát 0; mọi việc có product thuộc {planner, hq, ""}; các việc khác vẫn đúng sản phẩm. Không ép giá trị product của việc có area kiểu list.

Chạy: python3 eval/T-042/adv-02-export-area-danh-sach.py   (trong repo tohong-hq; dùng bản sao sổ cái qua TOHONG_ROOT, không chạm sổ cái thật)
"""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
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
