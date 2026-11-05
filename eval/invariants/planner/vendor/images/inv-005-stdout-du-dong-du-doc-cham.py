#!/usr/bin/env python3
"""Nguồn: T-064 adv-01 (Code Gate, adversary, 2026-11-05; spec T-058 mục 2, 3, 6d; T-051 SUMMARY).
INV-005 · stdout đủ dòng dù người đọc ống chậm: `mirror` của công cụ ảnh vendor, ở mọi mã thoát có SUMMARY (0, 3, 4),
không được mất dòng nào khi stdout là ống đầy (đầu ra > bộ đệm ống ~64 KiB, người đọc khựng 2 giây như `tee` trên runner bận):
dòng cuối người đọc nhận là `SUMMARY …`, số dòng FAILED = failed, số dòng MISSING = missing.
Cách đo: chạy `node scripts/vendor-images/vendor-images.mjs mirror` của tohong-back trên thư mục tạm, server HTTP cục bộ trả 403,
~3000 entry failed mồ côi để đầu ra lớn; `--restore-from` trỏ server cục bộ; không gọi mạng ngoài, không cần `sharp`.
Repo tohong-back: --back, rồi TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back cạnh tohong-hq. Không tìm thấy repo/công cụ/node:
PASS "chưa áp dụng". Ca mã 4 bỏ qua nếu công cụ chưa có dừng sớm (chưa T-058). Chạy không tham số (gate.py: python3 -I). Mã 0 = đạt."""
import atexit, json, os, shlex, shutil, subprocess, sys, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", ".."))
argb = sys.argv[sys.argv.index("--back") + 1] if "--back" in sys.argv[:-1] else None
cands = [argb, os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back"),
         os.path.join(os.path.dirname(HQ), "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "scripts", "vendor-images", "vendor-images.mjs"))), None)
if not repo:
    print("PASS chưa áp dụng (không tìm thấy công cụ vendor-images trong tohong-back)"); sys.exit(0)
if not shutil.which("node") or not shutil.which("bash"):
    print("PASS chưa áp dụng (không có node/bash)"); sys.exit(0)
TOOL = os.path.join(repo, "scripts", "vendor-images", "vendor-images.mjs")
BASE = "https://tohong-img.pages.dev"


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_GET(self):
        try:
            self.send_response(403); self.send_header("Content-Length", "1"); self.end_headers(); self.wfile.write(b"x")
        except Exception:
            pass


srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
srv.daemon_threads = True
O = "http://127.0.0.1:%d" % srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
root = tempfile.mkdtemp(prefix="inv005-")
atexit.register(shutil.rmtree, root, True)
ORPHANS = {("https://orphan.example.com/" + "x" * 200 + "/%05d.jpg" % i): {"status": "failed", "reason": "http-404", "attempts": 1}
           for i in range(3000)}


def kv(line):
    return {k: v for k, s, v in (t.partition("=") for t in line.split()[1:]) if s}


def case(name, urls, entries, expect):
    d = tempfile.mkdtemp(dir=root)
    pool, man, out, got = (os.path.join(d, x) for x in ("pool.js", "manifest.json", "out", "stdout.txt"))
    vendors = [{"id": "inv_%03d" % i, "name": "v%d" % i, "photos": [{"url": u}]} for i, u in enumerate(urls)]
    open(pool, "w", encoding="utf-8").write("export const GENERATED_VENDOR_POOL = " + json.dumps(vendors, ensure_ascii=False) + ";\n")
    ents = dict(ORPHANS); ents.update(entries)
    json.dump({"version": 1, "baseUrl": BASE, "entries": ents}, open(man, "w", encoding="utf-8"))
    cmd = " ".join(shlex.quote(c) for c in ["node", TOOL, "mirror", "--pool", pool, "--manifest", man, "--out", out,
                                             "--base-url", BASE, "--restore-from", O + "/r", "--workers", "4"])
    env = {k: v for k, v in os.environ.items() if k not in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "WRANGLER_BIN")}
    try:
        p = subprocess.run(["bash", "-c", f"set -o pipefail; {cmd} | (sleep 2; cat) > {shlex.quote(got)}; echo ${{PIPESTATUS[0]}}"],
                           capture_output=True, text=True, timeout=120, env=env)
    except subprocess.TimeoutExpired:
        return f"{name}: quá 120 giây"
    code = int((p.stdout.strip().splitlines() or ["-1"])[-1])
    if code != expect:
        return None if expect == 4 else f"{name}: mã thoát {code}, mong {expect}; stderr: {p.stderr[-200:]}"
    lines = open(got, encoding="utf-8", errors="replace").read().splitlines()
    if not lines or not lines[-1].startswith("SUMMARY "):
        return f"{name}: người đọc chậm không nhận được SUMMARY cuối (nhận {len(lines)} dòng, cuối: {lines[-1][:60] if lines else None!r})"
    s = kv(lines[-1])
    for tag, key in (("FAILED", "failed"), ("MISSING", "missing")):
        n = sum(1 for l in lines if l.startswith(tag + " "))
        if str(n) != s.get(key):
            return f"{name}: {n} dòng {tag} khác {key}={s.get(key)} trong SUMMARY"
    return "ok"


res = [
    case("mã 0 (chỉ mồ côi)", [], {}, 0),
    case("mã 3 (entry ok thiếu file, khôi phục và tải lại đều 403)", [O + "/a.jpg"],
         {O + "/a.jpg": {"status": "ok", "file": "v/inv_000-aaaaaaaaaaaa.webp", "width": 8, "height": 8, "bytes": 10}}, 3),
    case("mã 4 (50 ứng viên đều 403)", [O + "/f/%d" % i for i in range(50)], {}, 4),
]
bad = [r for r in res if r not in ("ok", None)]
srv.shutdown()
if bad:
    print("FAIL INV-005 " + "; ".join(bad)); sys.exit(1)
print("PASS INV-005 stdout đủ dòng dù người đọc ống chậm (%d ca đo%s)" % (res.count("ok"), ", ca mã 4 chưa áp dụng" if None in res else ""))
