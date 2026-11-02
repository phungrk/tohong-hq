#!/usr/bin/env bash
# Nguồn: T-045 (spec products/T-045-nha-hang-tinh-theo-ban.md v3, qua Spec Gate 2026-11-03, spec-critic).
# INV-001 · Khoản vendor đã chốt có MỘT con số trong Ngân sách: số lưu (amt) = số ở dòng khoản trong Mục con = số tiền chi ở dòng hạng mục; tổng "Đã chốt" = tổng số lưu.
# Đo bằng lib/budget_inv.cjs --only 1 (dữ liệu giả, không đọc mã nguồn, không phụ thuộc công thức tính tiền của hạng mục).
# Chạy: bash eval/invariants/planner/front/budget/inv-001-mot-con-so-cho-khoan-vendor.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/budget_inv.cjs" --repo "$REPO" --only 1
