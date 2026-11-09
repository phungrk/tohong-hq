#!/usr/bin/env bash
# Nguồn: T-115 (spec products/T-115-onboarding-buoc2-cao-hon.md v2, hành vi 6, qua Spec Gate 2026-11-09, spec-critic); defect T-115-D1 cách 3.
# Bất biến: chiều cao và vị trí dọc của sheet Onboarding (và mọi tổ tiên tới lớp phủ position:fixed gần nhất) không dùng vh/lvh,
#   vì trên Safari có thanh công cụ chúng lớn hơn vùng nhìn thấy (đầu sheet bị cắt hoặc nút Tiếp theo nằm sau thanh), mà Chromium tính vh = innerHeight nên eval hành vi không thấy.
#   Được phép: dvh, svh, px/%, neo vào lớp phủ cố định, visualViewport; fallback "100vh rồi 100dvh" trong cùng luật được phép (CSSOM chỉ giữ khai báo sau).
#   Thuộc tính đo: height, min/max-height, top, bottom, inset, block-size, min/max-block-size, inset-block(-start/-end).
# Đo lúc chạy, từ CSSOM đã áp (style inline + mọi luật khớp phần tử ở mọi stylesheet, @media đang khớp) ở 390x664 và 1280x800,
#   nên không lách được bằng cách chuyển sang class mới, file CSS khác hay CSS-in-JS. Mạnh hơn kiểm tĩnh `eval/T-115 --only 6`
#   (kiểm tĩnh chỉ đọc Onboarding.jsx và luật .ov-fixed: spec-critic đã dựng bản thử dùng class .ob-sheet { height: calc(100vh - 28px) } trong @media điện thoại,
#   qua đủ eval T-115 1-6 nhưng bất biến này đỏ).
# Vi phạm bất biến này là code trái hành vi 6 của spec T-115, không phải spec lệch.
# Đo bằng lib/t115/check_inv.cjs --only vh (bản chụp cố định). Xanh trên tohong-front origin/main a7e5807 (2026-11-09).
# Chạy: bash eval/invariants/planner/front/layout/inv-013-sheet-onboarding-khong-cao-theo-vh.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/t115/check_inv.cjs" --repo "$REPO" --only vh
