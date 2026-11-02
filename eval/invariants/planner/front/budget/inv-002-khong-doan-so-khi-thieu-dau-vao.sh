#!/usr/bin/env bash
# Nguồn: T-045 (spec products/T-045-nha-hang-tinh-theo-ban.md v3, qua Spec Gate 2026-11-03, spec-critic).
# INV-002 · Vendor đã chốt mà thiếu một đầu vào (số khách 0, hoặc giá 0) thì không hiện số tiền chi suy diễn: số lưu 0 hoặc không có, dòng hạng mục không có tiền chi, không có NaN/undefined/Infinity.
# Đo bằng lib/budget_inv.cjs --only 2 (dữ liệu giả, không đọc mã nguồn, không phụ thuộc công thức tính tiền của hạng mục).
# Chạy: bash eval/invariants/planner/front/budget/inv-002-khong-doan-so-khi-thieu-dau-vao.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/budget_inv.cjs" --repo "$REPO" --only 2
