#!/usr/bin/env python3
"""Nguồn: T-167 (spec products/T-167-dong-ngan-sach-hien-phep-so.md v3, H1 "Bất biến nội bộ bắt buộc", H4 "Khớp số", "Bất biến đề xuất"); rút bởi spec-critic khi spec qua Spec Gate 2026-11-14.
Nằm ở eval/T-167/bat-bien-cho-merge/ cho tới khi PR back T-167 merge (ADR-028: đỏ trên main vì chưa có budgetBasis); Chief of Staff đưa vào eval/invariants/planner/vendor/matching/ và đặt số.
INV · Điểm Ngân sách suy ra từ budgetBasis, một nguồn số. Với pool thật, 10 hạng mục, 9 hồ sơ (bảng/không bảng, co giãn, hồ sơ cũ, hạng mục 0, thiếu khách, thiếu ngân sách, rỗng),
  mọi vendor có match ở GET /api/vendors/match có match.budgetBasis với kind hợp lệ, và:
  (1) scoreBreakdown.budget = luật cũ áp trên chính totalTr/categoryBudgetTr in ra (<= -> 1; vượt > 20% -> 0; giữa: 1 - vượt/0,2); no_budget/no_guests -> 0,5;
  (2) per_table: guests = profileSnapshot.guestCount, tables = ceil(guests/10), totalTr = priceMax x tables; total: totalTr = priceMax;
  (3) ngân sách hạng mục allocation/legacy_profile = profileSnapshot.budgetByCategory[cat] (cùng nguồn trong sources); total_share vắng khỏi bản đồ và = budgetTotal x sharePct/100;
  (4) GET /api/vendors/:id cho đúng budgetBasis như danh sách.
Chạy: python3 -I <file>. Repo: TOHONG_BACK_REPO hoặc ../tohong-back. Cần node."""
import os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__))
r = subprocess.run(["node", os.path.join(D, "lib", "diem_tu_budget_basis.mjs")], capture_output=True, text=True, timeout=300)
last = (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1]
print(last[:600]); sys.exit(0 if last.startswith("PASS") else 1)
