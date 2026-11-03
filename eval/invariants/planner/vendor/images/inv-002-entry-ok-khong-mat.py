#!/usr/bin/env python3
"""Nguồn: T-051 (spec products/T-051-tu-host-anh-vendor.md v3 mục 14, qua Spec Gate 2026-11-03, spec-critic; rút từ eval/T-051/inv-proposed-entry-ok-khong-mat.py).
INV-002 · Entry `ok` của manifest ảnh vendor (= file đã deploy lên Pages, pool trên main có thể đang trỏ tới) không bao giờ mất,
bị hạ khỏi `ok`, hay đổi `file`. So manifest đang làm việc với manifest ở merge-base(HEAD, origin/main) của tohong-back
(dùng merge-base thay vì đỉnh origin/main để nhánh tách ra trước một PR mirror mới không bị đỏ oan).
Ngoại lệ duy nhất: gỡ ảnh theo yêu cầu, làm tay, đã có quyết định trong decisions/ (sửa bất biến này qua Chief of Staff).
Chạy không tham số (gate.py: python3 -I). Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back.
Không tìm thấy repo, không có origin/main, hoặc mốc so chưa có manifest: PASS "chưa áp dụng". Mã thoát 0 = đạt."""
import json, os, subprocess, sys

cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "lib", "vendorPool.generated.js"))), None)
if not repo:
    print("PASS chưa áp dụng (không tìm thấy repo tohong-back)"); sys.exit(0)
def git(*a):
    return subprocess.run(["git", "-C", repo, *a], capture_output=True, text=True)
mb = git("merge-base", "HEAD", "origin/main")
if mb.returncode != 0:
    print("PASS chưa áp dụng (không có origin/main)"); sys.exit(0)
r = git("show", mb.stdout.strip() + ":scripts/vendor-images/manifest.json")
if r.returncode != 0:
    print("PASS chưa áp dụng (mốc so trên main chưa có manifest)"); sys.exit(0)
cur_p = os.path.join(repo, "scripts", "vendor-images", "manifest.json")
if not os.path.isfile(cur_p):
    print("FAIL manifest bị xoá so với main"); sys.exit(1)
try:
    old = json.loads(r.stdout)["entries"]; cur = json.load(open(cur_p, encoding="utf-8"))["entries"]
except Exception as e:
    print("FAIL không đọc được manifest: " + str(e)[:120]); sys.exit(1)
bad = [u for u, e in old.items() if e.get("status") == "ok" and (cur.get(u, {}).get("status") != "ok" or cur[u].get("file") != e.get("file"))]
if bad:
    print(f"FAIL {len(bad)} entry ok của main bị mất/hạ/đổi file, vd {bad[0]}"); sys.exit(1)
print("PASS không entry ok nào bị mất so với main"); sys.exit(0)
