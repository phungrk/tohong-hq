#!/usr/bin/env python3
"""Đối kháng T-097 (spec T-094 mục C, "File ở vùng con giữ như T-092"): thư mục `_root` LỒNG (`_root/sub/`, `hq/_root/`, `_root/_root/`)
cùng file ở gốc và `_root/` cấp một. Khác adv-02 (chỉ `_root/` cấp một).
Mong đợi cả hai chế độ: url = BASE + đường dẫn tương đối thật (không mất/thêm đoạn `_root/`), area = thư mục cha tương đối (gốc = `_root`),
bản thường path = eval/invariants/<tương đối>; bản --public không có khoá path, không chứa thư mục tạm/đường dẫn máy ở đâu trong dashboard.json.
Chạy: python3 eval/T-097/adv-06-root-long-nhau.py   Mã thoát 0 = đạt."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _adv_lib import run, PATHS  # noqa: E402

D = "# Bất biến: tên mô tả bình thường của một bất biến nằm trong thư mục lồng\n"
AREA = {"inv-1-goc.sh": "_root", "_root/inv-2.sh": "_root", "_root/sub/inv-3.sh": "_root/sub",
        "hq/_root/inv-4.sh": "hq/_root", "_root/_root/inv-5.sh": "_root/_root", "_root/inv-6-root.sh": "_root"}
BASE = "https://github.com/phungrk/tohong-hq/blob/main/eval/invariants/"
bad = []
for k, (m, raw) in run({r: D for r in AREA}).items():
    lst = m.get("invariant_list") or []
    seen = {}
    for x in lst:
        u = x.get("url", "")
        rel = u[len(BASE):] if u.startswith(BASE) else u
        seen[rel] = x
    for rel, a in AREA.items():
        x = seen.get(rel)
        if not x: bad.append(f"[{k}] thiếu url cho {rel}; có {sorted(seen)}"); continue
        if x.get("area") != a: bad.append(f"[{k}] {rel}: area {x.get('area')!r} != {a!r}")
        if k == "thường" and x.get("path") != "eval/invariants/" + rel: bad.append(f"[{k}] {rel}: path {x.get('path')!r}")
        if k == "public" and "path" in x: bad.append(f"[public] {rel}: có khoá path")
    if len(lst) != len(AREA): bad.append(f"[{k}] đếm {len(lst)} != {len(AREA)}")
    if k == "public" and (any(p in raw for p in PATHS) or "/./" in raw): bad.append("[public] dashboard.json chứa đường dẫn máy hoặc /./")
if bad:
    for b in bad[:10]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
