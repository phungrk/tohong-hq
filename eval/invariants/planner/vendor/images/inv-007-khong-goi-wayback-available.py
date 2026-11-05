#!/usr/bin/env python3
"""Nguồn: T-069 (đề xuất eval/T-069/inv-proposed-khong-goi-availability.py; bằng chứng Capu 2026-11-05 trong board/T-069.md: archive.org trả 429 cho
/wayback/available) và T-070 (PR tohong-back #37, main 3634598: tải thẳng /web/<mốc>id_/, bỏ availability); rút vào bể theo ADR-023 mục 3 sau khi T-070 qua Code Gate và được merge.
INV-007 · `mirror` của công cụ ảnh vendor không bao giờ gọi API availability của Wayback (đường dẫn chứa /wayback/available, trên bất kỳ host).
Cách đo: nguồn gốc giả luôn 404, Wayback giả loopback ghi mọi đường dẫn và trả 404; chạy `--fallback wayback --wayback-base <giả>`;
đạt khi có ít nhất một yêu cầu tới Wayback và không đường dẫn nào chứa /wayback/available.
Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back. Không tìm thấy công cụ, không có node, hoặc công cụ chưa biết `--fallback`
(thông báo "Tham số lạ: --fallback" của công cụ trước T-065): PASS "chưa áp dụng".
Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import json, os, shutil, subprocess, sys, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "scripts", "vendor-images", "vendor-images.mjs"))), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy công cụ vendor-images)"); sys.exit(0)
if not shutil.which("node"): print("PASS chưa áp dụng (không có node)"); sys.exit(0)
seen = []
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        seen.append(self.path); self.send_response(404); self.send_header("Content-Length", "1"); self.end_headers(); self.wfile.write(b"x")
def serve():
    s = ThreadingHTTPServer(("127.0.0.1", 0), H); s.daemon_threads = True
    threading.Thread(target=s.serve_forever, daemon=True).start(); return s, "http://127.0.0.1:%d" % s.server_address[1]
so, O = serve(); sw, W = serve()
root = tempfile.mkdtemp(prefix="inv-g-")
try:
    pool, man, out = (os.path.join(root, n) for n in ("pool.js", "manifest.json", "out"))
    vendors = [{"id": "g_%03d" % i, "name": "v", "photos": [{"url": "%s/gone/%d.png" % (O, i)}]} for i in range(3)]
    open(pool, "w", encoding="utf-8").write("export const GENERATED_VENDOR_POOL = " + json.dumps(vendors) + ";\n")
    env = {k: v for k, v in os.environ.items() if k not in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "WRANGLER_BIN")}
    cmd = ["node", os.path.join(repo, "scripts", "vendor-images", "vendor-images.mjs"), "mirror", "--pool", pool, "--manifest", man, "--out", out,
           "--base-url", "https://tohong-img.pages.dev", "--retries", "0", "--fallback", "wayback", "--wayback-base", W, "--wayback-interval", "20", "--wayback-backoff", "20"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60, env=env)
    if not seen and "Tham số lạ: --fallback" in r.stderr: print("PASS chưa áp dụng (công cụ chưa có --fallback)"); sys.exit(0)
    bad = [p for p in seen if "/wayback/available" in p]
    if bad: print("FAIL công cụ gọi API availability của Wayback: %s" % bad[0]); sys.exit(1)
    if not seen: print("FAIL có cờ mà không yêu cầu nào tới Wayback; stderr: %s" % r.stderr[-200:]); sys.exit(1)
    print("PASS %d yêu cầu tới Wayback, không có /wayback/available" % len(seen))
finally:
    so.shutdown(); sw.shutdown(); shutil.rmtree(root, True)
