#!/usr/bin/env bash
# Nguồn: T-027 (spec products/T-027-back-va-cai-app.md v2, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: mỗi tab/trang con có đúng một địa chỉ hash theo bảng; địa chỉ chỉ khớp mẫu cho phép (không dữ liệu cá nhân); tải lại và link sâu vào đúng màn; hash lạ/id không có thì thay (không thêm bước).
# Đo bằng lib/nav_check.cjs (bản chụp cố định của eval/T-027/check_t027.cjs) --only 4 --inv. 
# Chạy: bash eval/invariants/planner/front/navigation/inv-004-hash-dung-man.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/nav_check.cjs" --repo "$REPO" --only 4 --inv
