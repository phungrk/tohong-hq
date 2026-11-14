#!/usr/bin/env python3
"""Nguồn: T-164 (spec products/T-164-gia-vendor-n4-nhan-gia.md, H7 và "Bất biến đề xuất" INV-D; đề xuất của product, chờ spec-critic rút vào bể khi spec qua Spec Gate).
Rút vào bể bởi spec-critic khi T-164 v3 qua Spec Gate 2026-11-14, vùng cha planner/vendor/ để chạy cho mọi việc chạm images, matching, pool (sinh lại pool ở vùng pool cũng phải giữ nó). Xanh trên main trước T-164 nhờ PASS "chưa áp dụng" nên không cần gác theo ADR-028.
INV-D · Giá venue là tr/bàn và luôn được so với ngân sách hạng mục (tổng) qua tổng = giá/bàn x ceil(số khách/10), ở điểm ngân sách tab, lọc cứng chat và nới x1,2 (lên tổng);
  không có số khách thì điểm đúng 0,5 và không lọc cứng venue theo giá; vendor ước tính không có chip ngân sách. Nội dung = eval/T-164/check_9_venue_theo_ban.mjs.
Back chưa có venue theo bàn (chưa có T-164): PASS "chưa áp dụng". Áp dụng khi pool có priceSource HOẶC mã back đã có dấu hiệu cài (spec-critic thêm vế pool: không phụ thuộc tên file chứa mã). Chạy: python3 -I <file>. Repo: TOHONG_BACK_REPO hoặc ../tohong-back. Cần node."""
import os, subprocess, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
B = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back")) if p and os.path.isfile(os.path.join(p, "lib", "vendorMatcher.js"))), None)
def _pool_co_nguon(b):
    try:
        s = open(os.path.join(b, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
        return '"priceSource"' in s
    except OSError: return False
if not B or ("/bàn" not in open(os.path.join(B, "lib", "vendorMatcher.js"), encoding="utf-8").read() and not _pool_co_nguon(B)): print("PASS chưa áp dụng (back chưa có venue theo bàn)"); sys.exit(0)
r = subprocess.run(["node", os.path.join(HQ, "eval", "T-164", "check_9_venue_theo_ban.mjs")], capture_output=True, text=True, timeout=300)
last = (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1]
print(last); sys.exit(0 if last.startswith("PASS") else 1)
