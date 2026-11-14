#!/usr/bin/env bash
# T-164 tiêu chí 5 (front): hai phần, cả hai phải PASS. Chạy từ gốc tohong-hq: bash eval/T-164/check_5_nhan_front.sh  · Biến: TOHONG_FRONT_REPO (mặc định ../tohong-front), PLAYWRIGHT_PATH nếu cần.
set -u
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
FRONT="${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
[ -f "$FRONT/package.json" ] || { echo "FAIL không thấy repo tohong-front (đặt TOHONG_FRONT_REPO)"; exit 2; }
a="$(node "$HQ/eval/T-164/check_5a_nhan_app_cap_doi.cjs" --repo "$FRONT" 2>&1 | tail -3)"; ra=$?
b="$(node "$HQ/eval/T-164/check_5b_nhan_admin.cjs" --repo "$FRONT" 2>&1 | tail -3)"; rb=$?
if [ -z "$(echo "$a$b" | grep '^FAIL')" ] && { echo "FAIL eval front không chạy được: $(echo "$a $b" | tr '\n' ' ' | cut -c1-200)"; exit 1; }
echo "$a" | grep -q '^PASS' && echo "$b" | grep -q '^PASS'; then echo PASS; exit 0; fi
echo "$a" | grep '^FAIL' | sed 's/^FAIL /FAIL [app cặp đôi] /' | head -1
echo "$b" | grep '^FAIL' | sed 's/^FAIL /FAIL [admin] /' | head -1
exit 1
