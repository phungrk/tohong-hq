#!/usr/bin/env bash
# Nguồn: eval đối kháng T-038 adv-01 (adversary, 2026-11-02), spec products/T-037-bam-nhan-vat-tom-tat.md mục 3 + mục 6.
# Bất biến: tóm tắt nhân vật đang mở thì ở MỌI khung (kể cả khi nhân vật đang give/take do dot tới), hộp sum-bg không chồng lên
# thân bot [data-part=body] của chính nhân vật đó quá 0,5u, ở 390 và 1280px. Trang chưa có #model-sum-live thì PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-028-tom-tat-khong-de-bot-khi-cu-dong.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/adv_sum.cjs" --repo "$REPO" --check motion --inv
