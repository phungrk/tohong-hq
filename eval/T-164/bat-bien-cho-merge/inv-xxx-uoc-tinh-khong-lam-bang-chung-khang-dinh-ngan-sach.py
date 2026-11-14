#!/usr/bin/env python3
"""Nguồn: T-164 (spec products/T-164-gia-vendor-n4-nhan-gia.md, H5 và "Bất biến đề xuất" INV-C; đề xuất của product, chờ spec-critic rút vào bể khi spec qua Spec Gate).
Nằm ở eval/T-164/bat-bien-cho-merge/ cho tới khi PR code T-164 merge (ADR-028); Chief of Staff đưa vào eval/invariants/planner/vendor/matching/ (hoặc images/) và đặt số.
INV-C · Giá ước tính (priceSource estimate_*) được dùng như giá cũ cho lọc/điểm/thứ tự (phép thử tương đương: chỉ đổi nhãn nguồn giá thì danh sách chat và điểm tab giống hệt), nhưng không bao giờ làm bằng chứng
  cho lời khẳng định ngân sách: không chip "Trong ngân sách"/"Rẻ hơn Ntr", không đếm vào "nằm trong tầm giá", không vào "giá dao động". Nội dung = eval/T-164/check_6_ghep_vendor.mjs.
Back chưa biết price_basis (chưa có T-164): PASS "chưa áp dụng". Chạy: python3 -I <file>. Repo: TOHONG_BACK_REPO hoặc ../tohong-back. Cần node."""
import os, subprocess, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
B = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back")) if p and os.path.isfile(os.path.join(p, "lib", "vendorOverlay.js"))), None)
if not B or "price_basis" not in open(os.path.join(B, "lib", "vendorOverlay.js"), encoding="utf-8").read(): print("PASS chưa áp dụng (back chưa có price_basis)"); sys.exit(0)
r = subprocess.run(["node", os.path.join(HQ, "eval", "T-164", "check_6_ghep_vendor.mjs")], capture_output=True, text=True, timeout=300)
last = (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1]
print(last); sys.exit(0 if last.startswith("PASS") else 1)
