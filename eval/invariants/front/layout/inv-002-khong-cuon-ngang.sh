#!/usr/bin/env bash
# Nguồn: T-025 (spec products/T-025-responsive-width.md, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: không có cuộn ngang (html, body, khung) ở mọi viewport 320-1440.
# Đo bằng lib/check_width.cjs (bản chụp cố định của eval/T-025/check_width.cjs) --only 3.
# Chạy: bash eval/invariants/front/layout/inv-002-khong-cuon-ngang.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
# Định nghĩa: khung = phần tử .app-frame; --app-max = custom property trên :root, giá trị 768px.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/check_width.cjs" --repo "$REPO" --only 3
