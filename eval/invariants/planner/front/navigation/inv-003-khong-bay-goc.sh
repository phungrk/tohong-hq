#!/usr/bin/env bash
# Nguồn: T-027 (spec products/T-027-back-va-cai-app.md v2, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: mở app (ở / hay link sâu) không thêm bước nào; ở gốc Back rời app; không hộp thoại rời trang; không bắt popstate để giữ người dùng.
# Đo bằng lib/nav_check.cjs (bản chụp cố định của eval/T-027/check_t027.cjs) --only 3 --inv. 
# Chạy: bash eval/invariants/planner/front/navigation/inv-003-khong-bay-goc.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/nav_check.cjs" --repo "$REPO" --only 3 --inv
