#!/usr/bin/env bash
# Nguồn: T-025 (spec products/T-025-responsive-width.md, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: mọi phần tử phủ (fixed, absolute z>=50, role=dialog: sheet, scrim, modal) và thanh tab nằm trong khung ở 390/768/1024/1280; phần tử phủ rộng >=300px rộng đúng bằng khung. Chỉ phủ sheet mà lib/check_width.cjs mở được: ai thêm sheet mới phải thêm bước mở nó vào đây (qua Chief of Staff).
# Đo bằng lib/check_width.cjs (bản chụp cố định của eval/T-025/check_width.cjs) --only 2.
# Chạy: bash eval/invariants/planner/front/layout/inv-003-phu-nam-trong-khung.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
# Định nghĩa: khung = phần tử .app-frame; --app-max = custom property trên :root, giá trị 768px.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/check_width.cjs" --repo "$REPO" --only 2
