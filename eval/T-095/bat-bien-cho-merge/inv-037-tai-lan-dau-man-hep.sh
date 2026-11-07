#!/usr/bin/env bash
# Nguồn: T-095 adv-06 (eval đối kháng, adversary, 2026-11-07; ADR-034). Vùng: hq/dashboard/model.
# Bất biến: tải trang lần đầu ở 320, 340, 355, 360, 375 không có resize nhân tạo, font nạp ngay và muộn: tâm số đếm không dưới vùng bấm khối mình, vùng bấm không lấn khối khác, rộng ≥ 44px, cao ≥ 44px (≥ 360) hoặc ≥ 36px (< 360, ADR-034); bấm số Capu mở modal.
# GÁC THEO ADR-028: đỏ trên dashboard main d8febc8 ở 320 (vùng bấm phủ số đếm). Chief of Staff đưa vào eval/invariants/hq/dashboard/model/ ngay sau khi PR #21 merge và file này xanh trên main.
# Chạy: bash <file này>   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard; cần NODE_PATH có playwright và D3)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
LIB="$HERE/lib/vung_bam_inv.cjs"; [ -f "$LIB" ] || LIB="$HERE/../../invariants/hq/dashboard/model/lib/vung_bam_inv.cjs"
exec node "$LIB" --repo "$REPO" --check first-load
