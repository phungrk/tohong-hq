#!/usr/bin/env python3
"""T-201 tiêu chí 1b: sau thay đổi, keep_vars có mặt VÀ không file cấu hình/workflow/script nào trong tohong-back đặt ADMIN_OPEN
(bất biến planner/admin/inv-004 vẫn xanh, và quét rộng hơn: wrangler*.toml, .dev.vars*, .env*, package.json, .github/**, scripts/**).
Đọc `env.ADMIN_OPEN` trong code nguồn là hợp lệ; chỉ cấm ĐẶT (ADMIN_OPEN = / ADMIN_OPEN: / --var ADMIN_OPEN).
Chạy: python3 -I eval/T-201/check_2_khong_dat_admin_open.py. Thoát 0 = PASS, 1 = FAIL."""
import os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import BACK, load

if load().get("keep_vars") is not True:
    print("FAIL chưa có keep_vars = true (eval này chỉ có nghĩa khi thay đổi đã làm)"); sys.exit(1)

HQ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
inv = os.path.join(HQ, "eval/invariants/planner/admin/inv-004-khong-file-cau-hinh-bat-co-admin-open.py")
r = subprocess.run([sys.executable, "-I", inv], env=dict(os.environ, TOHONG_BACK_REPO=BACK), capture_output=True, text=True)
if r.returncode != 0:
    print("FAIL inv-004: " + (r.stdout + r.stderr).strip()); sys.exit(1)

pat = re.compile(r"(^\s*(export\s+)?ADMIN_OPEN\s*[=:])|(--var[= ]+ADMIN_OPEN\b)|(\bADMIN_OPEN=)", re.M)
hits = []
for dp, dn, fn in os.walk(BACK):
    dn[:] = [d for d in dn if d not in ("node_modules", ".git")]
    rel = os.path.relpath(dp, BACK)
    for f in fn:
        p = os.path.join(rel, f)
        cfgish = (rel == "." and re.match(r"^(wrangler.*\.toml|\.dev\.vars.*|\.env.*|package\.json)$", f)) \
            or p.startswith((".github", "scripts"))
        if cfgish and pat.search(open(os.path.join(dp, f), encoding="utf-8", errors="replace").read()):
            hits.append(p)
if hits:
    print("FAIL đặt ADMIN_OPEN trong: " + ", ".join(hits)); sys.exit(1)
print("PASS")
