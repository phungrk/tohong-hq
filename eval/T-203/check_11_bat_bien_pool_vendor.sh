#!/usr/bin/env bash
# T-203 tiêu chí 11: thay đổi này (sửa isHidden / chatMatcher / vendorMatcher / getEnrichDetail) không phá bất biến của pool vendor.
# Code Gate chỉ chạy bất biến của vùng planner/admin và cấp cha, KHÔNG chạy planner/vendor/** hay planner/admin/vendor-enrich/**; tệp này gọi chúng ở tầng 1.
# Chỉ gọi nguyên tệp trong bể (không sao chép, không sửa): in PASS khi cả sáu đều PASS, FAIL <tên> nếu có tệp đỏ. Chạy từ gốc tohong-hq.
set -uo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
INV="$HQ/eval/invariants/planner"
FILES=(
  "vendor/images/inv-022-pool-khong-vendor-da-go.py"
  "vendor/images/inv-037-chat-khong-goi-mang-van-co-ung-vien.py"
  "vendor/images/inv-038-ung-vien-chat-dung-pool-overlay.py"
  "vendor/images/inv-040-duong-ghep-chat-khong-nem.py"
  "admin/vendor-enrich/inv-009-ban-sua-pool-khong-pha-hop-dong-anh-gu.py"
  "admin/vendor-enrich/inv-010-drawer-doc-la-admin-ghi-ky-la-capu.py"
)
bad=()
for f in "${FILES[@]}"; do
  if [ ! -f "$INV/$f" ]; then bad+=("$f (thiếu tệp)"); continue; fi
  out="$(python3 -I "$INV/$f" 2>&1)"; rc=$?
  echo "  $([ $rc -eq 0 ] && echo ok || echo XX) $f :: $(echo "$out" | tail -n1 | cut -c1-160)"
  [ $rc -eq 0 ] || bad+=("$f")
done
if [ ${#bad[@]} -gt 0 ]; then echo "FAIL ${bad[0]}$([ ${#bad[@]} -gt 1 ] && echo " (+$(( ${#bad[@]} - 1 )) tệp nữa)")"; exit 1; fi
echo PASS
