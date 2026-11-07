#!/usr/bin/env bash
# Nguồn: T-090 (spec products/T-090-nhan-vat-nho-mot-nua.md v1 mục 2 "chữ không được thu", qua Spec Gate 2026-11-07, spec-critic); nhắc lại sàn T-035 1.4.
# Bất biến: ở 1280, 844, 390 (thường) và 1280, 390 (phóng to), dữ liệu rảnh và bận, cỡ chữ hiệu dụng của chữ khối g.node trong #model svg
#   (font-size tính toán × tỉ lệ biến đổi so với svg) .t ≥ 11,5u, .cap ≥ 10,5u, .n ≥ 22u. Làm khối hay nhân vật gọn lại không được trả bằng chữ nhỏ đi.
# Chạy: bash eval/invariants/hq/dashboard/model/inv-033-co-chu-khoi-khong-duoi-san.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/chu_khoi_inv.cjs" --repo "$REPO" --check font-floor
