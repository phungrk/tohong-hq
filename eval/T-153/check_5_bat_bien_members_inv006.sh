#!/usr/bin/env bash
# T-153 tiêu chí 5: bất biến INV-006 của vùng planner/admin/members phải còn xanh khi tab mặc định đổi (ADR-086). Vùng của việc là vendor-enrich nên gate không tự chạy; chạy ở đây.
set -euo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
export TOHONG_FRONT_REPO="${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
exec bash "$HQ"/eval/invariants/planner/admin/members/inv-006-*.sh
