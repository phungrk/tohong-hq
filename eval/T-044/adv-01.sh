#!/usr/bin/env bash
# Eval đối kháng T-044 (adversary, 2026-11-02), phần back: ADV-01..06 trong lib/adv_back.test.mjs.
# members.json phần tử lạ; thân yêu cầu biên; Clerk dị dạng; request đồng thời; tên chứa HTML/email; user_id ký tự đặc biệt.
# Chạy được từ cwd bất kỳ; repo back lấy từ TOHONG_BACK_REPO (mặc định /home/user/tohong-back).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "${TOHONG_BACK_REPO:-/home/user/tohong-back}" || exit 2
exec node --test --test-name-pattern='ADV-0' "$HERE/lib/adv_back.test.mjs"
