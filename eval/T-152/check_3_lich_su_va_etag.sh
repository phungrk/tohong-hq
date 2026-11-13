#!/usr/bin/env bash
# T-152: bọc check_3_lich_su_va_etag.mjs. Chạy từ gốc tohong-hq: bash eval/T-152/check_3_lich_su_va_etag.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_BACK_REPO:-$HQ/../tohong-back}"
exec node "$HQ/eval/T-152/check_3_lich_su_va_etag.mjs"
