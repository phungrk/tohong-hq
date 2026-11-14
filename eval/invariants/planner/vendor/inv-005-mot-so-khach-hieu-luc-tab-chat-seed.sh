#!/usr/bin/env bash
# INV-005 (ADR-094): khi không có bảng dự toán, số khách tab Vendor, chat và hash câu AI dùng bằng guests GET /budget seed; bảng có guests nguyên > 0 thì thắng cả ba nơi; seed 0 = không có số khách.
# Biến: TOHONG_BACK_REPO.
set -u
H="$(cd "$(dirname "$0")" && pwd)"
node "$H/inv-005a-so-khach-ho-so-mot-so.mjs" "$@" || exit 1
exec node "$H/inv-005b-so-khach-ho-so-khop-seed.mjs" "$@"
