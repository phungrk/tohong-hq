#!/usr/bin/env python3
"""T-082 adv-01 (tầng 3, spec A2 + D3 'script tự kiểm lại A2, không tin bộ lọc job').
Input phá: login/sender trông như phungrk nhưng KHÔNG phải chuỗi phungrk: ký tự KELVIN SIGN U+212A ('K' nhiệt độ,
str.lower() ra 'k' ASCII), chữ Kirin, fullwidth, khoảng trắng/zero-width thừa, login không phải chuỗi, user null.
Mong đợi: verdict 'ignored', reply rỗng, sổ cái và board không đổi byte nào (A2: khớp TOÀN CHUỖI, chỉ bỏ qua hoa/thường ASCII)."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-079"))
from _lib import Box, payload
fails = []
LOOK = ["phungrK", "PHUNGRK", "phungrk​", " phungrk", "phungrk ", "phungrk\n",
        "рhungrk", "ｐｈｕｎｇｒｋ", "phungrk\u0000"]
B = Box()
try:
    B.new(issue=7); snap = B.snapshot()
    for lg in LOOK:
        for who in ("login", "sender"):
            kw = {"login": lg} if who == "login" else {"sender": lg}
            r = B.ok(payload("/ok chọn A", cid=5000 + len(fails), **kw))
            if r["verdict"] != "ignored" or r["reply"] or B.snapshot() != snap:
                fails.append(f"{who}={lg!r}: verdict={r['verdict']}, sổ cái {'ĐỔI' if B.snapshot() != snap else 'không đổi'}")
                B.close(); B = Box(); B.new(issue=7); snap = B.snapshot()
    # kiểu lạ cho login / user
    for bad in (["phungrk"], {"login": "phungrk"}, 0, None):
        p = payload("/ok chọn A"); p["comment"]["user"]["login"] = bad
        r = B.ok(p)
        if r["verdict"] != "ignored" or B.snapshot() != snap:
            fails.append(f"login kiểu {type(bad).__name__}: verdict={r['verdict']}")
finally:
    B.close()
assert not fails, "\n".join(fails[:12])
print("PASS login/sender giả dạng phungrk (unicode, khoảng trắng, kiểu lạ) đều bị bỏ qua, sổ cái không đổi")
