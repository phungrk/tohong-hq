#!/usr/bin/env python3
"""T-221 tiêu chí 1 (offline), thân lỗi không chuẩn và không lộ dữ liệu vendor (spec sau D2: thân JSON không bao giờ in thô; thân không phải JSON không bao giờ in nội dung):
 - thân KHÔNG phải JSON (HTML 502 nhiều dòng, thân rỗng, JSON hỏng) -> `reason= message=non_json_body bytes=<số byte UTF-8 của thân> content_type=<Content-Type>`, KHÔNG chữ nào của thân (kể cả chữ lành) xuất hiện;
 - thân JSON KHÔNG có đối tượng `error` (đối tượng không error, `error` là chuỗi/mảng, mảng, null, số, chuỗi) -> `reason= message=` đều RỖNG, không thân thô;
 - thân JSON CÓ đối tượng `error` mà status/message không phải chuỗi -> trường đó rỗng; không làm CLI sập: vẫn đúng một dòng, vẫn P0_STOP như cũ;
 - thân lỗi mang kèm tên/địa chỉ vendor ở trường khác (error.details, places) -> dòng KHÔNG chứa chúng; stdout không chứa tên/địa chỉ/place_id bao giờ;
 - lần chạy bình thường (mọi 200) KHÔNG in dòng P0_HTTP_ERROR nào."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _e as E
T = E.T
T.need_cli()
bad = []
LI = E.LINE
def want(kind, st, reason, msg):
    return "P0_HTTP_ERROR kind=%s status=%d reason=%s message=%s" % (kind, st, reason, msg)
# 1. HTML nhiều dòng, có chữ Việt (đếm BYTE, không đếm ký tự), dài hơn 300: không in nội dung
html = "<html>\n<body>\r\n\t<h1>502   Cổng xấu Bad Gateway</h1>\n</body></html> " + "z" * 400
rc, out, calls, _ = E.run({}, {"gemini": {"status": 502, "body": html, "ctype": "text/html; charset=utf-8"}})
e = E.errs(out)
if e != [want("gemini", 502, "", "non_json_body bytes=%d content_type=text/html; charset=utf-8" % len(html.encode("utf-8")))]:
    bad.append("thân HTML: dòng sai %r (cần non_json_body bytes=%d content_type=text/html; charset=utf-8)" % (e[:1], len(html.encode("utf-8"))))
if any(w in out for w in ("Bad Gateway", "Cổng xấu", "zzzzzzzz", "<h1>")):
    bad.append("thân HTML: nội dung thân lộ ra stdout")
if "P0_STOP http_502" not in out:
    bad.append("thân HTML: P0_STOP http_502 phải giữ nguyên")
# 2. JSON không có error: reason, message rỗng (không thân thô)
rc, out, calls, _ = E.run({}, {"search": {"status": 500, "body": {"detail": "boom"}}})
if E.errs(out) != [want("text_search", 500, "", "")] or "boom" in out:
    bad.append("JSON thiếu error: phải là reason= message= rỗng, có %r" % (E.errs(out)[:1],))
# 3. thân rỗng và JSON hỏng: không phải JSON
rc, out, calls, _ = E.run({}, {"gemini": {"status": 503, "body": ""}})
if E.errs(out) != [want("gemini", 503, "", "non_json_body bytes=0 content_type=text/html")] or "P0_STOP http_503" not in out:
    bad.append("thân rỗng: cần `non_json_body bytes=0 content_type=text/html` và P0_STOP http_503 (%r)" % (E.errs(out)[:1],))
rc, out, calls, _ = E.run({}, {"gemini": {"status": 503, "body": "{broken: secretword", "ctype": ""}})
if E.errs(out) != [want("gemini", 503, "", "non_json_body bytes=19 content_type=")] or "secretword" in out:
    bad.append("JSON hỏng, không có header Content-Type: cần `non_json_body bytes=19 content_type=` (rỗng), không lộ thân (%r)" % (E.errs(out)[:1],))
# 4. thân lạ: không sập, đúng một dòng khớp mẫu và đúng nội dung
weirds = (({"error": {"code": 400, "status": "X", "message": 12345}}, "X", ""), ({"error": {"message": {"a": 1}}}, "", ""), ({"error": {"status": 7, "message": "m ok"}}, "", "m ok"),
          ({"error": "text-only"}, "", ""), ({"error": ["a"]}, "", ""), ([1, 2], "", ""), ("null", "", ""), ("123", "", ""), ("\"just a string\"", "", ""))
for weird, rs, ms in weirds:
    rc, out, calls, _ = E.run({}, {"gemini": {"status": 400, "body": weird}})
    if "Traceback" in out or "P0_STOP http_400" not in out or E.errs(out) != [want("gemini", 400, rs, ms)]:
        bad.append("thân lạ %r: cần reason=%r message=%r, có %r" % (weird, rs, ms, E.errs(out)[:1]))
    if "just a string" in out or "text-only" in out:
        bad.append("thân lạ %r: nội dung thân bị in" % (weird,))
# không lộ dữ liệu vendor
VN = "VENDOR-NAME-SENTINEL Xe Hoa Hoàng Gia"
VA = "99 Đường Bí Mật, Quận 7"
body = {"error": {"code": 403, "status": "PERMISSION_DENIED", "message": "Places API has not been used.", "details": [{"reason": VN, "metadata": {"address": VA}}]}, "places": [{"id": "ChIJSECRET", "displayName": {"text": VN}, "formattedAddress": VA}]}
rc, out, calls, _ = E.run({}, {"search": {"status": 403, "body": body}})
e = E.errs(out)
if e != [want("text_search", 403, "PERMISSION_DENIED", "Places API has not been used.")] or any(s in out for s in (VN, VA, "ChIJSECRET", "VENDOR-NAME")):
    bad.append("dòng/đầu ra lộ trường ngoài error.message hoặc dữ liệu vendor: %r" % (e[:1],))
# chạy bình thường: không có dòng
files, removed, fx, meta = T.world()
r = T.Root(files, removed)
rc, out, calls = r.run(T.std_args(), fx, run_id="221")
if "P0_HTTP_ERROR" in out:
    bad.append("lần chạy toàn 200 không được in P0_HTTP_ERROR")
T.done(bad, "thân không phải JSON chỉ ra non_json_body bytes/content_type; thân JSON không error ra rỗng; kiểu lạ không sập; không lộ dữ liệu vendor; chạy 200 không có dòng")
