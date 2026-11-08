#!/usr/bin/env python3
"""Bất biến hq/dashboard/model · nguồn: T-097 (eval đối kháng eval/T-097/adv-07-ten-file-va-thu-muc-be.py, adversary rút vào bể sau ADR-039; spec T-094 mục B bước 4, mục C).
Tên file và tên thư mục trong bể luôn sạch, giữ tiền đề mà bước 4 (tên rơi về slug/tên file) và mục C (area khớp regex) của T-094 dựa vào
Exporter không tự kiểm hai tiền đề này; bất biến kiểm chúng trên BỂ THẬT (eval/invariants của sổ cái hiện tại):
mọi thư mục (trừ __pycache__) khớp [a-z0-9_-]+; mọi file inv-* khớp ^inv-\\d+(-[a-z0-9-]+)?\\.[a-z]+$; slug (gạch thành dấu cách) và tên file
không chứa đường dẫn máy (A.1), không mở đầu bằng ký tự code (A.2), không chứa toán tử shell/JS (A.3). Không xét từ khoá A.5 trên slug:
slug thật như `export-khong-sap-...` bắt đầu bằng từ khoá nhưng là chữ kebab, không lộ gì.
Ba bộ ký tự dưới đây chép từ cài đặt tham chiếu eval/T-094/namerule2.py (_PATH, _SYMS, _INFIX) để file tự đủ.
Chạy: python3 -I eval/invariants/hq/dashboard/model/inv-042-ten-file-va-thu-muc-be-sach.py   Mã thoát 0 = đạt. In PASS hoặc FAIL <lý do>."""
import os, re, sys
from pathlib import Path

ROOT = Path(os.environ.get("TOHONG_ROOT") or Path(__file__).resolve().parent)
while not (ROOT / "scripts" / "export_dashboard.py").exists() and ROOT != ROOT.parent:
    ROOT = ROOT.parent

_PATH = ("/home/", "/root/", "/tmp/", "handoffs/", "C:\\", "/Users/", "/var/", "/opt/")
_SYMS = ("$", "{", "}", "|", "&", "!", "<", ">", "@", ";", "\\", "^", "~", "/", "%", "*", "+")
_INFIX = ("$(", "${", " && ", " || ", " == ", " != ", " => ", " === ", " !== ", "=>", "->", ">&", "2>")

inv = ROOT / "eval" / "invariants"
bad = []
if not inv.is_dir():
    bad.append(f"không thấy bể {inv}")
else:
    for p in sorted(inv.rglob("*")):
        rel = p.relative_to(inv).as_posix()
        if "__pycache__" in p.parts:
            continue
        if p.is_dir():
            if not re.fullmatch(r"[a-z0-9_-]+", p.name): bad.append(f"thư mục lạ: {rel}")
        elif p.name.startswith("inv-"):
            if not re.fullmatch(r"inv-\d+(-[a-z0-9-]+)?\.[a-z]+", p.name): bad.append(f"tên file lạ: {rel}")
            slug = re.sub(r"^inv-(?:\d+-?)?", "", p.name).rsplit(".", 1)[0]
            for cand in (slug.replace("-", " "), p.name):
                if cand and (any(x in cand for x in _PATH) or cand.startswith(_SYMS) or any(x in cand for x in _INFIX)):
                    bad.append(f"slug/tên file trông như code: {rel} -> {cand!r}")
if bad:
    for b in bad[:10]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
