#!/usr/bin/env bash
# Nguồn: eval đối kháng T-026 adv-01 (adversary, 2026-11-01), Chief of Staff đồng ý rút thành bất biến.
# Bất biến: khi sheet/modal đang mở và viewport rộng hơn khung, chạm vùng ngoài khung thì sheet đóng (như chạm lớp tối).
# Kiểm sheet Mời ở 1024/1280 và sheet vendor ở Ngân sách ở 1280. Chỉ phủ sheet mà lib/outside_click.cjs mở được.
# Đo bằng lib/outside_click.cjs (bản chụp cố định, độc lập với eval/T-026/lib/adv-01.cjs).
# Chạy: bash eval/invariants/planner/front/layout/inv-005-cham-ngoai-khung-dong-sheet.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/outside_click.cjs" --repo "$REPO"
