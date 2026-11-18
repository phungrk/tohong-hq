#!/usr/bin/env bash
# T-212 tiêu chí 1: sinh lại dữ liệu từ commit tohong 9c341703 (như sync-vendor-pool.yml) thì `npm test` của back XANH.
# Đỏ hiện tại: test/test_vendor_enrich.js:266 (expected 220, actual 222). Chạy: bash eval/T-212/check_1_npm_test_xanh_tren_du_lieu_moi.sh
H="$(cd "$(dirname "$0")" && pwd)"
OUT="$(bash "$H/lib/regen.sh")" || { echo "$OUT"; exit 2; }
S="$(echo "$OUT" | sed -n 's/^SCRATCH=//p' | tail -1)"
cd "$S" && R="$(npm test 2>&1)"; rc=$?
if [ $rc -eq 0 ]; then echo PASS; exit 0; fi
echo "FAIL npm test đỏ trên dữ liệu mới: $(echo "$R" | grep -E '^not ok|expected:|actual:|^# fail' | head -6 | tr '\n' ' ')"; exit 1
