#!/usr/bin/env python3
"""Nguồn: T-069 (spec products/T-069-wayback-lay-anh-truc-tiep.md v1 mục 13; T-065 mục 10), qua Spec Gate 2026-11-05, spec-critic.
(Số INV-007 để dành cho bất biến Product đề xuất "không gọi /wayback/available", rút sau Code Gate T-069.)
INV-008 · Không ai hạ được tốc độ gọi archive.org dưới 1 yêu cầu/giây: `mirror` của công cụ ảnh vendor THOÁT MÃ 2, không ghi manifest,
không gửi yêu cầu nào (kể cả tới nguồn gốc), khi:
  (i)   `--wayback-interval` < 1000 với `--wayback-base` không phải loopback (127.0.0.1, localhost, [::1]);
  (ii)  `--wayback-backoff` < 2000 với base không phải loopback;
  (iii) bất kỳ tham số `--wayback-*` nào khi không có `--fallback wayback`.
Cách đo: base không phải loopback là host `.invalid` (không phân giải được, không bao giờ ra mạng thật); nguồn gốc là server giả loopback
đếm yêu cầu. Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back, rồi /home/user/tohong-back.
Không tìm thấy công cụ / node, hoặc công cụ chưa biết `--fallback` (trước T-065): PASS "chưa áp dụng".
Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import json, os, shutil, subprocess, sys, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back"), "/home/user/tohong-back"]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "scripts", "vendor-images", "vendor-images.mjs"))), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy công cụ vendor-images trong tohong-back)"); sys.exit(0)
if not shutil.which("node"): print("PASS chưa áp dụng (không có node)"); sys.exit(0)
TOOL = os.path.join(repo, "scripts", "vendor-images", "vendor-images.mjs")
hits = []

class Origin(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        hits.append(self.path); self.send_response(404); self.send_header("Content-Length", "1"); self.end_headers(); self.wfile.write(b"x")

srv = ThreadingHTTPServer(("127.0.0.1", 0), Origin); srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()
O = "http://127.0.0.1:%d" % srv.server_address[1]
root = tempfile.mkdtemp(prefix="inv008-")
try:
    pool, man, out = (os.path.join(root, n) for n in ("pool.js", "manifest.json", "out"))
    vendors = [{"id": "inv8_%03d" % i, "name": "v", "photos": [{"url": "%s/gone/%d.png" % (O, i)}]} for i in range(2)]
    open(pool, "w", encoding="utf-8").write("export const GENERATED_VENDOR_POOL = " + json.dumps(vendors) + ";\n")
    env = {k: v for k, v in os.environ.items() if k not in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "WRANGLER_BIN")}
    base = ["node", TOOL, "mirror", "--pool", pool, "--manifest", man, "--out", out, "--base-url", "https://tohong-img.pages.dev", "--retries", "0"]
    far = "http://web.archive.invalid"
    probe = subprocess.run(base + ["--fallback", "wayback", "--wayback-base", far, "--wayback-interval", "500"], capture_output=True, text=True, timeout=60, env=env)
    if "Tham số lạ: --fallback" in probe.stderr: print("PASS chưa áp dụng (công cụ chưa có --fallback wayback, chưa T-065)"); sys.exit(0)
    cases = [
        ("--wayback-interval", ["--fallback", "wayback", "--wayback-base", far, "--wayback-interval", "500"]),
        ("--wayback-interval", ["--fallback", "wayback", "--wayback-base", far, "--wayback-interval", "0"]),
        ("--wayback-backoff", ["--fallback", "wayback", "--wayback-base", far, "--wayback-backoff", "1000"]),
        ("--wayback-backoff", ["--fallback", "wayback", "--wayback-interval", "999", "--wayback-backoff", "100"]),
        ("--wayback-", ["--wayback-interval", "5000"]),
        ("--wayback-", ["--wayback-base", far]),
    ]
    for name, extra in cases:
        hits.clear()
        r = subprocess.run(base + extra, capture_output=True, text=True, timeout=60, env=env)
        if r.returncode != 2: print("FAIL %s phải bị từ chối mã 2, thấy mã %s; stderr: %s" % (" ".join(extra), r.returncode, r.stderr[-150:])); sys.exit(1)
        if "--wayback-" not in r.stderr: print("FAIL %s: stderr phải nêu tên tham số, thấy %r" % (" ".join(extra), r.stderr[-150:])); sys.exit(1)
        if os.path.exists(man): print("FAIL %s: bị từ chối mà vẫn ghi manifest" % " ".join(extra)); sys.exit(1)
        if hits: print("FAIL %s: bị từ chối mà vẫn gửi %d yêu cầu" % (" ".join(extra), len(hits))); sys.exit(1)
    print("PASS %d cách hạ tốc độ / dùng --wayback-* sai đều bị từ chối mã 2, không yêu cầu, không ghi manifest" % len(cases))
finally:
    srv.shutdown(); shutil.rmtree(root, True)
