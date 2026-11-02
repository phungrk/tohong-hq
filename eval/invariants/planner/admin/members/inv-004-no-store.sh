#!/usr/bin/env bash
# Nguồn: T-043 (spec products/T-043-danh-sach-thanh-vien.md v2, qua Spec Gate 2026-11-02, spec-critic).
# Bất biến: phản hồi 200 của mọi route /api/admin/members-* (và 405 của members-list) có Cache-Control: no-store, không public/max-age/s-maxage.
# Đo bằng lib/members_inv.test.mjs, test "INV-004 ". Chạy được từ cwd bất kỳ; repo back lấy từ TOHONG_BACK_REPO (mặc định /home/user/tohong-back).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "${TOHONG_BACK_REPO:-/home/user/tohong-back}" || exit 2
exec node --test --test-name-pattern='INV-004 ' "$HERE/lib/members_inv.test.mjs"
