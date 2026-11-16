#!/usr/bin/env bash
# Nguồn: T-188 (spec products/T-188-mo-admin-khong-dang-nhap.md v2, đề xuất INV-B; spec-critic xác nhận khi spec qua Spec Gate).
# Bất biến: danh tính cố định "admin-khong-dang-nhap" không bao giờ là Capu và không bao giờ có mục trong export ký (/api/internal/vendor-enrich/export), dù cờ bật hay tắt, dù chuỗi đó nằm trong ADMIN_USER_IDS/CAPU_USER_IDS; Capu thật vẫn ký được khi cờ tắt.
# Tự chứa: worker thật + R2 giả của tohong-back (mạng bị chặn, không ghi vào repo). Repo back lấy từ TOHONG_BACK_REPO (mặc định /home/user/tohong-back).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/admin_open_back.mjs" --repo "${TOHONG_BACK_REPO:-/home/user/tohong-back}" --case B
