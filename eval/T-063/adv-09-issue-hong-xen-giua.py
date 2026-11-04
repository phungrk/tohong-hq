#!/usr/bin/env python3
"""Tầng 3 T-063 · issue hỏng xen giữa hai việc tốt:
 T-001 issue 7 (tốt), T-002 issue 8 (số hợp lệ nhưng GitHub trả 410/500 — vd issue đã xoá/khoá), T-003 issue 9 (tốt),
 cùng một việc 'abc' sửa tay trong board (T-004).
 Mong đợi: rc=0; ① lên 7 và 9; 8 không chặn ai; lần sau khi 8 hết lỗi, ① của T-002 được phản chiếu (không bị
 đánh dấu 'đã xử lý' trong state), và 7, 9 không bị ghi lại. GitHub giả, không mạng."""
import sys, pathlib, re; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _advfail import Ledger, new, posted
L = Ledger(fail=[{"issue": "8", "method": "*", "code": 410, "times": 1}])
try:
    new(L, 1, 7); new(L, 2, 8); new(L, 3, 9); new(L, 4, 10)
    p = L.tmp / "board" / "T-004.md"; p.write_text(re.sub(r'(?m)^issue: .*$', 'issue: "abc"', p.read_text()))
    rc, out, calls = L.mirror()
    assert rc == 0, "issue lỗi chặn cả lần chạy:\n" + out
    assert any("①" in b for b in posted(calls, "7")) and any("①" in b for b in posted(calls, "9")), f"việc tốt bị chặn: {calls}"
    assert "CẢNH BÁO" in out and "T-002" in out, "không cảnh báo việc lỗi:\n" + out
    L.reset_calls(); rc, out, calls = L.mirror(); assert rc == 0, out
    assert any("①" in b for b in posted(calls, "8")), "lần sau T-002 không được phản chiếu lại (bị nuốt vào state)"
    assert not posted(calls, "7") and not posted(calls, "9"), "chạy lại ghi trùng việc tốt"
    print("PASS issue lỗi xen giữa không chặn việc khác, được thử lại, không trùng")
finally:
    L.close()
