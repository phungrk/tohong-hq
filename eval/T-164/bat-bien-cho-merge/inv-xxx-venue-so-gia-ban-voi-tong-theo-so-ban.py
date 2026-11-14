#!/usr/bin/env python3
"""Nguồn: T-164 (spec products/T-164-gia-vendor-n4-nhan-gia.md, H7 và "Bất biến đề xuất" INV-D; đề xuất của product, chờ spec-critic rút vào bể khi spec qua Spec Gate).
Nằm ở eval/T-164/bat-bien-cho-merge/ cho tới khi PR code T-164 merge (ADR-028); Chief of Staff đưa vào eval/invariants/planner/vendor/matching/ (hoặc images/) và đặt số.
INV-D · Giá venue là tr/bàn và luôn được so với ngân sách hạng mục (tổng) qua tổng = giá/bàn x ceil(số khách/10), ở điểm ngân sách tab, lọc cứng chat và nới x1,2 (lên tổng);
  không có số khách thì điểm đúng 0,5 và không lọc cứng venue theo giá; vendor ước tính không có chip ngân sách. Nội dung = eval/T-164/check_9_venue_theo_ban.mjs.
Back chưa có venue theo bàn (chưa có T-164): PASS "chưa áp dụng". Chạy: python3 -I <file>. Repo: TOHONG_BACK_REPO hoặc ../tohong-back. Cần node."""
import os, subprocess, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
B = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back")) if p and os.path.isfile(os.path.join(p, "lib", "vendorMatcher.js"))), None)
if not B or "/bàn" not in open(os.path.join(B, "lib", "vendorMatcher.js"), encoding="utf-8").read(): print("PASS chưa áp dụng (back chưa có venue theo bàn)"); sys.exit(0)
r = subprocess.run(["node", os.path.join(HQ, "eval", "T-164", "check_9_venue_theo_ban.mjs")], capture_output=True, text=True, timeout=300)
last = (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1]
print(last); sys.exit(0 if last.startswith("PASS") else 1)
