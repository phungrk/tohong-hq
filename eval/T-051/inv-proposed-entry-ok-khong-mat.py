#!/usr/bin/env python3
"""BẤT BIẾN ĐỀ XUẤT INV-D (vùng planner/vendor/images), chưa nằm trong bể. Spec T-051 mục 14.
Tính chất: mọi entry `ok` của manifest trên `origin/main` (tohong-back) vẫn có mặt, vẫn `ok`, cùng `file` trong manifest đang làm việc.
Chạy không tham số dưới `python3 -I`. Repo: TOHONG_BACK_REPO, hoặc cwd, hoặc ../tohong-back (khi cwd không có scripts/vendor-images).
Chưa có origin/main hoặc chưa có manifest trên main: PASS "chưa áp dụng". Ngoại lệ gỡ ảnh phải có quyết định trong decisions/ (ngoài phạm vi eval)."""
import json, os, subprocess, sys
cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isdir(os.path.join(c, ".git")) and os.path.isdir(os.path.join(c, "lib"))), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy repo tohong-back)"); sys.exit(0)
r = subprocess.run(["git", "-C", repo, "show", "origin/main:scripts/vendor-images/manifest.json"], capture_output=True, text=True)
if r.returncode != 0: print("PASS chưa áp dụng (origin/main chưa có manifest)"); sys.exit(0)
cur_p = os.path.join(repo, "scripts", "vendor-images", "manifest.json")
if not os.path.isfile(cur_p): print("FAIL manifest bị xoá so với origin/main"); sys.exit(1)
old = json.loads(r.stdout)["entries"]; cur = json.load(open(cur_p, encoding="utf-8"))["entries"]
bad = [u for u, e in old.items() if e.get("status") == "ok" and (cur.get(u, {}).get("status") != "ok" or cur[u].get("file") != e.get("file"))]
if bad: print(f"FAIL {len(bad)} entry ok của origin/main bị mất/hạ/đổi file, vd {bad[0]}"); sys.exit(1)
print("PASS không entry ok nào bị mất so với origin/main"); sys.exit(0)
