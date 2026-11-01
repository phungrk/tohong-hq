#!/usr/bin/env bash
# Eval T-027 tiêu chí 7 (phần bất biến): mọi bất biến vùng front/layout vẫn đạt sau thay đổi này.
# Chạy: bash eval/T-027/check_7_inv.sh <đường dẫn repo tohong-front>   (mặc định: thư mục hiện tại)
# In PASS hoặc FAIL <bất biến đầu tiên đỏ>; mã thoát 0/1. Chạy từng bất biến một, dùng đúng file trong bể (không bản sao).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "${1:-$PWD}" && pwd)"
INV="$HERE/../invariants/front/layout"
fails=()
for f in "$INV"/inv-*.sh; do
  out="$(TOHONG_FRONT_REPO="$REPO" bash "$f" 2>&1 | tail -1)"
  if [ "$out" != "PASS" ]; then fails+=("$(basename "$f"): $out"); fi
done
if [ ${#fails[@]} -gt 0 ]; then echo "FAIL ${fails[0]} (+$((${#fails[@]}-1)) bất biến nữa)"; exit 1; fi
echo PASS
