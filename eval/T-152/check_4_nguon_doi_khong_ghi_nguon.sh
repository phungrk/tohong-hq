#!/usr/bin/env bash
# T-152: bọc check_4_nguon_doi_khong_ghi_nguon.mjs. Chạy từ gốc tohong-hq: bash eval/T-152/check_4_nguon_doi_khong_ghi_nguon.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_BACK_REPO:-$HQ/../tohong-back}"
exec node "$HQ/eval/T-152/check_4_nguon_doi_khong_ghi_nguon.mjs"
