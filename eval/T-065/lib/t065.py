"""Thư viện dùng chung cho eval T-065 (offline). Dùng lại ảnh, pool giả, manifest của T-051/T-058, thêm:
  - OriginFake: nguồn gốc giả (thay marry.vn). /ok/<n> ảnh tốt, /dead/<n> 522, /forbid/<n> 403, /gone/<n> 404, /hang/<n> treo, /html/<n> 200 là HTML,
    /huge/<n> khai Content-Length 31MB. Ghi mọi yêu cầu (thời điểm, đường dẫn).
  - WaybackFake: archive.org giả. /wayback/available?url=… và /web/<14 số>id_/<URL gốc>. Ghi mọi yêu cầu (thời điểm, loại, URL gốc, User-Agent).
Chỉ gọi CLI trong spec (products/T-065-khoi-phuc-anh-tu-wayback.md); không biết gì về cách cài đặt. Không bao giờ gọi archive.org thật.
Mọi thư mục tạm nằm dưới MỘT thư mục gốc riêng, xoá khi thoát."""
import atexit, json, os, re, shutil, subprocess, sys, tempfile, threading, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "T-051", "lib"))
from t051 import fail, ok, cli, run, vendor, write_pool, read_pool, IMAGES, BASE_URL, sha12  # noqa: E402,F401

_ROOT = []
TS = "20200315101530"      # mốc bản lưu mặc định
TS2 = "20180101000000"


def parse_args(argv=None):
    """--back <tohong-back>. Không có --back thì tìm: biến TOHONG_BACK_REPO, cwd, ../tohong-back, /home/user/tohong-back."""
    argv = sys.argv[1:] if argv is None else argv
    out = {}
    for i, a in enumerate(argv):
        if a.startswith("--") and i + 1 < len(argv):
            out[a[2:]] = os.path.abspath(argv[i + 1])
    if not out.get("back"):
        cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back"), "/home/user/tohong-back"]
        out["back"] = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "scripts", "vendor-images", "vendor-images.mjs"))), None)
    return out


def need_back():
    b = parse_args().get("back")
    if not b: fail("không tìm thấy tohong-back (truyền --back <thư mục> hoặc đặt TOHONG_BACK_REPO)")
    return b


def tmpdir(prefix="t"):
    if not _ROOT:
        _ROOT.append(tempfile.mkdtemp(prefix="t065-eval-"))
        atexit.register(shutil.rmtree, _ROOT[0], True)
    return tempfile.mkdtemp(prefix=prefix, dir=_ROOT[0])


def _webp():
    import io
    from PIL import Image
    b = io.BytesIO(); Image.new("RGB", (8, 8), (200, 10, 10)).save(b, "WEBP"); return b.getvalue()
WEBP = _webp()
GOOD = IMAGES["/ok/small.png"]       # 300x200 PNG
BIG = IMAGES["/ok/big.jpg"]          # 2000x1000 JPEG -> phải thành rộng 800
HTML = b"<!DOCTYPE html><html><head><title>Wayback Machine</title></head><body>Sorry, this URL has not been archived.</body></html>"


class OriginFake:
    def __init__(self, hang_secs=25):
        self.hits = []; self.hang_secs = hang_secs; self.lock = threading.Lock()
        outer = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a): pass

            def do_GET(self):
                path = urllib.parse.unquote(self.path.split("?")[0])
                with outer.lock: outer.hits.append((time.time(), path))
                if path.startswith("/ok/"):
                    d, ct = IMAGES.get(path, GOOD); return self._send(200, d, ct)
                if path.startswith("/dead/"): return self._send(522, b"timeout", "text/plain")
                if path.startswith("/forbid/"): return self._send(403, b"forbidden", "text/plain")
                if path.startswith("/gone/"): return self._send(404, b"nope", "text/plain")
                if path.startswith("/html/"): return self._send(200, HTML, "text/html")
                if path.startswith("/hang/"):
                    time.sleep(outer.hang_secs); return self._send(200, GOOD[0], GOOD[1])
                if path.startswith("/huge/"):
                    try:
                        self.send_response(200); self.send_header("Content-Type", "image/jpeg"); self.send_header("Content-Length", str(31 * 1024 * 1024))
                        self.end_headers(); self.wfile.write(b"\xff\xd8")
                    except Exception: pass
                    return
                self._send(404, b"nope", "text/plain")

            def _send(self, code, data, ct):
                try:
                    self.send_response(code); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(data)))
                    self.end_headers(); self.wfile.write(data)
                except Exception: pass

        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H); self.srv.daemon_threads = True
        self.origin = f"http://127.0.0.1:{self.srv.server_address[1]}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def url(self, path): return self.origin + path
    def paths_hit(self): return [p for _, p in self.hits]
    def count(self, path): return sum(1 for _, p in self.hits if p == path)
    def count_prefix(self, prefix): return sum(1 for _, p in self.hits if p.startswith(prefix))
    def stop(self): self.srv.shutdown()


class WaybackFake:
    """snaps: {đường dẫn gốc (vd '/dead/3'): spec}. spec: bytes ảnh | ('img', bytes, ts) | ('html', ts) | ('closest', status, ts) = availability báo status khác 200
    | ('nojson',) availability trả HTML | ('raw404', ts) có bản lưu nhưng tải raw trả 404 | ('big',) ảnh 2000x1000.
    pre(kind, n, path) -> None hoặc (mã, {header}) để ép lỗi, hoặc ('hang', giây) để treo rồi trả; kind 'avail' | 'raw'; n = số thứ tự yêu cầu (từ 1)."""

    def __init__(self):
        self.reqs = []; self.snaps = {}; self.pre = None; self.lock = threading.Lock(); self.cur = 0; self.max_cur = 0; self.n = 0
        outer = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a): pass

            def do_GET(self):
                raw = self.path
                with outer.lock:
                    outer.n += 1; n = outer.n; outer.cur += 1; outer.max_cur = max(outer.max_cur, outer.cur)
                try:
                    u = urllib.parse.urlsplit(raw)
                    if u.path == "/wayback/available":
                        orig = urllib.parse.parse_qs(u.query).get("url", [""])[0]
                        path = urllib.parse.urlsplit(orig).path
                        outer._rec("avail", orig, path, n, self.headers.get("User-Agent", ""), raw)
                        forced = outer.pre and outer.pre("avail", n, path)
                        if forced and forced[0] == "hang": time.sleep(forced[1]); return self._send(200, b'{"archived_snapshots":{}}', "application/json")
                        if forced: return self._send(forced[0], b"slow down", "text/plain", forced[1])
                        sp = outer.snaps.get(path)
                        if sp is None or (isinstance(sp, tuple) and sp[0] == "none"):
                            return self._send(200, b'{"url":"%s","archived_snapshots":{}}' % orig.encode(), "application/json")
                        if isinstance(sp, tuple) and sp[0] == "nojson": return self._send(200, HTML, "text/html")
                        ts, status = (sp[2], sp[1]) if isinstance(sp, tuple) and sp[0] == "closest" else (outer._ts(sp), "200")
                        body = {"url": orig, "archived_snapshots": {"closest": {"status": status, "available": True, "timestamp": ts,
                                "url": f"http://127.0.0.1:{outer.srv.server_address[1]}/decoy/{ts}/{path.lstrip('/')}"}}}
                        return self._send(200, json.dumps(body).encode(), "application/json")
                    m = re.match(r"/web/(\d{14})id_/(.*)", urllib.parse.unquote(raw))
                    if m:
                        orig = m.group(2); path = urllib.parse.urlsplit(orig).path
                        outer._rec("raw", orig, path, n, self.headers.get("User-Agent", ""), raw, ts=m.group(1))
                        forced = outer.pre and outer.pre("raw", n, path)
                        if forced and forced[0] == "hang": time.sleep(forced[1]); return self._send(404, b"x", "text/plain")
                        if forced: return self._send(forced[0], b"slow down", "text/plain", forced[1])
                        sp = outer.snaps.get(path)
                        if sp is None or (isinstance(sp, tuple) and sp[0] in ("raw404", "none", "nojson", "closest")):
                            return self._send(404, b"not archived", "text/plain")
                        if isinstance(sp, tuple) and sp[0] == "html": return self._send(200, HTML, "text/html")
                        data, ct = outer._img(sp)
                        return self._send(200, data, ct)
                    outer._rec("other", raw, u.path, n, self.headers.get("User-Agent", ""), raw)
                    self._send(200, HTML, "text/html")
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
        return sp[2] if isinstance(sp, tuple) and sp[0] == "img" else (sp[1] if isinstance(sp, tuple) and sp[0] in ("html", "raw404") else TS)

    @staticmethod
    def _img(sp):
        if isinstance(sp, tuple) and sp[0] == "img": return sp[1], "image/png"
        if sp == "big" or (isinstance(sp, tuple) and sp[0] == "big"): return BIG
        return GOOD

    def _rec(self, kind, orig, path, n, ua, raw, ts=None):
        with self.lock: self.reqs.append({"t": time.time(), "kind": kind, "orig": orig, "path": path, "n": n, "ua": ua, "raw": raw, "ts": ts})

    def of(self, kind): return [r for r in self.reqs if r["kind"] == kind]
    def total(self): return len(self.reqs)
    def stop(self): self.srv.shutdown()


class Env:
    """Thư mục tạm + nguồn giả + Wayback giả + pool dựng từ danh sách đường dẫn (mỗi URL một vendor, đúng thứ tự)."""

    def __init__(self, paths, hang_secs=25):
        self.tmp = tmpdir("env-")
        self.og = OriginFake(hang_secs); self.wb = WaybackFake()
        self.pool = os.path.join(self.tmp, "vendorPool.generated.js")
        self.manifest = os.path.join(self.tmp, "manifest.json")
        self.out = os.path.join(self.tmp, "out")
        self.set_pool(paths)

    def set_pool(self, paths):
        self.paths = list(paths)
        write_pool(self.pool, [vendor("marry_%04d" % i, [p if p.startswith("http") else self.og.url(p)]) for i, p in enumerate(self.paths)])

    def url(self, path): return self.og.url(path)

    def cmd(self, back, extra=None, wayback=True, fast=True):
        c = cli(back) + ["mirror", "--pool", self.pool, "--manifest", self.manifest, "--out", self.out, "--base-url", BASE_URL]
        if wayback:
            c += ["--fallback", "wayback", "--wayback-base", self.wb.base]
            if fast: c += ["--wayback-interval", "30", "--wayback-backoff", "100"]
        return c + (extra or [])

    def mirror(self, back, extra=None, wayback=True, fast=True, timeout=170):
        t = time.time(); p = run(self.cmd(back, extra, wayback, fast), timeout=timeout); p.elapsed = time.time() - t
        return p

    def man(self): return json.load(open(self.manifest, encoding="utf-8"))
    def man_bytes(self): return open(self.manifest, "rb").read() if os.path.exists(self.manifest) else None
    def pool_bytes(self): return open(self.pool, "rb").read()

    def stop(self):
        self.og.stop(); self.wb.stop(); shutil.rmtree(self.tmp, True)


def kv(line):
    d = {}
    for t in line.split()[1:]:
        k, s, v = t.partition("=")
        if s: d[k] = v
    return d


def summary_line(stdout):
    for l in reversed(stdout.splitlines()):
        if l.startswith("SUMMARY "): return l
    return None


def need_summary(p, what):
    s = summary_line(p.stdout)
    if not s: fail(f"{what}: không có dòng SUMMARY (mã thoát {p.returncode}); stderr: {p.stderr[-300:]}")
    return kv(s)


def ok_entry(file, **kw):
    d = {"status": "ok", "file": file, "width": 8, "height": 8, "bytes": len(WEBP)}; d.update(kw); return d


def write_manifest(path, entries):
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "baseUrl": BASE_URL, "entries": entries}, f, ensure_ascii=False, indent=2)


def webp_info(path):
    from PIL import Image
    im = Image.open(path)
    return im.format, im.size


def file_for(vendor_id, url): return "v/%s-%s.webp" % (vendor_id, sha12(url))
