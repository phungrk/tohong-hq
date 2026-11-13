#!/usr/bin/env bash
# T-152: bọc check_2_hieu_luc_tab_vendor_va_chat.mjs. Chạy từ gốc tohong-hq: bash eval/T-152/check_2_hieu_luc_tab_vendor_va_chat.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_BACK_REPO:-$HQ/../tohong-back}"
exec node "$HQ/eval/T-152/check_2_hieu_luc_tab_vendor_va_chat.mjs"
