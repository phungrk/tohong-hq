#!/usr/bin/env python3
"""Nguồn: T-065 (spec products/T-065-khoi-phuc-anh-tu-wayback.md v2 mục 1, 7, 10; qua Spec Gate 2026-11-05, spec-critic; rút từ eval/T-065/inv-proposed-wayback-chi-khi-bat-co.py).
INV-006 · `mirror` của công cụ ảnh vendor chỉ gọi Wayback/archive.org khi được bật, và gọi chậm:
  (i)  không có `--fallback wayback` thì không gửi yêu cầu nào tới Wayback (kể cả khi có `--wayback-base`: bị từ chối hay bỏ qua đều được, miễn không có yêu cầu);
  (ii) có cờ, với tốc độ mặc định (không truyền --wayback-interval/--wayback-backoff), hai yêu cầu tới Wayback bắt đầu cách nhau >= 0,9 giây
       và không bao giờ có hai yêu cầu cùng lúc, dù --workers 4.
Cách đo: chạy công cụ trên thư mục tạm, nguồn gốc giả luôn 404, `--wayback-base` trỏ server giả loopback luôn "không có bản lưu" (không gọi mạng ngoài, không cần sharp).
Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back. Không tìm thấy công cụ, không có node, hoặc công cụ chưa biết `--fallback`
(thông báo "Tham số lạ: --fallback" của công cụ trước T-065): PASS "chưa áp dụng".
Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import json, os, shutil, subprocess, sys, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "scripts", "vendor-images", "vendor-images.mjs"))), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy công cụ vendor-images trong tohong-back)"); sys.exit(0)
if not shutil.which("node"): print("PASS chưa áp dụng (không có node)"); sys.exit(0)
TOOL = os.path.join(repo, "scripts", "vendor-images", "vendor-images.mjs")
reqs, cur, lock = [], [0, 0], threading.Lock()

class Origin(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        self.send_response(404); self.send_header("Content-Length", "1"); self.end_headers(); self.wfile.write(b"x")

class Wayback(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        with lock: reqs.append(time.time()); cur[0] += 1; cur[1] = max(cur[1], cur[0])
        time.sleep(0.15)
        body = b'{"archived_snapshots":{}}'
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
        with lock: cur[0] -= 1

def serve(h):
    s = ThreadingHTTPServer(("127.0.0.1", 0), h); s.daemon_threads = True
    threading.Thread(target=s.serve_forever, daemon=True).start(); return s, "http://127.0.0.1:%d" % s.server_address[1]
so, O = serve(Origin); sw, W = serve(Wayback)
root = tempfile.mkdtemp(prefix="inv-f-")
try:
    pool, man, out = (os.path.join(root, n) for n in ("pool.js", "manifest.json", "out"))
    vendors = [{"id": "inv_%03d" % i, "name": "v", "photos": [{"url": "%s/gone/%d.png" % (O, i)}]} for i in range(4)]
    open(pool, "w", encoding="utf-8").write("export const GENERATED_VENDOR_POOL = " + json.dumps(vendors) + ";\n")
    env = {k: v for k, v in os.environ.items() if k not in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "WRANGLER_BIN")}
    base = ["node", TOOL, "mirror", "--pool", pool, "--manifest", man, "--out", out, "--base-url", "https://tohong-img.pages.dev", "--retries", "0", "--workers", "4"]
    r = subprocess.run(base + ["--wayback-base", W], capture_output=True, text=True, timeout=60, env=env)
    if reqs: print("FAIL không có --fallback wayback mà vẫn gửi %d yêu cầu tới Wayback" % len(reqs)); sys.exit(1)
    r = subprocess.run(base + ["--fallback", "wayback", "--wayback-base", W], capture_output=True, text=True, timeout=120, env=env)
    if not reqs and "Tham số lạ: --fallback" in r.stderr: print("PASS chưa áp dụng (công cụ chưa có --fallback wayback, chưa T-065)"); sys.exit(0)
    if len(reqs) < 4: print("FAIL có cờ mà chỉ thấy %d yêu cầu Wayback (mong >= 4, mỗi URL một availability); stderr: %s" % (len(reqs), r.stderr[-200:])); sys.exit(1)
    if cur[1] > 1: print("FAIL %d yêu cầu tới Wayback cùng lúc" % cur[1]); sys.exit(1)
    g = min(b - a for a, b in zip(reqs, reqs[1:]))
    if g < 0.9: print("FAIL hai yêu cầu tới Wayback cách nhau %.2f giây (< 0,9)" % g); sys.exit(1)
    print("PASS Wayback chỉ khi bật cờ; %d yêu cầu, giãn cách nhỏ nhất %.2f giây, tối đa 1 cùng lúc" % (len(reqs), g))
finally:
    so.shutdown(); sw.shutdown(); shutil.rmtree(root, True)
