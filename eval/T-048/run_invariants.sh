#!/usr/bin/env bash
# Eval tiêu chí 8 của T-048: chạy TOÀN BỘ bất biến layout và navigation của vùng planner/front trên repo front.
# gate.py chỉ đọc đúng thư mục của area (planner/front/budget) nên không tự chạy hai nhóm này; script này lặp qua các file inv-*.sh.
#   cd /home/user/tohong-hq && bash eval/T-048/run_invariants.sh <thư-mục-tohong-front>
# In từng bất biến PASS/FAIL, dòng cuối PASS hoặc FAIL <danh sách>; mã thoát 0/1.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-}"
if [ -z "$FRONT" ] || [ ! -f "$FRONT/package.json" ]; then echo "FAIL cần đường dẫn tohong-front làm tham số đầu tiên"; exit 1; fi
FRONT="$(cd "$FRONT" && pwd)"
TMPF="$(mktemp)"; bad=""; n=0
for f in "$HERE"/../invariants/planner/front/layout/inv-*.sh "$HERE"/../invariants/planner/front/navigation/inv-*.sh; do
  [ -f "$f" ] || continue
  n=$((n+1)); name="$(basename "$(dirname "$f")")/$(basename "$f" .sh)"
  if (cd "$FRONT" && TOHONG_FRONT_REPO="$FRONT" bash "$f") >"$TMPF" 2>&1; then echo "  ok $name"; else echo "  XX $name :: $(tail -1 "$TMPF" | cut -c1-200)"; bad="$bad $name"; fi
done
rm -f "$TMPF"
if [ "$n" -eq 0 ]; then echo "FAIL không tìm thấy bất biến nào"; exit 1; fi
if [ -n "$bad" ]; then echo "FAIL bất biến đỏ:$bad"; exit 1; fi
echo PASS
