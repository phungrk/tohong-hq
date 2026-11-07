#!/usr/bin/env python3
"""Đối kháng T-097 (spec T-094 mục C): file ở gốc bể không slug, rỗng, và cùng lúc có thư mục con tên `_root` thật.
Mong đợi (cả hai chế độ): mọi area khớp regex mục C; url/path trỏ đúng file thật (không /./, không //); file gốc có url .../eval/invariants/<tên>;
name không rỗng; đếm theo vùng = số file; bản --public không có khoá path và không chứa đường dẫn máy ở bất kỳ đâu trong dashboard.json.
Chạy: python3 eval/T-097/adv-02-goc-va-thu-muc-root.py   Mã thoát 0 = đạt."""
import json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _adv_lib import run, PATHS  # noqa: E402

FILES = {
    "inv-1.sh": "# Bất biến: cd /root/work && python3 run.py\n",
    "inv-.sh": "",
    "inv-2-o-goc.py": '"""Bất biến: file ở gốc vẫn có tên mô tả bình thường."""\n',
    "_root/inv-3-thu-muc-trung-ten.sh": "# Bất biến: thư mục con tên _root không được lẫn đường dẫn với file ở gốc\n",
    "hq/x/inv-4.sh": "# INV-4 · x = f(y)\n",
}
AREA = re.compile(r"_shared|_root|[a-z0-9_-]+(?:/[a-z0-9_-]+)*")
BASE = "https://github.com/phungrk/tohong-hq/blob/main/eval/invariants/"
bad = []
for k, (m, raw) in run(FILES).items():
    lst = m.get("invariant_list") or []
    if len(lst) != len(FILES): bad.append(f"[{k}] đếm {len(lst)} != {len(FILES)}")
    if m.get("invariants_total") != len(FILES): bad.append(f"[{k}] invariants_total {m.get('invariants_total')}")
    if sum((m.get("invariants") or {}).values()) != len(FILES): bad.append(f"[{k}] tổng theo vùng sai {m.get('invariants')}")
    urls = set()
    for x in lst:
        u, a, n = x.get("url", ""), x.get("area", ""), (x.get("name") or "").strip()
        rel = u[len(BASE):] if u.startswith(BASE) else None
        if rel not in FILES: bad.append(f"[{k}] url không trỏ file thật: {u!r}")
        urls.add(u)
        if "/./" in u or "//" in u[len("https://"):]: bad.append(f"[{k}] url bẩn {u!r}")
        if not AREA.fullmatch(a): bad.append(f"[{k}] area {a!r}")
        if not n: bad.append(f"[{k}] name rỗng ở {u!r}")
        if any(p in n for p in PATHS): bad.append(f"[{k}] name lộ đường dẫn {n!r}")
        if k == "thường" and rel and x.get("path") != "eval/invariants/" + rel: bad.append(f"[{k}] path {x.get('path')!r} != eval/invariants/{rel}")
    if len(urls) != len(lst): bad.append(f"[{k}] url trùng nhau")
    if k == "public":
        if '"path"' in json.dumps(m): bad.append("[public] model có khoá path")
        if any(p in raw for p in ("/home/", "/tmp/", "/Users/")): bad.append("[public] dashboard.json chứa đường dẫn máy")
if bad:
    for b in bad[:8]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
