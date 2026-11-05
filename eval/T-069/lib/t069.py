"""Thư viện dùng chung cho eval T-069 (offline). Dùng lại nguồn gốc giả, pool, manifest của T-051/T-065; thay Wayback giả kiểu availability bằng Wayback giả kiểu id_:
  GET /web/<1-14 chữ số>id_/<URL gốc>  -> nếu chưa đủ 14 chữ số: 302 tới /web/<ts bản lưu>id_/<URL gốc> (hoặc 404 nếu không có bản lưu); đủ 14 chữ số: trả bản lưu.
  GET /wayback/available?...           -> ghi lại là 'avail' (công cụ không được gọi), trả 429 như archive.org thật của Capu.
Không bao giờ gọi archive.org thật. Chỉ gọi CLI trong spec (products/T-069-wayback-lay-anh-truc-tiep.md)."""
import json, os, re, sys, threading, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "T-065", "lib"))
import t065  # noqa: E402
from t065 import (fail, ok, cli, run, vendor, write_pool, BASE_URL, need_back, tmpdir, GOOD, BIG, HTML, OriginFake,  # noqa: E402,F401
                  kv, summary_line, need_summary, write_manifest, ok_entry, webp_info, file_for, sha12, WEBP)

TS = "20240730154649"          # mốc bản lưu mặc định (lấy từ URL mẫu của Capu)
TS2 = "20180101000000"
ENTRY_TS = "20261101000000"    # mốc công cụ phải dùng cho yêu cầu đầu tiên (spec mục 1)
CAPU_PATH = "/images/detailed/111/anh-cuoi-dinh-ha-thu-4.jpg"   # đuôi URL mẫu Capu cung cấp 2026-11-05
CAPU_URL = "https://web.archive.org/web/20240730154649/https://www.marry.vn" + CAPU_PATH


class WaybackIdFake:
    """snaps: {đường dẫn gốc: spec}. spec:
      bytes | ('img', bytes, ts) ảnh tại ts | ('html', ts) bản lưu trả 200 là HTML | ('hops', n, ts) n lần chuyển hướng thêm trước khi tới bản lưu
      | ('foreign',) chuyển hướng sang host khác | ('loop',) chuyển hướng vô hạn | ('status', mã) bản lưu trả mã đó | ('big',) ảnh 2000x1000
      | ('nots',) trả ảnh ngay tại mốc công cụ hỏi (không chuyển hướng) | ('reset',) ngắt kết nối
    pre(n, path) -> None | (mã, {header}) ép lỗi | ('hang', giây) | ('reset',); n = số thứ tự yêu cầu (từ 1)."""

    def __init__(self):
        self.reqs = []; self.snaps = {}; self.pre = None; self.lock = threading.Lock(); self.cur = 0; self.max_cur = 0; self.n = 0
        outer = self

        class H(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"
            def log_message(self, *a): pass

            def do_GET(self):
                raw = self.path
                with outer.lock:
                    outer.n += 1; n = outer.n; outer.cur += 1; outer.max_cur = max(outer.max_cur, outer.cur)
                try:
                    u = urllib.parse.urlsplit(raw)
                    m = re.match(r"/web/(\d{1,14})id_/(.*)", urllib.parse.unquote(raw))
                    if not m:
                        kind = "avail" if u.path.startswith("/wayback/available") else "other"
                        outer._rec(kind, raw, u.path, n, raw)
                        if kind == "avail": return self._send(429, b"Too Many Requests", "text/plain")
                        return self._send(404, b"not found", "text/plain")
                    ts, orig = m.group(1), m.group(2)
                    path = urllib.parse.urlsplit(orig).path
                    outer._rec("wb", orig, path, n, raw, ts=ts, ua=self.headers.get("User-Agent", ""))
                    forced = outer.pre and outer.pre(n, path)
                    if forced and forced[0] == "hang": time.sleep(forced[1]); return self._send(404, b"x", "text/plain")
                    if forced and forced[0] == "reset": self.close_connection = True; self.connection.close(); return
                    if forced: return self._send(forced[0], b"slow down", "text/plain", forced[1])
                    sp = outer.snaps.get(path)
                    if sp is None: return self._send(404, b"Wayback Machine has not archived that URL.", "text/html")
                    tag = sp[0] if isinstance(sp, tuple) else "img"
                    if tag == "reset": self.close_connection = True; self.connection.close(); return
                    if tag == "foreign": return self._send(302, b"", "text/plain", {"Location": "http://localhost.invalid:9/web/%sid_/%s" % (TS, orig)})
                    if tag == "loop": return self._send(302, b"", "text/plain", {"Location": "/web/99%02d0000000000id_/%s" % (n % 90, orig)})
                    if tag == "status": return self._send(sp[1], b"captured error", "text/html")
                    if tag == "nots": return self._send(200, GOOD[0], GOOD[1])
                    snap_ts = outer._ts(sp)
                    if ts != snap_ts:
                        hops = sp[1] if tag == "hops" else 0
                        k = int(ts[2:4]) if (ts.startswith("99") and ts[4:] == "0" * 10) else 0
                        nxt = snap_ts if k >= hops else "99%02d0000000000" % (k + 1)
                        return self._send(302, b"", "text/plain", {"Location": "/web/%sid_/%s" % (nxt, orig)})
                    if tag == "html": return self._send(200, HTML, "text/html")
                    data, ct = outer._img(sp)
                    return self._send(200, data, ct)
                finally:
                    with outer.lock: outer.cur -= 1

            def _send(self, code, data, ct, headers=None):
                try:
                    self.send_response(code); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(data)))
                    for k, v in (headers or {}).items(): self.send_header(k, v)
                    self.end_headers(); self.wfile.write(data)
                except Exception: pass

        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H); self.srv.daemon_threads = True
        self.base = f"http://127.0.0.1:{self.srv.server_address[1]}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    @staticmethod
    def _ts(sp):
        if isinstance(sp, tuple) and sp[0] == "img": return sp[2]
        if isinstance(sp, tuple) and sp[0] == "html": return sp[1]
        if isinstance(sp, tuple) and sp[0] == "hops": return sp[2]
        return TS

    @staticmethod
    def _img(sp):
        if isinstance(sp, tuple) and sp[0] == "img": return sp[1], "image/png"
        if sp == "big" or (isinstance(sp, tuple) and sp[0] == "big"): return BIG
        return GOOD

    def _rec(self, kind, orig, path, n, raw, ts=None, ua=""):
        with self.lock: self.reqs.append({"t": time.time(), "kind": kind, "orig": orig, "path": path, "n": n, "raw": raw, "ts": ts, "ua": ua})

    def total(self): return len(self.reqs)
    def of(self, *kinds): return [r for r in self.reqs if r["kind"] in kinds]
    def stop(self): self.srv.shutdown()


class Env(t065.Env):
    def __init__(self, paths, hang_secs=25):
        self.tmp = tmpdir("env-")
        self.og = OriginFake(hang_secs); self.wb = WaybackIdFake()
        self.pool = os.path.join(self.tmp, "vendorPool.generated.js")
        self.manifest = os.path.join(self.tmp, "manifest.json")
        self.out = os.path.join(self.tmp, "out")
        self.set_pool(paths)

    def cmd(self, back, extra=None, wayback=True, fast=True):
        c = cli(back) + ["mirror", "--pool", self.pool, "--manifest", self.manifest, "--out", self.out, "--base-url", BASE_URL]
        if wayback:
            c += ["--fallback", "wayback", "--wayback-base", self.wb.base]
            if fast: c += ["--wayback-interval", "30", "--wayback-backoff", "100"]
        return c + (extra or [])


def dead(i): return "/dead/%d" % i
def entries_of(e): return e.man()["entries"]
def failed_line(p, url):
    return next((l for l in p.stdout.splitlines() if l.startswith("FAILED " + url + " ")), None)
