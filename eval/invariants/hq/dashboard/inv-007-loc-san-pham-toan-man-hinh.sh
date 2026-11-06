#!/usr/bin/env bash
# Nguồn: T-076 (spec products/T-076-modal-viec-cho-capu.md v5, qua Spec Gate 2026-11-06, spec-critic; INV-P5 của Product), rút từ T-041 tiêu chí 1 và decisions/2026-11-02-t041-pham-vi-loc-san-pham.md mục 1, 3.
# Bất biến: chọn sản phẩm P thì mọi con số, chữ phụ, đèn và danh sách việc trên màn hình (bảng việc, KPI, Cảnh báo, Dòng thời gian, Feed, khối mô hình KỂ CẢ khối Capu) giống hệt dashboard chỉ có việc và sự kiện của P; việc không sản phẩm chỉ ở Tất cả; quay về Tất cả không cần tải lại. Đúng cả khi dữ liệu có `capu_queue` (dashboard.json giữ nguyên hàng chờ, lọc là việc của trang): khối Capu không có ngoại lệ khỏi bộ chọn.
# Áp dụng từ khi T-041 vào (trang có select#product-filter); trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/inv-007-loc-san-pham-toan-man-hinh.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
# Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/loc_toan_man_hinh_inv.cjs" --repo "$REPO"
