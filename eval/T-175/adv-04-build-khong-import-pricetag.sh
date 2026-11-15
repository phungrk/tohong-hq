#!/usr/bin/env bash
# T-175 adv-04 (Code Gate, tầng 3): xoá src/ui/PriceTag.jsx không để lại import gãy (kể cả admin, test, lazy import) và bản build production vẫn dựng được.
# Mong đợi: không file nào trong src/ còn tham chiếu "ui/PriceTag"; `vite build` (outDir tạm) thoát 0.
# Chạy từ gốc tohong-hq: bash eval/T-175/adv-04-build-khong-import-pricetag.sh · Biến: TOHONG_FRONT_REPO (mặc định ../tohong-front)
set -u
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
FRONT="${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
[ -f "$FRONT/package.json" ] || { echo "FAIL không thấy repo tohong-front (đặt TOHONG_FRONT_REPO)"; exit 2; }
if [ ! -f "$FRONT/src/ui/PriceTag.jsx" ]; then
  hit="$(grep -rnE "ui/PriceTag(\.jsx)?['\"]" "$FRONT/src" 2>/dev/null | head -1)"
  [ -n "$hit" ] && { echo "FAIL còn import PriceTag đã xoá: ${hit#$FRONT/}"; exit 1; }
fi
out="$(mktemp -d)"; trap 'rm -rf "$out"' EXIT
if (cd "$FRONT" && npx --no-install vite build --outDir "$out" --emptyOutDir --logLevel error >"$out.log" 2>&1); then rm -f "$out.log"; echo PASS; exit 0; fi
echo "FAIL vite build lỗi: $(grep -iE 'error|could not|failed' "$out.log" | head -1 | cut -c1-200)"; rm -f "$out.log"; exit 1
