#!/usr/bin/env python3
"""Nguồn: T-092 (spec products/T-092-knowledge-reservoir-drawer.md, mục "Bất biến đề xuất" 1; lỗi gốc: commit 641f502 bỏ khối `model` khỏi exporter nên khối Knowledge Reservoir hiện 0 bất biến).
Bất biến (hq/dashboard): số bất biến mà dashboard.json báo bằng số file `inv-*` thật trong bể.
  Chạy scripts/export_dashboard.py THẬT (có và không --public) trên sổ cái hiện tại; model.invariants_total = số file thường tên `inv-*` dưới eval/invariants/ (đếm độc lập bằng os.walk)
  = tổng model.invariants = len(model.invariant_list) > 0; từng vùng khớp. Bản public: model không chứa /home/ hay /root/ và không có khoá path.
Mã thoát 0 = đạt. In PASS hoặc FAIL <lý do>."""
import json, os, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(os.environ.get("TOHONG_ROOT") or Path(__file__).resolve().parent)
while not (ROOT / "scripts" / "export_dashboard.py").exists() and ROOT != ROOT.parent:
    ROOT = ROOT.parent
inv_root = ROOT / "eval" / "invariants"
by = {}
for dp, _, fn in os.walk(inv_root):
    for n in fn:
        if n.startswith("inv-") and (Path(dp) / n).is_file():
            a = str(Path(dp).relative_to(inv_root)).replace(os.sep, "/")
            by[a] = by.get(a, 0) + 1
total = sum(by.values())
bad = []
with tempfile.TemporaryDirectory() as t:
    for pub in (False, True):
        out = Path(t) / str(pub)
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)] + (["--public"] if pub else []),
                           capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(ROOT)))
        k = "public" if pub else "thường"
        if r.returncode != 0:
            bad.append(f"[{k}] exporter thoát {r.returncode}"); continue
        m = json.loads((out / "dashboard.json").read_text(encoding="utf-8")).get("model")
        if not isinstance(m, dict):
            bad.append(f"[{k}] dashboard.json thiếu khoá model (khối Knowledge Reservoir sẽ hiện 0)"); continue
        if total == 0: bad.append("bể không có file inv-* nào")
        if m.get("invariants_total") != total: bad.append(f"[{k}] invariants_total {m.get('invariants_total')} != số file inv-* thật {total}")
        if m.get("invariants") != by: bad.append(f"[{k}] invariants theo vùng không khớp file thật")
        if len(m.get("invariant_list") or []) != total: bad.append(f"[{k}] len(invariant_list) != {total}")
        js = json.dumps(m, ensure_ascii=False)
        if "/home/" in js or "/root/" in js: bad.append(f"[{k}] model chứa đường dẫn máy")
        if pub and '"path"' in js: bad.append("bản public có khoá path")
if bad:
    for b in bad[:8]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
