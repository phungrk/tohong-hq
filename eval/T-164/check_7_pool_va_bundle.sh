#!/usr/bin/env bash
# T-164 tiêu chí 7. Chạy từ gốc tohong-hq: bash eval/T-164/check_7_pool_va_bundle.sh  · Biến: TOHONG_BACK_REPO.
set -u
exec python3 -I "$(cd "$(dirname "$0")" && pwd)/check_7_pool_va_bundle.py" "$@"
