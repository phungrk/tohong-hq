#!/usr/bin/env bash
# Nguồn: T-039 (spec products/T-039-mui-ten-huong.md v2, qua Spec Gate 2026-11-02, spec-critic; đề xuất INV-C của Product).
# Bất biến: không phần tử nào có fill/stroke tính ra context-*, index.html không chứa chuỗi context-stroke/context-fill; p_* không dùng marker; mũi tên không nằm trong defs/marker/symbol, không mồ côi (data-for trỏ tới p_* có thật); không id trùng trong tài liệu.
# Khối đích suy bằng hình học (khối có khoảng cách có dấu nhỏ nhất tới đầu mũi cuối), không dùng bảng cố định: đường p_* thêm sau này tự được kiểm.
# Áp dụng khi index.html có mũi tên [data-part=ah] hoặc repo có docs/screenshots/T-039/; trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/dashboard/model/inv-031-khong-ky-thuat-de-vo.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/t039_inv.cjs" --repo "$REPO" --check no-fragile
