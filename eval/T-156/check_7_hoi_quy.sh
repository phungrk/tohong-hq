#!/usr/bin/env bash
# T-156 tiêu chí 7 (hồi quy, tohong-front): thêm ghi công không làm hỏng ảnh vendor, nhãn giá (T-164/T-165, PR #74) và bố cục ngăn kéo (T-152/T-157).
# Chạy từ gốc tohong-hq: bash eval/T-156/check_7_hoi_quy.sh · Biến: TOHONG_FRONT_REPO, PLAYWRIGHT_PATH. Mọi bước phải PASS/xanh.
set -u
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
FRONT="${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
[ -f "$FRONT/package.json" ] || { echo "FAIL không thấy repo tohong-front (đặt TOHONG_FRONT_REPO)"; exit 2; }
( cd "$FRONT" && npm run -s test:vendor-images >/dev/null 2>&1 ) || { echo "FAIL npm run test:vendor-images đỏ"; exit 1; }
( cd "$FRONT" && npm run -s test:price-text >/dev/null 2>&1 ) || { echo "FAIL npm run test:price-text đỏ"; exit 1; }
r="$(bash "$HQ/eval/T-164/check_5_nhan_front.sh" 2>&1 | tail -1)"; [ "$r" = "PASS" ] || { echo "FAIL nhãn giá (eval T-164 tiêu chí 5) đỏ: $r"; exit 1; }
r="$(bash "$HQ/eval/T-152/check_6_drawer_phu_khong_doi_layout.sh" 2>&1 | tail -1)"; [ "$r" = "PASS" ] || { echo "FAIL bố cục ngăn kéo (eval T-152 tiêu chí 6) đỏ: $r"; exit 1; }
echo PASS; exit 0
