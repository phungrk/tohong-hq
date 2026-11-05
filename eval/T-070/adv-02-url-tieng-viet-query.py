#!/usr/bin/env python3
"""T-070 adv-02 (tầng 3): URL gốc có dấu tiếng Việt, dấu cách và query string (spec T-069 mục 1, 6).
Mong đợi: yêu cầu đầu tới Wayback có đường dẫn đúng '/web/20261101000000id_/' + new URL(url).href (đã mã hoá phần trăm theo WHATWG,
không mã hoá thêm lần hai, giữ query); bản lưu có ảnh -> entry ok source=wayback snapshot=<mốc URL cuối>; tên file theo URL gốc.
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-070/adv-02-url-tieng-viet-query.py"""
import os, sys, threading, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-069", "lib"))
from t069 import *


class RawWayback:
    """Wayback giả giữ nguyên đường dẫn đã mã hoá (Location chỉ có ASCII như Wayback thật):
    /web/20261101000000id_/<rest> -> 302 /web/<TS>id_/<rest>; /web/<TS>id_/<rest> -> 200 ảnh; khác -> 404."""
    def __init__(self):
        self.reqs = []
        outer = self
        class H(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"
            def log_message(self, *a): pass
            def do_GET(self):
                outer.reqs.append(self.path)
                pre = "/web/%sid_/" % ENTRY_TS
                if self.path.startswith(pre): return self._send(302, b"", "text/plain", {"Location": "/web/%sid_/%s" % (TS, self.path[len(pre):])})
                if self.path.startswith("/web/%sid_/" % TS): return self._send(200, GOOD[0], GOOD[1])
                return self._send(404, b"nope", "text/plain")
            def _send(self, code, data, ct, headers=None):
                self.send_response(code); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(data)))
                for k, v in (headers or {}).items(): self.send_header(k, v)
                self.end_headers(); self.wfile.write(data)
        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H); self.srv.daemon_threads = True
        self.base = "http://127.0.0.1:%d" % self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
    def stop(self): self.srv.shutdown()

back = need_back()
P = "/dead/ảnh cưới-1.jpg"
Q = "w=200&t=ả"
e = Env(["/ok/small.png"])
e.wb.stop(); e.wb = RawWayback()
try:
    raw_url = e.url(P) + "?" + Q
    href = e.url(urllib.parse.quote(P, safe="/-._~!$&'()*+,;=:@")) + "?" + urllib.parse.quote(Q, safe="/-._~!$&'()*+,;=:@?")
    e.set_pool(["/ok/small.png", raw_url])
    p = e.mirror(back, ["--retries", "0"])
    if p.returncode != 0: fail("mã thoát 0, thấy %s; %s %s" % (p.returncode, p.stdout[-300:], p.stderr[-300:]))
    wb = e.wb.reqs
    if not wb: fail("không có yêu cầu nào tới Wayback")
    want = "/web/%sid_/%s" % (ENTRY_TS, href)
    if wb[0] != want: fail("yêu cầu đầu phải là %r, thấy %r" % (want, wb[0]))
    if wb[1:] != ["/web/%sid_/%s" % (TS, href)]: fail("yêu cầu thứ hai phải là bản lưu theo Location, thấy %r" % wb[1:])
    ents = e.man()["entries"]
    en = ents.get(raw_url) or ents.get(href)
    if not en: fail("manifest không có entry cho URL gốc; khoá: %s" % list(ents))
    if (en.get("status"), en.get("source"), en.get("snapshot")) != ("ok", "wayback", TS): fail("entry phải ok source=wayback snapshot=%s, thấy %s" % (TS, en))
    if not os.path.exists(os.path.join(e.out, en["file"])): fail("file ảnh %s không có" % en["file"])
finally:
    e.stop()
ok("URL tiếng Việt + dấu cách + query: yêu cầu Wayback dùng href nguyên văn (không mã hoá hai lần), entry ok source=wayback")
