#!/usr/bin/env python3
"""Tầng 3 T-063 · tác giả marker:
 a) MIRROR_AUTHOR rỗng + comment của User 'capu-login' (type User) có marker đúng dạng T-001-1 ở đầu → KHÔNG tính, ① vẫn lên
 b) MIRROR_AUTHOR=capu-login + cùng comment → tính, không đăng ① lần nữa
 c) MIRROR_AUTHOR=capu-login + comment marker của người khác 'mallory' (User) → không tính, ① vẫn lên
 d) MIRROR_AUTHOR=capu-login + comment của capu-login có marker nhưng KHÔNG ở đầu thân → không tính
GitHub giả, không mạng."""
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _advfail import Ledger, new, posted
def run(author, user, body):
    env = {"MIRROR_AUTHOR": author} if author is not None else {}
    L = Ledger(**env)
    try:
        new(L, 1, 7)
        L.comments({"7": [{"body": body, "user": {"login": user, "type": "User"}}]})
        rc, out, calls = L.mirror(); assert rc == 0, out
        return any("①" in b for b in posted(calls, "7"))
    finally:
        L.close()
M = "<!-- tohong-mirror:T-001-1 -->\n① tay"
fails = []
if not run("", "capu-login", M): fails.append("a) MIRROR_AUTHOR rỗng: comment của User được tính là marker")
if run("capu-login", "capu-login", M): fails.append("b) MIRROR_AUTHOR=capu-login: marker của chính chủ không được tính → ghi trùng")
if not run("capu-login", "mallory", M): fails.append("c) marker của người lạ được tính")
if not run("capu-login", "capu-login", "ghi chú\n" + M): fails.append("d) marker không ở đầu thân được tính")
assert not fails, "\n".join(fails)
print("PASS marker chỉ tính khi tác giả là bot hoặc MIRROR_AUTHOR, đúng dạng ở đầu")
