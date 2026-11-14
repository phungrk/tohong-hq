#!/usr/bin/env bash
# T-159 tiêu chí 8: inv-037..041 vẫn xanh, và khi KHÔNG có bảng dự toán thì chat + tab Vendor y nguyên main trước T-159
# (T-140 check 7: computeMatches tab; T-143 adv-01: 160 ca HTTP tab Vendor, hồ sơ không có budget.json).
# Chạy từ gốc tohong-hq: bash eval/T-159/check_8_inv_con_xanh_va_khong_bang_nhu_cu.sh   · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; HQ="$(cd "$HERE/../.." && pwd)"; IMG="$HQ/eval/invariants/planner/vendor/images"
fails=()
run() { out="$("$@" 2>&1 | tail -1)"; case "$out" in PASS*) ;; *) fails+=("$(basename "${*: -1}"): ${out:0:160}");; esac; }
for f in "$IMG"/inv-037-*.py "$IMG"/inv-038-*.py "$IMG"/inv-039-*.py "$IMG"/inv-040-*.py "$IMG"/inv-041-*.py; do run python3 -I "$f"; done
run node "$HQ/eval/T-140/check_7_tab_vendor_khong_doi.mjs"
run bash "$HQ/eval/T-143/adv-01-tab-http-khong-doi.sh"
if [ ${#fails[@]} -gt 0 ]; then echo "FAIL ${fails[*]}"; exit 1; fi
echo PASS
