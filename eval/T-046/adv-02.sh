#!/usr/bin/env bash
# adv-02 (T-046, tầng 3, adversary): không làm tròn giá trung gian (mục 1 spec T-045). Giá 3-4 chữ số thập phân:
# khoảng 3.000-3.025 x 39 bàn = 117,4875 -> 117; 4.1666 x 3 bàn = 12,4998 -> 12. Đối chứng 4.1 x 15 -> 62.
# Chạy: bash eval/T-046/adv-02.sh [tohong-front]   (gate.py chạy với cwd = repo front)
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-$PWD}"
cd "$FRONT" && exec node "$HERE/_adv02.cjs" "$FRONT"
