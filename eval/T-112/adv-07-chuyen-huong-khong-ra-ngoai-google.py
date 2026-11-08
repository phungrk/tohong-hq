#!/usr/bin/env python3
"""T-112 adv-07 (adversary, tầng 3). Spec T-110 Hành vi 5: link chỉ nhận host share.google/goo.gl/maps.app.goo.gl/google.com/maps; đích không thuộc `google.*`
là `link_unreachable`. Câu hỏi của Chief of Staff (T-112): "khi bóc continue có rủi ro open redirect hoặc SSRF không".
Input phá (OFFLINE, giả lập tầng HTTPAdapter.send nên chuỗi chuyển hướng THẬT của requests được chạy): goo.gl/<mã> -> 302 tới http://169.254.169.254/latest/meta-data/
(địa chỉ metadata của máy chạy workflow) -> 302 tới https://www.google.com/maps/place/<tên>. goo.gl cũ cho phép rút gọn URL bất kỳ.
Mong: resolve_overrides.open_link KHÔNG gửi request nào tới host ngoài Google (kiểm host từng bước chuyển hướng, không chỉ đích cuối) và trả link_unreachable.
Hiện tại: requests.get(allow_redirects=True) đi theo mọi bước, gửi GET tới 169.254.169.254 rồi mới kiểm host đích cuối (đích cuối là Google nên còn RESOLVED).
Cần TOHONG_REPO. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-106"))
import _common as c
sys.path.insert(0, os.path.join(c.tohong(), "tools", "scraper"))
sys.dont_write_bytecode = True
import requests
from requests.adapters import HTTPAdapter
from urllib.parse import urlsplit

HOPS = {"https://goo.gl/adv07": "http://169.254.169.254/latest/meta-data/",
        "http://169.254.169.254/latest/meta-data/": "https://www.google.com/maps/place/Nh%C3%A0+h%C3%A0ng+Adv/@10.78,106.70,17z"}
seen = []


def fake_send(self, request, **kw):
    seen.append(request.url)
    r = requests.Response()
    r.request, r.url, r.encoding = request, request.url, "utf-8"
    nxt = HOPS.get(request.url)
    if nxt:
        r.status_code, r.headers["Location"], r._content = 302, nxt, b""
    else:
        r.status_code, r._content = 200, b"<html></html>"
    return r


HTTPAdapter.send = fake_send
import resolve_overrides as ro  # noqa: E402

code = None
try:
    final = ro.open_link("https://goo.gl/adv07")
except ro.ResolveError as ex:
    code = ex.code
outside = [u for u in seen if not ro.is_google_host(urlsplit(u).hostname or "") and (urlsplit(u).hostname or "") not in ("goo.gl", "share.google", "maps.app.goo.gl")]
bad = []
if outside:
    bad.append("đã gửi request tới host ngoài Google trong chuỗi chuyển hướng: %r" % outside)
if code != "link_unreachable":
    bad.append("chuỗi chuyển hướng đi qua host ngoài Google mong link_unreachable, thấy %r" % (code or "thành công"))
if bad:
    print("FAIL " + " | ".join(bad)); sys.exit(1)
print("PASS không theo chuyển hướng ra ngoài Google; link_unreachable")
