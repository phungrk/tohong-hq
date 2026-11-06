#!/usr/bin/env python3
"""Bất biến hq/ledger · nguồn: T-087 (Spec Gate v3 2026-11-07, spec-critic; spec products/T-087-board-nhay-hong.md Bước 2).
Mọi board/T-*.md thật trong sổ cái:
  (a) đọc được bằng read_task của scripts/task.py, không ném lỗi loại nào;
  (b) không hỏng nặng: id đọc ra đúng bằng tên file (bỏ .md), state thuộc STATES, tier rỗng hoặc thuộc A/B/C.
Vùng (area) lạ không tính là hỏng (hq/dashboard INV-005). Phần chạy trên sổ cái tạm với board hỏng nhẹ/nặng
nằm ở eval/T-087/bat-bien-cho-merge/ (ADR-028) tới khi T-087 merge.
Chỉ đọc sổ cái thật, không ghi gì.
Chạy: python3 eval/invariants/hq/ledger/inv-006-board-that-khong-hong-nang.py"""
import os, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
os.environ.setdefault("TOHONG_ROOT", str(ROOT))
import task  # noqa: E402
bad = []
for p in sorted(task.BOARD.glob("T-*.md")):
    try:
        m, _ = task.read_task(p.stem)
    except Exception as e:  # noqa: BLE001
        bad.append(f"{p.name}: read_task ném {type(e).__name__}: {str(e)[:80]}"); continue
    if m.get("id") != p.stem: bad.append(f"{p.name}: id={m.get('id')!r} khác tên file")
    if m.get("state") not in task.STATES: bad.append(f"{p.name}: state={m.get('state')!r} ngoài STATES")
    if m.get("tier") not in ("", "A", "B", "C"): bad.append(f"{p.name}: tier={m.get('tier')!r} ngoài A/B/C")
if bad:
    for b in bad: print("FAIL " + b)
    sys.exit(1)
print("PASS")
