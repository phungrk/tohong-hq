"""Thư viện dùng chung cho eval T-058 (offline). Dùng lại ảnh và pool của T-051 (eval/T-051/lib/t051.py), thêm server ảnh giả
có đường dẫn: /ok/<n>.png (ảnh tốt), /forbid/<n> (403), /hang/<n> (treo HANG_SECS giây rồi mới trả), /slow/<n> (0,6 giây rồi trả ảnh tốt).
Chỉ gọi CLI trong spec (products/T-058-mirror-tien-do-dung-som.md); không biết gì về cách cài đặt."""
import atexit, json, os, shutil, subprocess, sys, tempfile, threading, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "T-051", "lib"))
from t051 import fail, ok, parse_args, cli, run, vendor, write_pool, read_pool, IMAGES, BASE_URL  # noqa: E402,F401

_ROOT = []


def tmpdir(prefix="t"):
    """Mọi thư mục tạm của eval nằm dưới MỘT thư mục gốc riêng, xoá khi thoát (kể cả fail()/sys.exit) và khi Env.stop()."""
    if not _ROOT:
        _ROOT.append(tempfile.mkdtemp(prefix="t058-eval-"))
        atexit.register(shutil.rmtree, _ROOT[0], True)
    return tempfile.mkdtemp(prefix=prefix, dir=_ROOT[0])


GOOD = IMAGES["/ok/small.png"]
def _webp():
    import io
    from PIL import Image
    b = io.BytesIO(); Image.new("RGB", (8, 8), (200, 10, 10)).save(b, "WEBP"); return b.getvalue()
WEBP = _webp()
HANG_SECS = 25


class Fake:
    def __init__(self, hang_secs=HANG_SECS):
        self.hits = []          # (thời điểm, đường dẫn) mỗi yêu cầu
        self.cur = 0
        self.max_cur = 0
        self.hang_secs = hang_secs
        self.lock = threading.Lock()
        outer = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a): pass

            def do_GET(self):
                path = urllib.parse.unquote(self.path.split("?")[0])
                with outer.lock:
                    outer.hits.append((time.time(), path)); outer.cur += 1; outer.max_cur = max(outer.max_cur, outer.cur)
                try:
                    if path.startswith("/webp/"):
                        return self._send(200, WEBP, "image/webp")
                    if path.startswith("/forbid/"):
                        return self._send(403, b"forbidden", "text/plain")
                    if path.startswith("/hang/"):
                        time.sleep(outer.hang_secs)
                    if path.startswith("/slow/"):
                        time.sleep(0.6)
                    if path.startswith(("/ok/", "/hang/", "/slow/")):
                        return self._send(200, GOOD[0], GOOD[1])
                    self._send(404, b"nope", "text/plain")
                finally:
                    with outer.lock: outer.cur -= 1

            def _send(self, code, data, ct):
                try:
                    self.send_response(code); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(data)))
                    self.end_headers(); self.wfile.write(data)
                except Exception:
                    pass

        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.origin = f"http://127.0.0.1:{self.srv.server_address[1]}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def url(self, path): return self.origin + path
    def paths_hit(self): return [p for _, p in self.hits]
    def stop(self): self.srv.shutdown()


class Env:
    """Thư mục tạm + server giả + pool dựng từ danh sách đường dẫn (mỗi URL một vendor, đúng thứ tự)."""

    def __init__(self, paths, hang_secs=HANG_SECS):
        self.tmp = tmpdir("env-")
        self.fk = Fake(hang_secs)
        self.pool = os.path.join(self.tmp, "vendorPool.generated.js")
        self.manifest = os.path.join(self.tmp, "manifest.json")
        self.out = os.path.join(self.tmp, "out")
        self.set_pool(paths)

    def set_pool(self, paths):
        self.paths = list(paths)
        write_pool(self.pool, [vendor("marry_%04d" % i, [self.fk.url(p)]) for i, p in enumerate(self.paths)])

    def cmd(self, back, extra=None, out=None):
        return cli(back) + ["mirror", "--pool", self.pool, "--manifest", self.manifest, "--out", out or self.out, "--base-url", BASE_URL] + (extra or [])

    def mirror(self, back, extra=None, out=None, timeout=120):
        t = time.time(); p = run(self.cmd(back, extra, out), timeout=timeout); p.elapsed = time.time() - t
        return p

    def stream(self, back, extra=None):
        """Chạy mirror, trả (proc, [(giây từ lúc bắt đầu, dòng stdout)], tổng giây). Dòng được ghi dấu giờ ngay khi tới."""
        e = dict(os.environ)
        for k in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "WRANGLER_BIN"): e.pop(k, None)
        t0 = time.time()
        pr = subprocess.Popen(self.cmd(back, extra), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=e)
        lines = []
        def rd():
            for l in pr.stdout: lines.append((time.time() - t0, l.rstrip("\n")))
        th = threading.Thread(target=rd); th.start()
        try: pr.wait(timeout=180)
        finally: th.join(5)
        return pr, lines, time.time() - t0

    def man_bytes(self):
        return open(self.manifest, "rb").read() if os.path.exists(self.manifest) else None

    def pool_bytes(self): return open(self.pool, "rb").read()
    def stop(self):
        self.fk.stop()
        shutil.rmtree(self.tmp, True)


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


def progress_lines(lines):
    """lines: danh sách chuỗi. Trả list (done, total, ok, failed, {lý do: số}, dòng gốc); dòng sai khuôn thì fail()."""
    import re
    out = []
    for l in lines:
        if not l.startswith("PROGRESS"): continue
        m = re.fullmatch(r"PROGRESS done=(\d+) total=(\d+) ok=(\d+) failed=(\d+) \((.*)\)", l)
        if not m: fail("dòng tiến độ sai khuôn 'PROGRESS done=<n> total=<n> ok=<n> failed=<n> (<lý do>=<n>, … | none)': " + repr(l))
        reasons = {}
        if m.group(5) != "none":
            for part in m.group(5).split(", "):
                k, s, v = part.rpartition("=")
                if not s or not v.isdigit(): fail("phần lý do sai khuôn trong " + repr(l))
                reasons[k] = int(v)
        d, t, o, f = (int(m.group(i)) for i in range(1, 5))
        if d != o + f: fail("done phải = ok + failed: " + repr(l))
        if sum(reasons.values()) != f: fail("tổng theo lý do phải = failed: " + repr(l))
        out.append((d, t, o, f, reasons, l))
    return out


def ok_entry(file):
    return {"status": "ok", "file": file, "width": 8, "height": 8, "bytes": len(WEBP)}


def write_manifest(path, entries):
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "baseUrl": BASE_URL, "entries": entries}, f, ensure_ascii=False, indent=2)


def need_stop(p, env, k, code, pool_before, man_before):
    """Kiểm chung cho ca dừng sớm: mã 4, SUMMARY stopped=early reason=<code>-<k>/<k>, PROGRESS cuối, manifest/pool nguyên byte."""
    if p.returncode != 4: fail(f"phải thoát mã 4, thấy {p.returncode}; stderr: {p.stderr[-200:]}")
    s = summary_line(p.stdout)
    if not s: fail("thiếu dòng SUMMARY khi dừng sớm")
    if p.stdout.splitlines()[-1] != s: fail("SUMMARY phải là dòng cuối của stdout")
    d = kv(s)
    if d.get("stopped") != "early": fail("SUMMARY thiếu stopped=early: " + s)
    if d.get("reason") != f"{code}-{k}/{k}": fail(f"reason phải = {code}-{k}/{k}, thấy {d.get('reason')!r}: {s}")
    if env.man_bytes() != man_before: fail("dừng sớm không được tạo hay đổi manifest")
    if env.pool_bytes() != pool_before: fail("dừng sớm không được đổi pool")
    pl = progress_lines(p.stdout.splitlines())
    if not pl: fail("dừng sớm vẫn phải in dòng PROGRESS cuối")
    if len(set(x[0] for x in pl)) != len(pl): fail("có hai dòng PROGRESS cùng done")
    return d, pl
