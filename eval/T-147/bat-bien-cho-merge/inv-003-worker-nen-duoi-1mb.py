#!/usr/bin/env python3
"""Nguồn: T-147 (spec products/T-147-drawer-vendor-enrich.md v2, Hành vi 2 "Kích thước"; đề nghị của product), rút bởi spec-critic tại Spec Gate 2026-11-13.
Nằm ở eval/T-147/bat-bien-cho-merge/ cho tới khi ba PR T-147 merge (ADR-028); Chief of Staff đưa vào eval/invariants/planner/ (mọi việc chạm tohong-back) và đặt số.
INV-??? (planner) · Bundle Worker tohong-back (`wrangler deploy --dry-run --outdir`, offline) nén gzip -9 <= 1.000.000 byte.
Lý do: gói Cloudflare Workers đang dùng là Free (tohong-back/wrangler.toml: "Queues tạm bỏ (cần gói Workers Paid)"), giới hạn 3 MB nén; ngưỡng một phần ba
  để còn chỗ, và mọi dữ liệu nhúng (pool, báo cáo enrich) làm Worker phình cho MỌI route. Việc nào cần vượt phải đo lại và ghi decisions/, không tự nới.
Chép repo back vào thư mục tạm (node_modules symlink), không mạng, không ghi gì trong repo. Repo: TOHONG_BACK_REPO hoặc ../tohong-back.
Chạy: python3 -I <file>. Thoát 0 = đạt, 1 = vi phạm."""
import gzip, os, shutil, subprocess, sys, tempfile

GZ_MAX = 1_000_000
d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
B = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(d, "..", "tohong-back"))
          if p and os.path.isfile(os.path.join(p, "worker.js"))), None)
if not B:
    print("FAIL không thấy repo tohong-back"); sys.exit(1)
nm = os.path.realpath(os.path.join(B, "node_modules"))
wr = os.path.join(nm, ".bin", "wrangler")
if not os.path.exists(wr):
    print("FAIL thiếu node_modules/.bin/wrangler trong tohong-back (npm ci)"); sys.exit(1)
tmp = tempfile.mkdtemp(prefix="inv-worker-size-")
try:
    app = os.path.join(tmp, "app")
    shutil.copytree(B, app, symlinks=True, ignore=shutil.ignore_patterns(".git", "node_modules", ".wrangler", ".dev.vars"))
    os.symlink(nm, os.path.join(app, "node_modules"))
    out = os.path.join(tmp, "out")
    env = dict(os.environ, WRANGLER_SEND_METRICS="false", CI="1", HOME=os.path.join(tmp, "home"))
    r = subprocess.run([wr, "deploy", "--dry-run", "--outdir", out], cwd=app, env=env, capture_output=True, text=True, timeout=300)
    w = os.path.join(out, "worker.js")
    if r.returncode != 0 or not os.path.isfile(w):
        print("FAIL wrangler deploy --dry-run không bundle được: " + (r.stdout + r.stderr)[-200:].replace("\n", " ")); sys.exit(1)
    gz = len(gzip.compress(open(w, "rb").read(), 9))
    if gz > GZ_MAX:
        print("FAIL worker.js nén gzip %d byte > %d (thô %d)" % (gz, GZ_MAX, os.path.getsize(w))); sys.exit(1)
    print("PASS (worker.js nén %d byte)" % gz)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
