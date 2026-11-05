#!/usr/bin/env python3
"""Nguồn: T-058 (spec products/T-058-mirror-tien-do-dung-som.md v3 mục 6c và 9, qua Spec Gate 2026-11-05, spec-critic; INV-E Product đề xuất).
INV-004 · `mirror` của công cụ ảnh vendor thoát mã 4 (dừng sớm) thì không bao giờ đổi `--manifest`: file chưa có thì vẫn không có,
file đã có thì giữ nguyên từng byte (kể cả khi manifest không ở dạng chuẩn công cụ hay ghi, và khi có yêu cầu khôi phục đang treo bị huỷ).
Cách đo: chạy `node scripts/vendor-images/vendor-images.mjs mirror` của tohong-back trên thư mục tạm, với server HTTP cục bộ
(403 / treo); không gọi mạng ngoài, không cần `sharp`.
Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back. Không tìm thấy repo/công cụ/node, hoặc công cụ chưa bao giờ
thoát mã 4 trong các ca này (chưa có T-058): PASS "chưa áp dụng". Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import json, os, shutil, subprocess, sys, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "scripts", "vendor-images", "vendor-images.mjs"))), None)
if not repo:
    print("PASS chưa áp dụng (không tìm thấy công cụ vendor-images trong tohong-back)"); sys.exit(0)
if not shutil.which("node"):
    print("PASS chưa áp dụng (không có node)"); sys.exit(0)
TOOL = os.path.join(repo, "scripts", "vendor-images", "vendor-images.mjs")
BASE = "https://tohong-img.pages.dev"


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_GET(self):
        if self.path.startswith("/hang/"):
            time.sleep(30)
        try:
            self.send_response(403); self.send_header("Content-Length", "1"); self.end_headers(); self.wfile.write(b"x")
        except Exception:
            pass


srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
srv.daemon_threads = True
O = "http://127.0.0.1:%d" % srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
root = tempfile.mkdtemp(prefix="inv004-")


def case(name, urls, manifest_text, extra, out_files=()):
    d = tempfile.mkdtemp(dir=root)
    pool, man, out = os.path.join(d, "pool.js"), os.path.join(d, "manifest.json"), os.path.join(d, "out")
    vendors = [{"id": "inv_%03d" % i, "name": "v%d" % i, "photos": [{"url": u}]} for i, u in enumerate(urls)]
    open(pool, "w", encoding="utf-8").write("export const GENERATED_VENDOR_POOL = " + json.dumps(vendors, ensure_ascii=False) + ";\n")
    if manifest_text is not None:
        open(man, "wb").write(manifest_text.encode("utf-8"))
    for f in out_files:
        os.makedirs(os.path.dirname(os.path.join(out, f)), exist_ok=True); open(os.path.join(out, f), "wb").write(b"RIFF0000WEBPVP8 ")
    before = open(man, "rb").read() if os.path.exists(man) else None
    env = {k: v for k, v in os.environ.items() if k not in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "WRANGLER_BIN")}
    try:
        p = subprocess.run(["node", TOOL, "mirror", "--pool", pool, "--manifest", man, "--out", out, "--base-url", BASE] + extra,
                           capture_output=True, text=True, timeout=90, env=env)
    except subprocess.TimeoutExpired:
        return name, None, "quá 90 giây"
    if p.returncode != 4:
        return name, p.returncode, None
    after = open(man, "rb").read() if os.path.exists(man) else None
    if after != before:
        return name, 4, ("tạo manifest khi trước đó không có" if before is None else "manifest bị đổi byte") + " khi thoát mã 4"
    return name, 4, None


try:
    forbid = [O + "/forbid/%d" % i for i in range(3)]
    # Manifest cố ý không ở dạng chuẩn (khoá không xếp, thụt lề khác, không có dòng mới cuối): ghi lại bất kỳ sẽ đổi byte.
    ok_url = O + "/ok-restore/a.png"
    ents = {forbid[2]: {"status": "failed", "reason": "http-403", "attempts": 1}, ok_url: {"status": "ok", "file": "v/inv_009-aaaaaaaaaaaa.webp", "width": 8, "height": 8, "bytes": 16},
            O + "/ok-have/b.png": {"status": "ok", "file": "v/inv_010-bbbbbbbbbbbb.webp", "width": 8, "height": 8, "bytes": 16}}
    odd = json.dumps({"version": 1, "baseUrl": BASE, "entries": ents}, ensure_ascii=False, indent=4)
    results = [
        case("không có manifest, nguồn 403", forbid, None, ["--retries", "0"]),
        case("không có manifest, nguồn treo", [O + "/hang/%d" % i for i in range(2)], None, ["--timeout", "1", "--retries", "0"]),
        case("manifest có entry ok (đã có file, và thiếu file với khôi phục đang treo) + nguồn 403",
             [ok_url, O + "/ok-have/b.png"] + forbid, odd, ["--retries", "0", "--timeout", "5", "--restore-from", O + "/hang"],
             out_files=["v/inv_010-bbbbbbbbbbbb.webp"]),
    ]
finally:
    srv.shutdown(); shutil.rmtree(root, True)

bad = [(n, why) for n, code, why in results if why]
if bad:
    for n, why in bad:
        print("FAIL INV-004 [%s]: %s (spec T-058 mục 6c: dừng sớm không ghi manifest)" % (n, why))
    sys.exit(1)
if not any(code == 4 for _, code, _ in results):
    print("PASS chưa áp dụng (công cụ chưa thoát mã 4 ở ca nào: chưa có dừng sớm T-058); mã thấy: %s" % [c for _, c, _ in results]); sys.exit(0)
print("PASS INV-004: thoát mã 4 không tạo, không đổi manifest (%d/%d ca dừng sớm)" % (sum(1 for _, c, _ in results if c == 4), len(results)))
