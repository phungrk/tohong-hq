#!/usr/bin/env python3
"""Tầng 3 T-063 · input: trên issue có comment của người (không phải marker) mà nội dung trùng khoá mốc,
ví dụ Capu trả lời đúng một dòng 'T-001-1', hoặc trích lại khoá trong câu ('xem T-001-1').
Mong đợi: chỉ comment BẮT ĐẦU bằng '<!-- tohong-mirror:' mới được tính là marker; mốc ① vẫn được ghi.
(Hiện has_marker() lấy phần trước '-->' của MỌI comment, comment không có '-->' thì cả thân bị coi là khoá.)
Chạy với GitHub giả, không mạng."""
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from _advlib import Ledger, posted, patched
L = Ledger()
try:
    L.task("new", "--title", "x", "--to", "product", "--area", "hq/ledger", "--issue", "7", "--criteria", "c", "--by", "chief-of-staff")
    L.comments({"7": [{"body": "Ý định: làm X", "user": {"login": "capu-login"}},
                      {"body": "T-001-1", "user": {"login": "capu-login"}}]})
    rc, out, calls = L.mirror()
    assert rc == 0, out
    assert any("①" in b for b in posted(calls, "7")), "comment thường 'T-001-1' của người bị coi là marker, mốc ① bị nuốt"
    print("PASS comment thường không bị coi là marker")
finally:
    L.close()
