#!/usr/bin/env bash
# Nguồn: T-090 (spec products/T-090-nhan-vat-nho-mot-nua.md v1 mục 2.4, qua Spec Gate 2026-11-07, spec-critic). Vùng: hq/dashboard/model.
# GÁC THEO ADR-028: đỏ trên dashboard main fa46026 (chú thích nd_capu rộng 268u trong khối 190u, tràn ra ngoài viewBox). Chief of Staff đưa vào
#   eval/invariants/hq/dashboard/model/ ngay sau khi PR của T-090 merge và file này xanh trên main; vẫn đỏ thì không đưa, ghi lý do.
# Bất biến: ở 1280, 844, 390 (thường) và 1280, 390 (phóng to), dữ liệu rảnh và bận (số đếm cỡ thực tế), mọi chữ hiển thị của khối bảng Mô hình
#   (g.node, g.res: trọn trong hình chính rect, dung sai 0,5u; g.gate: không đè vòng) nằm trọn trong viewBox.
# Chạy: bash <file này>   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
LIB="$HERE/lib/chu_khoi_inv.cjs"; [ -f "$LIB" ] || LIB="$HERE/../../invariants/hq/dashboard/model/lib/chu_khoi_inv.cjs"
exec node "$LIB" --repo "$REPO" --check text-in-block
