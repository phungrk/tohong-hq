#!/usr/bin/env bash
# Nguồn: eval đối kháng T-026 adv-02 (adversary, 2026-11-01), Chief of Staff đồng ý rút thành bất biến.
# Bất biến: sheet/modal chồng nhau, chạm vùng ngoài khung chỉ đóng lớp trên cùng; lớp dưới vẫn mở.
# Kiểm 1280: Ngân sách -> sheet vendor -> sheet Kết nối. Chỉ phủ cặp sheet mà lib/outside_click_top.cjs mở được.
# Đo bằng lib/outside_click_top.cjs (bản chụp cố định, độc lập với eval/T-026/lib/adv-02.cjs).
# Chạy: bash eval/invariants/front/layout/inv-006-cham-ngoai-khung-chi-dong-lop-tren.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/outside_click_top.cjs" --repo "$REPO"
