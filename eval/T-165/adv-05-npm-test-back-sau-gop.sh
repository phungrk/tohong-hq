#!/usr/bin/env bash
# T-165 adv-05 (Code Gate, tầng 3). Tiêu chí 1 của T-165: "npm test/build xanh". Input phá: trạng thái main SAU KHI gộp cả hai PR back
# (#58 code + #59 pool đóng dấu giá). Mỗi PR riêng lẻ xanh, nhưng pool có priceSource làm POST /api/vendors/status thêm price_basis/price_as_of/price_label
# (đúng spec H4), và test cũ test/test_admin.js (T036, so khớp nguyên hình dạng status) đỏ. Mong đợi: npm test của tohong-back xanh ở trạng thái gộp.
# Chạy từ gốc tohong-hq; TOHONG_BACK_REPO trỏ tới bản back đã gộp (#58 + #59). Không mạng, không ghi vào repo ngoài thư mục tạm.
set -u
BACK="${TOHONG_BACK_REPO:-$(cd "$(dirname "$0")/../../.." && pwd)/tohong-back}"
[ -f "$BACK/package.json" ] || { echo "FAIL không thấy tohong-back ($BACK)"; exit 2; }
grep -q '"priceSource"' "$BACK/lib/vendorPool.generated.js" || echo "lưu ý: pool chưa có priceSource (chưa gộp #59), ca chính không được thử"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
( cd "$BACK" && tar --exclude=.git --exclude=node_modules -cf - . ) | ( cd "$TMP" && tar -xf - )
ln -s "$(readlink -f "$BACK/node_modules")" "$TMP/node_modules"
OUT=$(cd "$TMP" && timeout 900 npm test 2>&1); RC=$?
FAILN=$(printf '%s\n' "$OUT" | grep -E '^# fail ' | tail -1 | awk '{print $3}')
if [ "$RC" -ne 0 ] || [ "${FAILN:-0}" != "0" ]; then
  echo "FAIL npm test tohong-back đỏ (${FAILN:-?} test): $(printf '%s\n' "$OUT" | grep -E '^not ok' | head -3 | tr '\n' ' ')"
  exit 1
fi
echo "PASS npm test tohong-back xanh ($(printf '%s\n' "$OUT" | grep -E '^# pass ' | tail -1))"
