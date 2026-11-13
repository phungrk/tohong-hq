#!/usr/bin/env python3
"""T-147 tiêu chí 5 (repo tohong-back): thêm dữ liệu nguồn vào báo cáo nhúng không làm Worker phình quá ngưỡng và Worker vẫn khởi động trên runtime thật.
Đo (trên bản sao tạm của back, offline): (a) `wrangler deploy --dry-run --outdir` bundle được; worker.js sau khi nén gzip -9 <= 1.000.000 byte (đo trước T-147: ~445.000 byte, nén; giới hạn Cloudflare gói miễn phí 3 MB nén,
gói trả phí 10 MB nén; ngưỡng bằng một phần ba giới hạn nhỏ nhất, để còn chỗ cho T-148 trở đi); (b) lib/vendorEnrichReport.generated.js <= 2.500.000 byte thô (bản dựng thử ~1,96 MB);
(c) bất biến INV-005 của bể (planner/inv-005, khởi động trong workerd qua miniflare với wrangler.toml thật, GET /api/admin không token -> 403) chạy nguyên văn và xanh.
In PASS hoặc FAIL <lý do đầu> (+n); thoát 0/1. Chạy: python3 -I eval/T-147/check_5_bundle_worker.py  (TOHONG_BACK_REPO hoặc ../tohong-back). Mất ~1 phút."""
import glob, gzip, os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
sys.dont_write_bytecode = True
import common

GZ_MAX, RAW_MAX = 1_000_000, 2_500_000
b = common.back()
if not b:
    print("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); sys.exit(2)
nm = os.path.realpath(os.path.join(b, "node_modules"))
if not os.path.exists(os.path.join(nm, ".bin", "wrangler")):
    print("FAIL thiếu node_modules/.bin/wrangler trong tohong-back (npm ci)"); sys.exit(2)
fails = []
rep = os.path.join(b, "lib", "vendorEnrichReport.generated.js")
if os.path.isfile(rep) and os.path.getsize(rep) > RAW_MAX:
    fails.append("lib/vendorEnrichReport.generated.js %d byte > %d" % (os.path.getsize(rep), RAW_MAX))
tmp = tempfile.mkdtemp(prefix="t147-bundle-")
try:
    app = os.path.join(tmp, "app")
    shutil.copytree(b, app, symlinks=True, ignore=shutil.ignore_patterns(".git", "node_modules", ".wrangler", ".dev.vars"))
    os.symlink(nm, os.path.join(app, "node_modules"))
    out = os.path.join(tmp, "out")
    env = dict(os.environ, WRANGLER_SEND_METRICS="false", CI="1", HOME=os.path.join(tmp, "home"))
    r = subprocess.run([os.path.join(nm, ".bin", "wrangler"), "deploy", "--dry-run", "--outdir", out], cwd=app, env=env, capture_output=True, text=True, timeout=300)
    w = os.path.join(out, "worker.js")
    if r.returncode != 0 or not os.path.isfile(w):
        fails.append("wrangler deploy --dry-run không bundle được: " + (r.stdout + r.stderr)[-200:].replace("\n", " "))
    else:
        gz = len(gzip.compress(open(w, "rb").read(), 9))
        if gz > GZ_MAX:
            fails.append("worker.js nén gzip %d byte > %d (thô %d)" % (gz, GZ_MAX, os.path.getsize(w)))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
inv = glob.glob(os.path.join(common.HQ, "eval", "invariants", "planner", "inv-005-worker-back-khoi-dong-trong-workerd.py"))
if not inv:
    fails.append("không thấy INV-005 trong bể")
else:
    p = subprocess.run([sys.executable, "-I", inv[0]], env=dict(os.environ, TOHONG_BACK_REPO=b), capture_output=True, text=True, timeout=600)
    last = (p.stdout.strip().splitlines() or [""])[-1]
    if p.returncode != 0:
        fails.append("INV-005 đỏ: " + last[:200])
if fails:
    print("FAIL " + fails[0] + (" (+%d lỗi nữa)" % (len(fails) - 1) if len(fails) > 1 else "")); sys.exit(1)
print("PASS")
