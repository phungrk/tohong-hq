#!/usr/bin/env bash
# Nguồn: T-188 (spec products/T-188-mo-admin-khong-dang-nhap.md v2, đề xuất INV-C; spec-critic xác nhận khi spec qua Spec Gate).
# Bất biến: ADMIN_OPEN=1 không đổi mã + thân của bất kỳ route nào ngoài /api/admin/* (couples, vendors, claim, internal, đường lạ, /api/administrator, /api/adminx/me, /api/admin-members), không ghi thêm R2, không mở dữ liệu cặp đôi cho người ngoài.
# Tự chứa: worker thật + R2 giả của tohong-back (mạng bị chặn, không ghi vào repo). Repo back lấy từ TOHONG_BACK_REPO (mặc định /home/user/tohong-back).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/admin_open_back.mjs" --repo "${TOHONG_BACK_REPO:-/home/user/tohong-back}" --case C
