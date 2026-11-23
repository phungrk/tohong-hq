#!/usr/bin/env python3
"""T-221 tiêu chí 1 (offline), nhánh Gemini: lượt Gemini đầu trả 402 kèm thân lỗi kiểu Google.
 - đúng MỘT dòng `P0_HTTP_ERROR kind=gemini status=402 reason=<error.status> message=<error.message>`, nằm TRƯỚC `P0_STOP http_402`;
 - hành vi giữ nguyên: ngoài dòng mới, toàn bộ đầu ra, mã thoát và số lượt gọi y hệt lần chạy cùng mã 402 với thân lỗi cũ của fake T-219;
 - chi 0: GOOGLE_USAGE toàn 0, GEMINI_USAGE calls=1 và token 0, không lượt Maps;
 - message dài hơn 300 ký tự bị cắt đúng 300 ký tự (sau khi che và gộp dòng); 401 ở lượt đầu (gemini_auth) cũng có dòng trước P0_STOP gemini_auth."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _e as E
T = E.T
T.need_cli()
bad = []
MSG = "Billing account required: enable billing for this project."
body = {"error": {"code": 402, "status": "PAYMENT_REQUIRED", "message": MSG}}
rc, out, calls, _ = E.run({}, {"gemini": {"status": 402, "body": body}})
# nền so sánh: cùng mã 402 với thân lỗi mặc định của fake T-219 (không qua fake lỗi)
files, removed, fx, meta = T.world()
r0 = T.Root(files, removed)
rc0, out0, calls0 = r0.run(T.std_args(), dict(fx, gemini=dict(fx["gemini"], grid_status=402)), run_id="221")
es = E.errs(out)
want = "P0_HTTP_ERROR kind=gemini status=402 reason=PAYMENT_REQUIRED message=" + MSG
if es != [want]:
    bad.append("dòng chẩn đoán: có %r, kỳ vọng đúng %r" % (es, want))
L = E.lines(out)
if want in L and "P0_STOP http_402" in L and L.index(want) > L.index("P0_STOP http_402"):
    bad.append("P0_HTTP_ERROR phải đứng trước P0_STOP http_402")
if L.count("P0_STOP http_402") != 1:
    bad.append("P0_STOP http_402 phải đúng 1 lần")
if E.strip_err(out) != E.strip_err(out0) or rc != rc0 or len(calls) != len(calls0):
    bad.append("hành vi đổi: ngoài dòng mới, đầu ra/mã thoát/số lượt gọi phải y hệt (rc %d vs %d, calls %d vs %d)" % (rc, rc0, len(calls), len(calls0)))
for need in ("GOOGLE_USAGE run=221 text_search=0 photo_details=0 photo_media=0 text_search_pro=0 details_count=0", "GEMINI_USAGE run=221 calls=1 search_queries=0 input_tokens=0 output_tokens=0"):
    if need not in L:
        bad.append("thiếu dòng sổ chi 0: " + need)
if any(c["kind"] != "gemini" for c in calls):
    bad.append("không được gọi Maps sau 402 ở lượt Gemini đầu")
# cắt 300
long_msg = "A" * 100 + " " + "B" * 399
rc, out, _, _ = E.run({}, {"gemini": {"status": 402, "body": {"error": {"code": 402, "status": "PAYMENT_REQUIRED", "message": long_msg}}}})
e = E.errs(out)
m = E.LINE.match(e[0]) if len(e) == 1 else None
if not m or len(m.group(4)) != 300 or m.group(4) != long_msg[:300]:
    bad.append("message 500 ký tự phải bị cắt đúng 300 ký tự đầu (có %s)" % (len(m.group(4)) if m else "không khớp mẫu dòng"))
# 401 lượt đầu
rc, out, _, _ = E.run({}, {"gemini": {"status": 401, "body": {"error": {"code": 401, "status": "UNAUTHENTICATED", "message": "API key not valid. Please pass a valid API key."}}}})
L = E.lines(out)
w = "P0_HTTP_ERROR kind=gemini status=401 reason=UNAUTHENTICATED message=API key not valid. Please pass a valid API key."
if w not in L or "P0_STOP gemini_auth" not in L or L.index(w) > L.index("P0_STOP gemini_auth"):
    bad.append("401 lượt đầu: thiếu dòng chẩn đoán trước P0_STOP gemini_auth")
T.done(bad, "Gemini 402/401: một dòng P0_HTTP_ERROR trước P0_STOP, cắt 300, hành vi và chi 0 giữ nguyên")
