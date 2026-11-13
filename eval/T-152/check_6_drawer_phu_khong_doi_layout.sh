#!/usr/bin/env bash
# T-152: bọc check_6_drawer_phu_khong_doi_layout.cjs. Chạy từ gốc tohong-hq: bash eval/T-152/check_6_drawer_phu_khong_doi_layout.sh
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
exec node "$HQ/eval/T-152/check_6_drawer_phu_khong_doi_layout.cjs" --repo .
