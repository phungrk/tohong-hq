#!/usr/bin/env python3
"""Nguồn: T-164 (spec products/T-164-gia-vendor-n4-nhan-gia.md, H5 và "Bất biến đề xuất" INV-C; đề xuất của product, chờ spec-critic rút vào bể khi spec qua Spec Gate).
Rút vào bể bởi spec-critic khi T-164 v3 qua Spec Gate 2026-11-14, vùng cha planner/vendor/ để chạy cho mọi việc chạm images, matching, pool (sinh lại pool ở vùng pool cũng phải giữ nó). Xanh trên main trước T-164 nhờ PASS "chưa áp dụng" nên không cần gác theo ADR-028.
INV-C · Giá ước tính (priceSource estimate_*) được dùng như giá cũ cho lọc/điểm/thứ tự (phép thử tương đương: chỉ đổi nhãn nguồn giá thì danh sách chat và điểm tab giống hệt), nhưng không bao giờ làm bằng chứng
  cho lời khẳng định ngân sách: không chip "Trong ngân sách"/"Rẻ hơn Ntr", không đếm vào "nằm trong tầm giá", không vào "giá dao động". Nội dung = eval/T-164/check_6_ghep_vendor.mjs.
Back chưa biết price_basis (chưa có T-164): PASS "chưa áp dụng". Áp dụng khi pool có priceSource HOẶC mã back đã có dấu hiệu cài (spec-critic thêm vế pool: không phụ thuộc tên file chứa mã). Chạy: python3 -I <file>. Repo: TOHONG_BACK_REPO hoặc ../tohong-back. Cần node."""
import os, subprocess, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
B = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back")) if p and os.path.isfile(os.path.join(p, "lib", "vendorOverlay.js"))), None)
def _pool_co_nguon(b):
    try:
        s = open(os.path.join(b, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
        return '"priceSource"' in s
    except OSError: return False
if not B or ("price_basis" not in open(os.path.join(B, "lib", "vendorOverlay.js"), encoding="utf-8").read() and not _pool_co_nguon(B)): print("PASS chưa áp dụng (back chưa có price_basis)"); sys.exit(0)
r = subprocess.run(["node", os.path.join(HQ, "eval", "T-164", "check_6_ghep_vendor.mjs")], capture_output=True, text=True, timeout=300)
last = (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1]
print(last); sys.exit(0 if last.startswith("PASS") else 1)
