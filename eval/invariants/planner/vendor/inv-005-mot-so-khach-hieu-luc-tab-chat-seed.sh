#!/usr/bin/env bash
# INV-005 (ADR-094): khi không có bảng dự toán, số khách tab Vendor, chat và hash câu AI dùng bằng guests GET /budget seed; bảng có guests nguyên > 0 thì thắng cả ba nơi; seed 0 = không có số khách.
# Biến: TOHONG_BACK_REPO.
set -u
H="$(cd "$(dirname "$0")" && pwd)"
# ADR-108: chạy bản thay của T-178 (chip theo bàn bỏ " = {tổng}tr" trước khi so); bản cũ inv-005a/b giữ trong thư mục, không chạy.
HQ="$H"; while [ "$HQ" != "/" ] && [ ! -f "$HQ/scripts/gate.py" ]; do HQ="$(dirname "$HQ")"; done
node "$HQ/eval/T-183/thay-the/inv-005a.mjs" "$@" || exit 1
exec node "$HQ/eval/T-178/thay-the/inv-005b.mjs" "$@"
