#!/usr/bin/env bash
# Chạy từ gốc tohong-hq: bash eval/T-161/adv-01-cau-ai-khong-sinh-lai-khi-mo-xen-hang-muc.sh · Biến: TOHONG_BACK_REPO.
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/adv-01-cau-ai-khong-sinh-lai-khi-mo-xen-hang-muc.mjs" "$@"
