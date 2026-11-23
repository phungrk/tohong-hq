#!/usr/bin/env python3
"""T-221 tiêu chí 1 (offline), thân lỗi không chuẩn và không lộ dữ liệu vendor:
 - thân KHÔNG phải JSON (HTML 502, nhiều dòng) -> reason= rỗng, message = 300 ký tự đầu của thân thô sau khi gộp xuống dòng/tab/nhiều khoảng trắng thành một dấu cách;
 - thân JSON không có error.message (vd {"detail":"x"}) -> reason rỗng (hoặc error.status nếu có), message = thân thô (cắt 300); thân rỗng -> message rỗng, dòng vẫn in và vẫn khớp mẫu;
 - error.message không phải chuỗi (số/đối tượng) không làm CLI sập: vẫn có dòng, vẫn P0_STOP như cũ;
 - thân lỗi mang kèm tên/địa chỉ vendor ở trường khác (error.details, places) -> dòng KHÔNG chứa chúng khi có error.message; stdout không chứa tên/địa chỉ/place_id bao giờ;
 - lần chạy bình thường (mọi 200) KHÔNG in dòng P0_HTTP_ERROR nào."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _e as E
T = E.T
T.need_cli()
bad = []
html = "<html>\n<body>\r\n\t<h1>502   Bad Gateway</h1>\n</body></html> " + "z" * 400
rc, out, calls, _ = E.run({}, {"gemini": {"status": 502, "body": html}})
e = E.errs(out)
m = E.LINE.match(e[0]) if len(e) == 1 else None
exp = re.sub(r"\s+", " ", html).strip()[:300]
if not m or m.group(1) != "gemini" or m.group(2) != "502" or m.group(3) != "" or len(m.group(4)) > 300 or not m.group(4).startswith("<html> <body> <h1>502 Bad Gateway</h1>"):
    bad.append("thân HTML: dòng sai %r" % (e[:1],))
if "P0_STOP http_502" not in out:
    bad.append("thân HTML: P0_STOP http_502 phải giữ nguyên")
rc, out, calls, _ = E.run({}, {"search": {"status": 500, "body": {"detail": "boom"}}})
e = E.errs(out)
m = E.LINE.match(e[0]) if len(e) == 1 else None
if not m or m.group(1) != "text_search" or m.group(2) != "500" or m.group(3) != "" or "boom" not in m.group(4):
    bad.append("JSON thiếu error.message: dòng sai %r" % (e[:1],))
rc, out, calls, _ = E.run({}, {"gemini": {"status": 503, "body": ""}})
e = E.errs(out)
if len(e) != 1 or not E.LINE.match(e[0]) or "P0_STOP http_503" not in out:
    bad.append("thân rỗng: vẫn phải có đúng một dòng khớp mẫu và P0_STOP http_503 (%r)" % (e[:1],))
for weird in ({"error": {"code": 400, "status": "X", "message": 12345}}, {"error": {"message": {"a": 1}}}, {"error": "text-only"}, [1, 2], None):
    rc, out, calls, _ = E.run({}, {"gemini": {"status": 400, "body": weird if weird is not None else "null"}})
    if "Traceback" in out or len(E.errs(out)) != 1 or "P0_STOP http_400" not in out or not E.LINE.match(E.errs(out)[0]):
        bad.append("thân lạ %r làm hỏng: %r" % (weird, out[-200:]))
# không lộ dữ liệu vendor
VN = "VENDOR-NAME-SENTINEL Xe Hoa Hoàng Gia"
VA = "99 Đường Bí Mật, Quận 7"
body = {"error": {"code": 403, "status": "PERMISSION_DENIED", "message": "Places API has not been used.", "details": [{"reason": VN, "metadata": {"address": VA}}]}, "places": [{"id": "ChIJSECRET", "displayName": {"text": VN}, "formattedAddress": VA}]}
rc, out, calls, _ = E.run({}, {"search": {"status": 403, "body": body}})
e = E.errs(out)
if len(e) != 1 or "Places API has not been used." not in e[0] or any(s in out for s in (VN, VA, "ChIJSECRET", "VENDOR-NAME")):
    bad.append("dòng/đầu ra lộ trường ngoài error.message hoặc dữ liệu vendor: %r" % (e[:1],))
# chạy bình thường: không có dòng
files, removed, fx, meta = T.world()
r = T.Root(files, removed)
rc, out, calls = r.run(T.std_args(), fx, run_id="221")
if "P0_HTTP_ERROR" in out:
    bad.append("lần chạy toàn 200 không được in P0_HTTP_ERROR")
T.done(bad, "thân HTML/JSON thiếu message/rỗng/kiểu lạ đều ra một dòng hợp lệ, gộp dòng, cắt 300, không lộ dữ liệu vendor; chạy 200 không có dòng")
