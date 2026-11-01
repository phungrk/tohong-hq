#!/usr/bin/env bash
# Nguồn: T-027 (spec products/T-027-back-va-cai-app.md v2, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: manifest có display standalone, icon PNG 192 và 512 (any và maskable riêng, đúng cỡ, nền đặc, logo trong vùng an toàn), apple-touch-icon PNG 180 đặc; Chrome báo đủ điều kiện cài, manifest không lỗi nghiêm trọng.
# Đo bằng lib/nav_check.cjs (bản chụp cố định của eval/T-027/check_t027.cjs) --only 5 --inv. Bỏ ca favicon.svg-không-đổi của riêng T-027.
# Chạy: bash eval/invariants/front/navigation/inv-005-manifest-cai-duoc.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/nav_check.cjs" --repo "$REPO" --only 5 --inv
