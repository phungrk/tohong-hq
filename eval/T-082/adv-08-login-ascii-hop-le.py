#!/usr/bin/env python3
"""T-082 adv-08 (tầng 3, spec A2: so toàn chuỗi, chỉ bỏ qua hoa/thường ASCII; soi bản vá adv-01 không chặn oan).
Input: login ASCII hợp lệ có chữ số, gạch ngang, hoa/thường lẫn lộn; OK_LOGIN tuỳ biến (GitHub cho [A-Za-z0-9-]).
Mong đợi: decided cho đúng tài khoản (mọi kiểu hoa/thường ASCII ở login và sender); vẫn ignored cho login gần giống
(thiếu/thừa ký tự, gạch dưới thay gạch ngang, chữ số khác)."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-079"))
from _lib import Box, payload
fails = []
CASES = [  # (OK_LOGIN hoặc None=mặc định, login, sender, mong đợi decided?)
    (None, "phungrk", "phungrk", True), (None, "PhungRK", "PHUNGRK", True), (None, "pHuNgRk", "phungrk", True),
    ("capu-2029", "capu-2029", "Capu-2029", True), ("capu-2029", "CAPU-2029", "capu-2029", True),
    ("a1-b2-c3", "A1-B2-C3", "a1-b2-c3", True),
    ("capu-2029", "capu_2029", "capu_2029", False), ("capu-2029", "capu-2028", "capu-2028", False),
    ("capu-2029", "capu-20290", "capu-20290", False), ("capu-2029", "capu2029", "capu2029", False),
    ("capu-2029", "capu-2029", "capu-2028", False), (None, "phungrk-", "phungrk-", False),
]
for i, (want, login, sender, legit) in enumerate(CASES):
    B = Box()
    try:
        B.new(issue=7); snap = B.snapshot()
        env = {"OK_LOGIN": want} if want else None
        r = B.ok(payload("/ok chọn A", login=login, sender=sender, cid=8000 + i), env=env)
        changed = B.snapshot() != snap
        if legit and (r["verdict"] != "decided" or not changed):
            fails.append(f"OK_LOGIN={want!r} login={login!r} sender={sender!r}: hợp lệ mà verdict={r['verdict']}/{r['reason']}")
        if not legit and (r["verdict"] != "ignored" or changed):
            fails.append(f"OK_LOGIN={want!r} login={login!r} sender={sender!r}: không phải Capu mà verdict={r['verdict']}")
    finally:
        B.close()
assert not fails, "\n".join(fails)
print("PASS login ASCII hợp lệ (chữ số, gạch ngang, hoa/thường) được nhận; login gần giống bị bỏ qua")
