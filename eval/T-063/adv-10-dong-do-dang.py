#!/usr/bin/env python3
"""Tầng 3 T-063 · lỗi giữa chừng một mốc: việc bậc A done qua adversary → POST ③, POST ④ thành công,
nhưng PATCH đóng issue lỗi 502 một lần. Lần chạy sau (GitHub đã ổn):
 Mong đợi (tiêu chí 2 'done → comment ④ và issue đóng' + tiêu chí 4 'chạy lại không ghi trùng'):
 issue được ĐÓNG, và không có comment ③/④ trùng. Tương tự bậc C: PATCH gán Capu lỗi một lần → lần sau phải gán.
GitHub giả, không mạng."""
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _advfail import Ledger, new, posted, patched
L = Ledger(fail=[{"issue": "7", "method": "PATCH", "code": 502, "times": 1},
                 {"issue": "8", "method": "PATCH", "code": 502, "times": 1}])
try:
    t = L.task
    new(L, 1, 7, "A"); t("start", "T-001", "--by", "engineering"); t("handoff", "T-001", "--by", "engineering")
    t("accept", "T-001", "--by", "adversary", "--note", "ok")
    new(L, 2, 8, "C"); t("start", "T-002", "--by", "engineering"); t("handoff", "T-002", "--by", "engineering")
    t("accept", "T-002", "--by", "adversary", "--note", "ok")
    # BOT_LOGIN rỗng nên ① không PATCH; PATCH đầu tiên của 7 là đóng, của 8 là gán Capu
    rc, out, calls = L.mirror(); assert rc == 0, out
    L.reset_calls(); rc, out, calls = L.mirror(); assert rc == 0, out
    fails = []
    if not any(p.get("state") == "closed" for p in patched(calls, "7")):
        fails.append("bậc A: PATCH đóng lỗi một lần → lần sau issue không bao giờ được đóng (marker ③ có rồi nên bỏ qua cả hành động)")
    if not any(p.get("assignees") == ["capu-login"] for p in patched(calls, "8")):
        fails.append("bậc C: PATCH gán Capu lỗi một lần → lần sau không gán lại")
    if any(("③" in b or "④" in b) for b in posted(calls, "7") + posted(calls, "8")):
        fails.append("chạy lại ghi trùng ③/④")
    assert not fails, "\n".join(fails)
    print("PASS lỗi PATCH giữa chừng được hoàn tất ở lần sau, không trùng")
finally:
    L.close()
