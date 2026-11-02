#!/usr/bin/env bash
# adv-01 (T-046, tầng 3, adversary): làm tròn 0,5 lên ở bước cuối (mục 1 spec T-045) với tiền chi rơi đúng x,5 triệu.
# 150 khách x 4.1tr/bàn = 61,5 -> 62tr; 250 khách x 2.3tr/bàn = 57,5 -> 58tr. Đối chứng 205 x 3.9 -> 82tr.
# Chạy: bash eval/T-046/adv-01.sh [tohong-front]   (gate.py chạy với cwd = repo front)
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-$PWD}"
cd "$FRONT" && exec node "$HERE/_adv01.cjs" "$FRONT"
