#!/usr/bin/env bash
# T-188 tiêu chí 1: cờ bật, mọi route đọc /api/admin/* chạy không token; /me trả danh tính cố định.
# Chạy từ gốc tohong-hq: bash eval/T-188/check_1_co_bat_doc_khong_token.sh. Repo back lấy từ TOHONG_BACK_REPO (mặc định /home/user/tohong-back).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/check_back.mjs" --repo "${TOHONG_BACK_REPO:-$HERE/../../../tohong-back}" --case 1
