#!/usr/bin/env bash
# Nguồn: T-045 (spec products/T-045-nha-hang-tinh-theo-ban.md v3, qua Spec Gate 2026-11-03, spec-critic).
# INV-003 · Mở màn Ngân sách mà không bấm gì thì không bao giờ thêm hay xoá khoản, không đổi trường nào ngoài amt của khoản vendor trùng id vendor đang chốt trên máy này; máy không có trạng thái chốt thì không PUT. (Gộp luật "mở màn không thêm hay xoá khoản".)
# Đo bằng lib/budget_inv.cjs --only 3 (dữ liệu giả, không đọc mã nguồn, không phụ thuộc công thức tính tiền của hạng mục).
# Chạy: bash eval/invariants/planner/front/budget/inv-003-mo-man-khong-dung-du-lieu-chung.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/budget_inv.cjs" --repo "$REPO" --only 3
