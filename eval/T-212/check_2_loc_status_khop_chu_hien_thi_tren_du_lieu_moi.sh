#!/usr/bin/env bash
# T-212 tiêu chí 2: trên dữ liệu sinh lại từ commit 9c341703, bộ lọc Status khớp chữ cột Status với MỌI hàng và mọi khoá
# (chính là INV-015 vendor-enrich, chạy trên bản sao tạm). Hiện GREEN: hành vi sản phẩm đúng; eval này giữ cho đúng mãi.
H="$(cd "$(dirname "$0")" && pwd)"; HQ="$H"; while [ "$HQ" != "/" ] && [ ! -f "$HQ/scripts/gate.py" ]; do HQ="$(dirname "$HQ")"; done
OUT="$(bash "$H/lib/regen.sh")" || { echo "$OUT"; exit 2; }
S="$(echo "$OUT" | sed -n 's/^SCRATCH=//p' | tail -1)"
R="$(TOHONG_BACK_REPO="$S" node "$HQ"/eval/invariants/planner/admin/vendor-enrich/inv-015-*.mjs 2>&1)"; rc=$?
[ $rc -eq 0 ] && { echo PASS; exit 0; }
echo "FAIL INV-015 đỏ trên dữ liệu mới: $(echo "$R" | grep -v '^  ok' | head -5 | tr '\n' ' ')"; exit 1
