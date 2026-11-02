#!/usr/bin/env bash
# Nguồn: T-043 (spec products/T-043-danh-sach-thanh-vien.md v2, qua Spec Gate 2026-11-02, spec-critic).
# Bất biến: mọi route /api/admin/members-* trả cho admin không có số điện thoại, trường điện thoại, mã người dùng, mã cặp đôi, mã Clerk hay email cũ trong members.json.
# Đo bằng lib/members_inv.test.mjs, test "INV-001 ". Chạy được từ cwd bất kỳ; repo back lấy từ TOHONG_BACK_REPO (mặc định /home/user/tohong-back).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "${TOHONG_BACK_REPO:-/home/user/tohong-back}" || exit 2
exec node --test --test-name-pattern='INV-001 ' "$HERE/lib/members_inv.test.mjs"
