"""Thư viện dùng chung cho eval T-051 (chạy offline): server ảnh giả thay marry.vn, server "Pages" giả, wrangler giả, pool giả.
Không biết gì về cách cài đặt: chỉ gọi CLI trong spec (products/T-051-tu-host-anh-vendor.md, mục "Giao diện dòng lệnh")."""
import hashlib, io, json, os, random, subprocess, sys, tempfile, threading, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image

BASE_URL = "https://tohong-img.pages.dev"
HERE = os.path.dirname(os.path.abspath(__file__))


def fail(msg):
    print("FAIL " + msg)
    sys.exit(1)


def ok(msg="đạt"):
    print("PASS " + msg)
    sys.exit(0)


def parse_args(argv=None):
    """--back <tohong-back>  [--tohong <tohong>]  [--front <tohong-front>]"""
    argv = sys.argv[1:] if argv is None else argv
    out = {}
    for i, a in enumerate(argv):
        if a.startswith("--") and i + 1 < len(argv):
            out[a[2:]] = os.path.abspath(argv[i + 1])
    return out


def cli(back):
    p = os.path.join(back, "scripts", "vendor-images", "vendor-images.mjs")
    if not os.path.isfile(p):
        fail("chưa có scripts/vendor-images/vendor-images.mjs trong tohong-back")
    return ["node", p]


def run(cmd, env=None, cwd=None, timeout=120):
    e = dict(os.environ)
    for k in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "WRANGLER_BIN"):
        e.pop(k, None)
    e.update(env or {})
    return subprocess.run(cmd, capture_output=True, text=True, env=e, cwd=cwd, timeout=timeout)


def sha12(url):
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]


# ---------- ảnh nguồn ----------
def _quad(w, h, noisy=False):
    im = Image.new("RGB", (w, h))
    px = im.load()
    rnd = random.Random(7)
    cols = [(220, 30, 30), (30, 200, 30), (30, 30, 220), (230, 220, 30)]
    for y in range(h):
        for x in range(w):
            c = cols[(1 if x >= w // 2 else 0) + (2 if y >= h // 2 else 0)]
            if noisy:
                n = rnd.randint(-12, 12)
                c = tuple(max(0, min(255, v + n)) for v in c)
            px[x, y] = c
    return im


QUAD = {"tl": (220, 30, 30), "tr": (30, 200, 30), "bl": (30, 30, 220), "br": (230, 220, 30)}


def make_images():
    imgs = {}
    b = io.BytesIO(); _quad(2000, 1000, noisy=True).save(b, "JPEG", quality=92); imgs["/ok/big.jpg"] = (b.getvalue(), "image/jpeg")
    b = io.BytesIO(); im = _quad(300, 200).convert("RGBA"); im.putpixel((0, 0), (0, 0, 0, 0)); im.save(b, "PNG"); imgs["/ok/small.png"] = (b.getvalue(), "image/png")
    b = io.BytesIO(); ex = Image.Exif(); ex[0x0112] = 6; _quad(600, 400).save(b, "JPEG", quality=92, exif=ex); imgs["/ok/rot.jpg"] = (b.getvalue(), "image/jpeg")
    b = io.BytesIO(); f1 = _quad(100, 100); f2 = Image.new("RGB", (100, 100), (0, 0, 0)); f1.save(b, "GIF", save_all=True, append_images=[f2], duration=100, loop=0); imgs["/ok/anim.gif"] = (b.getvalue(), "image/gif")
    b = io.BytesIO(); _quad(900, 2700).save(b, "JPEG", quality=92); imgs["/ok/tall.jpg"] = (b.getvalue(), "image/jpeg")
    b = io.BytesIO(); _quad(640, 480).save(b, "JPEG", quality=92); imgs["/ok/Logo-công-nghệ-cưới.jpg"] = (b.getvalue(), "image/jpeg")
    b = io.BytesIO(); _quad(640, 480).save(b, "JPEG", quality=92); imgs["/ok/with space (1).jpg"] = (b.getvalue(), "image/jpeg")
    b = io.BytesIO(); _quad(500, 500).save(b, "JPEG", quality=92); imgs["/ok/flaky.jpg"] = (b.getvalue(), "image/jpeg")
    b = io.BytesIO(); _quad(500, 500).save(b, "JPEG", quality=92); imgs["/ok/late.jpg"] = (b.getvalue(), "image/jpeg")
    b = io.BytesIO(); _quad(1500, 1500, noisy=True).save(b, "JPEG", quality=92); imgs["/bad/trunc.jpg"] = (b.getvalue()[:3000], "image/jpeg")
    return imgs


IMAGES = make_images()


class FakeMarry:
    """Server ảnh giả. Đếm số yêu cầu mỗi đường dẫn (self.hits). /ok/flaky.jpg trả 500 ở yêu cầu đầu tiên rồi OK.
    /ok/late.jpg trả 404 cho tới khi self.late_ready = True. /bad/slow.jpg ngủ 4 giây."""

    def __init__(self):
        self.hits = {}
        self.late_ready = False
        self.forbid = set()
        outer = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a): pass

            def do_GET(self):
                path = urllib.parse.unquote(self.path.split("?")[0])
                outer.hits[path] = outer.hits.get(path, 0) + 1
                n = outer.hits[path]
                if path in outer.forbid:
                    return self._send(403, b"forbidden", "text/plain")
                if path == "/ok/flaky.jpg" and n == 1:
                    return self._send(500, b"boom", "text/plain")
                if path == "/ok/late.jpg" and not outer.late_ready:
                    return self._send(404, b"nope", "text/plain")
                if path == "/bad/always500.jpg":
                    return self._send(500, b"boom", "text/plain")
                if path == "/bad/404.jpg":
                    return self._send(404, b"nope", "text/plain")
                if path == "/bad/html.jpg":
                    return self._send(200, b"<html><body>Access denied</body></html>", "text/html")
                if path == "/bad/slow.jpg":
                    import time; time.sleep(4)
                    return self._send(200, IMAGES["/ok/small.png"][0], "image/png")
                if path in IMAGES:
                    data, ct = IMAGES[path]
                    return self._send(200, data, ct)
                self._send(404, b"nope", "text/plain")

            def _send(self, code, data, ct):
                self.send_response(code)
                self.send_header("Content-Type", ct)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                try: self.wfile.write(data)
                except Exception: pass

        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.port = self.srv.server_address[1]
        self.origin = f"http://127.0.0.1:{self.port}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def url(self, path):
        return self.origin + path  # giữ nguyên ký tự Unicode/khoảng trắng như marry.vn thật

    def total_hits(self):
        return sum(self.hits.values())

    def stop(self):
        self.srv.shutdown()


class FakePages:
    """Phục vụ thư mục `root` qua HTTP như Pages đã deploy."""

    def __init__(self, root):
        self.hits = []
        self.gone = set()    # đường dẫn (vd '/v/xxx.webp') trả 404
        self.flaky = {}      # đường dẫn -> số lần trả 503 trước khi trả đúng
        outer = self
        import functools, http.server

        class H(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass

            def do_GET(self):
                outer.hits.append(self.path)
                if self.path in outer.gone:
                    return self.send_error(404)
                if outer.flaky.get(self.path, 0) > 0:
                    outer.flaky[self.path] -= 1
                    return self.send_error(503)
                super().do_GET()

        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(H, directory=root))
        self.origin = f"http://127.0.0.1:{self.srv.server_address[1]}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def stop(self):
        self.srv.shutdown()


# ---------- pool giả ----------
def vendor(vid, photos, **kw):
    v = {"id": vid, "name": "Vendor " + vid, "category": "photography", "catLabel": "Chụp ảnh", "catIcon": "camera",
         "description": "mô tả", "styles": ["modern"], "priceMin": 5, "priceMax": 15, "city": "HCMC", "rating": 0,
         "reviewCount": 0, "photos": [{"url": u} for u in photos], "availability": [1, 2, 3], "tags": ["modern"], "isVerified": True}
    v.update(kw)
    return v


def write_pool(path, vendors):
    with open(path, "w", encoding="utf-8") as f:
        f.write("// AUTO-GENERATED — do not edit manually.\n// Source: tools/scraper/output/pool-vendors.json\n"
                "// Regenerate: node tools/generate-vendor-pool.js\n"
                "export const GENERATED_VENDOR_POOL = " + json.dumps(vendors, ensure_ascii=False, separators=(",", ":")) + ";\n")


def read_pool(path):
    s = open(path, encoding="utf-8").read()
    i = s.index("= ") + 2
    return json.loads(s[i:s.rindex(";")]), s


def refs(vendors):
    return [(v["id"], p["url"]) for v in vendors for p in v["photos"]]


def standard_pool(fm):
    """5 vendor. Ảnh dùng chung: big.jpg ở marry_aaa… và marry_bbb… (tên file phải theo id nhỏ nhất)."""
    u = fm.url
    return [
        vendor("marry_aaa000000001", [u("/ok/big.jpg"), u("/bad/404.jpg")]),
        vendor("marry_bbb000000002", [u("/ok/big.jpg"), u("/ok/small.png")]),
        vendor("marry_ccc000000003", [u("/ok/rot.jpg"), u("/ok/anim.gif"), u("/ok/Logo-công-nghệ-cưới.jpg"), u("/ok/tall.jpg")]),
        vendor("marry_ddd000000004", [u("/bad/html.jpg"), u("/bad/trunc.jpg"), u("/ok/flaky.jpg"), u("/bad/always500.jpg")]),
        vendor("marry_eee000000005", [u("/ok/with space (1).jpg")]),
    ]


OK_URLS = ["/ok/big.jpg", "/ok/small.png", "/ok/rot.jpg", "/ok/anim.gif", "/ok/Logo-công-nghệ-cưới.jpg", "/ok/tall.jpg", "/ok/flaky.jpg", "/ok/with space (1).jpg"]
BAD_URLS = ["/bad/404.jpg", "/bad/html.jpg", "/bad/trunc.jpg", "/bad/always500.jpg"]


class Work:
    """Thư mục làm việc tạm + fake marry + pool chuẩn."""

    def __init__(self, vendors_fn=standard_pool):
        self.tmp = tempfile.mkdtemp(prefix="t051-")
        self.fm = FakeMarry()
        self.pool = os.path.join(self.tmp, "vendorPool.generated.js")
        self.manifest = os.path.join(self.tmp, "manifest.json")
        self.out = os.path.join(self.tmp, "out")
        self.vendors = vendors_fn(self.fm)
        write_pool(self.pool, self.vendors)

    def mirror(self, back, extra=None, out=None, pool=None, base=BASE_URL):
        cmd = cli(back) + ["mirror", "--pool", pool or self.pool, "--manifest", self.manifest, "--out", out or self.out,
                           "--base-url", base, "--retries", "2", "--timeout", "10"] + (extra or [])
        if "--restore-from" not in cmd and base != BASE_URL:
            cmd += ["--restore-from", base]
        return run(cmd)

    def rewrite(self, back, extra=None, pool=None):
        return run(cli(back) + ["rewrite", "--pool", pool or self.pool, "--manifest", self.manifest] + (extra or []))

    def man(self):
        return json.load(open(self.manifest, encoding="utf-8"))

    def stop(self):
        self.fm.stop()


def summary(proc):
    """Đọc dòng SUMMARY total=.. ok=.. new=.. reused=.. restored=.. failed=.. từ stdout."""
    for line in reversed(proc.stdout.splitlines()):
        if line.startswith("SUMMARY "):
            d = {}
            for kv in line.split()[1:]:
                k, _, v = kv.partition("=")
                d[k] = int(v)
            return d
    return None


def need_summary(proc, what):
    s = summary(proc)
    if s is None:
        fail(f"{what}: không có dòng 'SUMMARY total=.. ok=.. new=.. reused=.. restored=.. failed=..' (exit {proc.returncode}); stderr: {proc.stderr[-200:]}")
    for k in ("total", "ok", "new", "reused", "restored", "failed"):
        if k not in s:
            fail(f"{what}: SUMMARY thiếu trường {k}")
    return s
