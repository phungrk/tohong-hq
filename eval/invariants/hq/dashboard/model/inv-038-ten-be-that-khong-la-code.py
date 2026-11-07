#!/usr/bin/env python3
"""Bất biến hq/dashboard/model · nguồn: T-094 (spec products/T-094-ten-bat-bien-khong-lo-code.md, qua Spec Gate v2 2026-11-07, spec-critic).
Tên bất biến của bể thật trong dashboard.json không bao giờ là dòng code hay đường dẫn máy, ở cả bản thường và bản công khai
Chạy scripts/export_dashboard.py THẬT (có và không --public) trên sổ cái hiện tại. Với mọi phần tử model.invariant_list: name không rỗng,
không chứa /home/ /root/ /tmp/ /Users/ /var/ /opt/ handoffs/ C:\\, và không là dòng code theo mục A spec T-094
(cài đặt tham chiếu eval/T-094/namerule2.py: looks_like_code; trừ khi name là slug hay tên file, bước 3-4); mọi area khớp ^(_shared|_root|[a-z0-9_-]+(/[a-z0-9_-]+)*)$
(không ".", không rỗng, không ".."); url không chứa "/./" hay "/../". Bể hôm nay sạch nhờ ADR-032; bất biến này giữ nó sạch.
Chạy: python3 eval/invariants/hq/dashboard/model/inv-038-ten-be-that-khong-la-code.py   Mã thoát 0 = đạt. In PASS hoặc FAIL <lý do>."""
import json, os, re, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(os.environ.get("TOHONG_ROOT") or Path(__file__).resolve().parent)
while not (ROOT / "scripts" / "export_dashboard.py").exists() and ROOT != ROOT.parent:
    ROOT = ROOT.parent
sys.path.insert(0, str(ROOT / "eval" / "T-094"))
import namerule2 as nr  # noqa: E402

PATHS = ("/home/", "/root/", "/tmp/", "/Users/", "/var/", "/opt/", "handoffs/", "C:\\")
AREA = re.compile(r"_shared|_root|[a-z0-9_-]+(?:/[a-z0-9_-]+)*")
bad = []
with tempfile.TemporaryDirectory() as t:
    for pub in (False, True):
        k = "public" if pub else "thường"
        out = Path(t) / k
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)] + (["--public"] if pub else []),
                           capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(ROOT)))
        if r.returncode:
            bad.append(f"[{k}] exporter thoát {r.returncode}"); continue
        m = json.loads((out / "dashboard.json").read_text(encoding="utf-8")).get("model") or {}
        lst = m.get("invariant_list") or []
        if not lst: bad.append(f"[{k}] invariant_list rỗng")
        for x in lst:
            n, a, u = (x.get("name") or "").strip(), x.get("area") or "", x.get("url") or ""
            tag = u.rsplit("/", 1)[-1] or "?"
            if not n: bad.append(f"[{k}] {tag}: name rỗng")
            if any(p in n for p in PATHS): bad.append(f"[{k}] {tag}: name chứa đường dẫn máy/handoffs/")
            fb = n in ((x.get("slug") or "").replace("-", " "), tag)   # bước 3-4 (slug, tên file) không phải dòng code dù trùng từ khoá, vd slug "export-…"
            if not fb and nr.looks_like_code(n): bad.append(f"[{k}] {tag}: name là dòng code {n[:80]!r}")
            if not AREA.fullmatch(a): bad.append(f"[{k}] {tag}: area không hợp lệ {a!r}")
            if "/./" in u or "/../" in u: bad.append(f"[{k}] {tag}: url có /./ hoặc /../")
if bad:
    for b in bad[:8]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
