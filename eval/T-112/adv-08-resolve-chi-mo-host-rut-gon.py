#!/usr/bin/env python3
"""T-112 adv-08 (adversary, tầng 3, vòng 2). Spec T-110 v3 Hành vi 5 (SSRF: danh sách host đóng, kiểm từng bước chuyển hướng TRƯỚC khi gửi).
Khoá tính chất làm cho kiểm DNS "không phân giải được thì bỏ qua" không thành lỗ: resolve_overrides.open_link CHỈ gửi request tới 3 host rút gọn của Google
(share.google, goo.gl, maps.app.goo.gl); trang google.com/... không bao giờ bị mở. Kẻ tấn công muốn DNS rebinding phải điều khiển DNS của chính 3 tên miền đó.
Input phá (OFFLINE: giả lập HTTPAdapter.send, socket.getaddrinfo luôn lỗi nên nhánh "không phân giải được" được đi qua):
  (a) Location dạng lệch bộ phân tích URL: https://goo.gl\\@evil.com/, https://goo.gl:443@evil.com/, https://evil.com#@goo.gl, https://goo.gl%2f@evil.com,
      https://goo.gl@goo.gl@evil.com/, http://goo.gl/x, https://goo.gl:8443/x, https://2130706433/, https://[::1]/ -> link_unreachable, không request nào ra ngoài 3 host.
  (b) vòng chuyển hướng goo.gl <-> share.google -> link_unreachable sau tối đa 5 bước (<= 6 request).
  (c) Location tới https://www.google.com/maps/place/<tên> -> trả URL đó, KHÔNG gửi request tới www.google.com.
  (d) Location tới consent.google.com?continue=https://goo.gl/loop2 -> đi tiếp tới goo.gl (host rút gọn), không gửi request tới consent.google.com.
Cần TOHONG_REPO. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, socket, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-106"))
import _common as c
sys.path.insert(0, os.path.join(c.tohong(), "tools", "scraper"))
sys.dont_write_bytecode = True
import requests
from requests.adapters import HTTPAdapter
from urllib3.util import parse_url


def no_dns(*a, **k):
    raise socket.gaierror("eval adv-08: không phân giải")


socket.getaddrinfo = no_dns
SHORT = {"share.google", "goo.gl", "maps.app.goo.gl"}
HOPS, seen = {}, []


def fake_send(self, request, **kw):
    seen.append(parse_url(request.url).host)
    r = requests.Response()
    r.request, r.url, r.encoding = request, request.url, "utf-8"
    nxt = HOPS.get(request.url)
    r.status_code, r._content = (302, b"") if nxt else (200, b"")
    if nxt:
        r.headers["Location"] = nxt
    return r


HTTPAdapter.send = fake_send
import resolve_overrides as ro  # noqa: E402


def run(start, hops):
    HOPS.clear(); HOPS.update(hops); seen.clear()
    try:
        return ro.open_link(start), None, list(seen)
    except ro.ResolveError as ex:
        return None, ex.code, list(seen)


bad = []
for loc in ["https://goo.gl\\@evil.com/", "https://goo.gl:443@evil.com/", "https://evil.com#@goo.gl", "https://goo.gl%2f@evil.com",
            "https://goo.gl@goo.gl@evil.com/", "http://goo.gl/x", "https://goo.gl:8443/x", "https://2130706433/", "https://[::1]/"]:
    final, code, hosts = run("https://goo.gl/a", {"https://goo.gl/a": loc})
    out = [h for h in hosts if (h or "").lower().rstrip(".") not in SHORT]
    if out or code != "link_unreachable":
        bad.append("(a) Location %r: mong link_unreachable và không request ra ngoài; thấy code=%r final=%r hosts=%r" % (loc, code, final, hosts))
final, code, hosts = run("https://goo.gl/l1", {"https://goo.gl/l1": "https://share.google/l2", "https://share.google/l2": "https://goo.gl/l1"})
if code != "link_unreachable" or len(hosts) > 6:
    bad.append("(b) vòng chuyển hướng: mong link_unreachable sau <= 6 request; thấy code=%r, %d request" % (code, len(hosts)))
dest = "https://www.google.com/maps/place/Nh%C3%A0+h%C3%A0ng+A/@10.78,106.70,17z"
final, code, hosts = run("https://share.google/c", {"https://share.google/c": dest})
if final != dest or any(h not in SHORT for h in hosts):
    bad.append("(c) mong trả URL Google mà không mở nó; thấy final=%r code=%r hosts=%r" % (final, code, hosts))
final, code, hosts = run("https://goo.gl/d", {"https://goo.gl/d": "https://consent.google.com/ml?continue=https%3A%2F%2Fgoo.gl%2Fd2", "https://goo.gl/d2": dest})
if final != dest or any(h not in SHORT for h in hosts):
    bad.append("(d) consent -> continue goo.gl: mong tới %r, chỉ request host rút gọn; thấy final=%r code=%r hosts=%r" % (dest, final, code, hosts))
if bad:
    print("FAIL %d vi phạm, vd: %s" % (len(bad), " | ".join(bad[:3]))); sys.exit(1)
print("PASS open_link chỉ gửi request tới share.google/goo.gl/maps.app.goo.gl, kể cả khi DNS không phân giải; URL lệch bộ phân tích, vòng lặp, cổng/scheme lạ đều link_unreachable")
