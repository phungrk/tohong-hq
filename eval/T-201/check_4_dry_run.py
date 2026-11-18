#!/usr/bin/env python3
"""T-201 tiêu chí 1d: có keep_vars = true ở cấp gốc VÀ `npx wrangler deploy --dry-run` (offline, không deploy) vẫn thoát 0, không cảnh báo/lỗi về keep_vars.
Dùng wrangler đã cài trong tohong-back/node_modules (--no-install). Thoát 0 = PASS, 1 = FAIL, 2 = không chạy được wrangler (thiếu node_modules).
Chạy: python3 -I eval/T-201/check_4_dry_run.py"""
import os, shutil, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import BACK, load

if load().get("keep_vars") is not True:
    print("FAIL chưa có keep_vars = true ở cấp gốc"); sys.exit(1)
if not os.path.exists(os.path.join(BACK, "node_modules/.bin/wrangler")):
    print("ERROR thiếu node_modules/.bin/wrangler trong " + BACK); sys.exit(2)
out = tempfile.mkdtemp()
try:
    r = subprocess.run(["npx", "--no-install", "wrangler", "deploy", "--dry-run", "--outdir", out], cwd=BACK,
                       capture_output=True, text=True, timeout=300,
                       env=dict(os.environ, CI="1", WRANGLER_SEND_METRICS="false", CLOUDFLARE_API_TOKEN=""))
finally:
    shutil.rmtree(out, ignore_errors=True)
txt = r.stdout + r.stderr
if r.returncode != 0:
    print("FAIL dry-run thoát %d: %s" % (r.returncode, txt.strip()[-300:])); sys.exit(1)
if "keep_vars" in txt:
    print("FAIL dry-run nhắc tới keep_vars (cảnh báo/lỗi): " + txt.strip()[-300:]); sys.exit(1)
print("PASS")
