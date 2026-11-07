#!/usr/bin/env python3
"""Đối kháng T-097 (spec T-094 mục B bước 4, mục C): bước 4 hứa "slug và tên file chỉ có chữ, số, -, _, ." nên tên rơi về slug/tên file
không bao giờ thỏa mục A; mục C hứa mọi area khớp regex. Exporter không tự kiểm hai tiền đề đó; eval này kiểm chúng trên BỂ THẬT.
Mong đợi: mọi file inv-* trong eval/invariants có tên khớp ^inv-\\d+(-[a-z0-9-]+)?\\.[a-z]+$ và mọi thư mục khớp [a-z0-9_-]+;
và name rơi về slug/tên file không chứa đường dẫn máy (mục A.1) hay ký tự mở đầu code (A.2). (Không xét từ khoá A.5 trên slug:
slug thật như `export-khong-sap-...`, `eval-khong-kill-...` bắt đầu bằng từ khoá nhưng là chữ kebab, không lộ gì.)
Chạy: python3 eval/T-097/adv-07-ten-file-va-thu-muc-be.py   Mã thoát 0 = đạt."""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _adv_lib import ROOT  # noqa: E402
sys.path.insert(0, str(ROOT / "eval" / "T-094"))
import namerule2 as nr  # noqa: E402

inv = ROOT / "eval" / "invariants"
bad = []
for p in sorted(inv.rglob("*")):
    rel = p.relative_to(inv).as_posix()
    if p.is_dir():
        if p.name != "__pycache__" and not re.fullmatch(r"[a-z0-9_-]+", p.name): bad.append(f"thư mục lạ: {rel}")
    elif p.name.startswith("inv-") and "__pycache__" not in p.parts:
        if not re.fullmatch(r"inv-\d+(-[a-z0-9-]+)?\.[a-z]+", p.name): bad.append(f"tên file lạ: {rel}")
        slug = re.sub(r"^inv-(?:\d+-?)?", "", p.name).rsplit(".", 1)[0]
        for cand in (slug.replace("-", " "), p.name):
            if cand and (any(x in cand for x in nr._PATH) or cand.startswith(nr._SYMS) or any(x in cand for x in nr._INFIX)):
                bad.append(f"slug/tên file trông như code: {rel} -> {cand!r}")
if bad:
    for b in bad[:10]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
