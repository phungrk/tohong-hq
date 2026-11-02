#!/usr/bin/env bash
# Nguồn: T-027 (spec products/T-027-back-va-cai-app.md v2, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: gợi ý cài không bao giờ hiện khi đang standalone hay khi Onboarding mở; "Không nhắc lại" được nhớ qua tải lại chỉ trong localStorage, không gửi backend; sự kiện analytics install_* chỉ thêm platform/outcome, không dữ liệu cá nhân.
# Đo bằng lib/nav_check.cjs (bản chụp cố định của eval/T-027/check_t027.cjs) --only 6 --inv. 
# Chạy: bash eval/invariants/planner/front/navigation/inv-006-goi-y-cai-ton-trong-lua-chon.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/nav_check.cjs" --repo "$REPO" --only 6 --inv
