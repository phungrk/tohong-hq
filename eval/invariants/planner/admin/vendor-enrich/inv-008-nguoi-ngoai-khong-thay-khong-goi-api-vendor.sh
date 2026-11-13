#!/usr/bin/env bash
# Nguồn: T-153 (spec products/T-153-admin-mo-thang-bang-enrich.md v2, Hành vi 4; qua Spec Gate 2026-11-13, spec-critic).
# Bất biến: người không phải admin (GET /api/admin/me trả 403) vào ?admin chỉ thấy "Bạn không có quyền xem trang này":
#           không có thanh tab "Các mục admin", không có "Bảng enrich vendor", và trình duyệt không gửi request nào tới /api/admin/vendor-enrich* hay /api/admin/vendors*.
#           Đúng mãi bất kể tab mặc định hay chế độ xem mặc định của admin là gì.
# Đo bằng lib/t153_admin_tab.cjs (bản chụp cố định của eval/T-153/check_ui_admin_tab.cjs) --case 4: build front, giả API, Playwright; không đọc mã nguồn.
# Repo front từ TOHONG_FRONT_REPO (mặc định /home/user/tohong-front). Thoát 0 = đạt, 1 = vi phạm, 2 = không chạy được.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
cd "$REPO"
exec node "$HERE/lib/t153_admin_tab.cjs" --repo . --case 4
