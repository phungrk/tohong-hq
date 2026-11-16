#!/usr/bin/env bash
# Nguồn: T-188 (spec products/T-188-mo-admin-khong-dang-nhap.md v2, đề xuất INV-A; spec-critic xác nhận khi spec qua Spec Gate).
# Bất biến: khi ADMIN_OPEN khác đúng chuỗi "1" (thiếu, rỗng, 0, true, yes, on, " 1", "1 ", 01...), mọi /api/admin/* của người không trong ADMIN_USER_IDS nhận 403 {"error":"forbidden"}, giống hệt từng byte cờ thiếu, không ghi R2; admin thật vẫn là chính họ.
# Tự chứa: worker thật + R2 giả của tohong-back (mạng bị chặn, không ghi vào repo). Repo back lấy từ TOHONG_BACK_REPO (mặc định /home/user/tohong-back).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/admin_open_back.mjs" --repo "${TOHONG_BACK_REPO:-/home/user/tohong-back}" --case A
