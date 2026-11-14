#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-159/check_1_chat_dung_allocated.sh  · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/check_1_chat_dung_allocated.mjs" "$@"
