#!/usr/bin/env python3
"""Nguồn: T-069 (spec products/T-069-wayback-lay-anh-truc-tiep.md v1 mục 11, 13, 15; giữ từ T-065 mục 8-9), qua Spec Gate 2026-11-05, spec-critic.
INV-009 · archive.org chặn (429) thì `mirror` của công cụ ảnh vendor lùi và thôi gõ cửa:
  (i)   sau một phản hồi 429 có `Retry-After: 1`, lần gửi lại cùng yêu cầu bắt đầu sau ít nhất ~1 giây (URL kế tiếp thì chỉ chịu giãn cách thường);
  (ii)  không bao giờ gửi quá 4 yêu cầu liên tiếp cho cùng một đường dẫn (1 lần + tối đa 3 lần thử lại);
  (iii) khi MỌI yêu cầu tới Wayback đều bị 429, cả lần chạy gửi tối đa 20 yêu cầu tới Wayback (ngắt mạch sau 5 URL x 4 yêu cầu), dù pool có 12 URL;
  (iv)  không bao giờ có hai yêu cầu tới Wayback cùng lúc.
Không đo mã thoát hay manifest (đã có eval hành vi và INV-004). Cách đo: nguồn gốc giả loopback luôn 404, `--wayback-base` trỏ server giả loopback
luôn trả 429 `Retry-After: 1` cho mọi đường dẫn; interval/backoff loopback nhỏ để chạy nhanh. Không gọi mạng ngoài, không cần sharp.
Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back, rồi /home/user/tohong-back. Không tìm thấy công cụ / node, hoặc công cụ
chưa biết `--fallback` (trước T-065): PASS "chưa áp dụng". Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt. Chạy ~20 giây."""
import json, os, shutil, subprocess, sys, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back"), "/home/user/tohong-back"]
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
        with lock: reqs.append((time.time(), self.path)); cur[0] += 1; cur[1] = max(cur[1], cur[0])
        try:
            body = b"Too Many Requests"
            self.send_response(429); self.send_header("Retry-After", "1"); self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
        finally:
            with lock: cur[0] -= 1

def serve(h):
    s = ThreadingHTTPServer(("127.0.0.1", 0), h); s.daemon_threads = True
    threading.Thread(target=s.serve_forever, daemon=True).start(); return s, "http://127.0.0.1:%d" % s.server_address[1]
so, O = serve(Origin); sw, W = serve(Wayback)
root = tempfile.mkdtemp(prefix="inv009-")
try:
    pool, man, out = (os.path.join(root, n) for n in ("pool.js", "manifest.json", "out"))
    vendors = [{"id": "inv9_%03d" % i, "name": "v", "photos": [{"url": "%s/gone/%d.png" % (O, i)}]} for i in range(12)]
    open(pool, "w", encoding="utf-8").write("export const GENERATED_VENDOR_POOL = " + json.dumps(vendors) + ";\n")
    env = {k: v for k, v in os.environ.items() if k not in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "WRANGLER_BIN")}
    cmd = ["node", TOOL, "mirror", "--pool", pool, "--manifest", man, "--out", out, "--base-url", "https://tohong-img.pages.dev", "--retries", "0",
           "--workers", "4", "--fallback", "wayback", "--wayback-base", W, "--wayback-interval", "20", "--wayback-backoff", "50"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180, env=env)
    if not reqs and "Tham số lạ: --fallback" in r.stderr: print("PASS chưa áp dụng (công cụ chưa có --fallback wayback, chưa T-065)"); sys.exit(0)
    if not reqs: print("FAIL có cờ mà không yêu cầu nào tới Wayback; stderr: %s" % r.stderr[-200:]); sys.exit(1)
    if len(reqs) > 20: print("FAIL archive.org 429 mọi yêu cầu mà công cụ vẫn gửi %d yêu cầu (tối đa 20: ngắt mạch sau 5 URL x 4)" % len(reqs)); sys.exit(1)
    if cur[1] > 1: print("FAIL %d yêu cầu tới Wayback cùng lúc" % cur[1]); sys.exit(1)
    run_len, mx = 1, 1
    for a, b in zip(reqs, reqs[1:]):
        run_len = run_len + 1 if a[1] == b[1] else 1; mx = max(mx, run_len)
    if mx > 4: print("FAIL %d yêu cầu liên tiếp cho cùng một đường dẫn (tối đa 4)" % mx); sys.exit(1)
    same = [b[0] - a[0] for a, b in zip(reqs, reqs[1:]) if a[1] == b[1]]
    g = min(same) if same else 9
    if g < 0.9: print("FAIL sau 429 Retry-After: 1 mà gửi lại cùng yêu cầu chỉ sau %.2f giây" % g); sys.exit(1)
    print("PASS 429 mọi yêu cầu: %d yêu cầu tổng, tối đa %d liên tiếp cùng đường dẫn, lần gửi lại sớm nhất sau %.2f giây, 1 cùng lúc" % (len(reqs), mx, g))
finally:
    so.shutdown(); sw.shutdown(); shutil.rmtree(root, True)
