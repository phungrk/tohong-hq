#!/usr/bin/env bash
# Eval tiêu chí 9 của T-054: chạy TOÀN BỘ bất biến layout, navigation, budget của planner/front và _shared trên repo front.
# gate.py (area planner/front/layout) chỉ chạy đúng thư mục layout + cha; script này lặp thêm navigation và budget.
#   cd /home/user/tohong-hq && bash eval/T-054/run_invariants.sh <thư-mục-tohong-front>
# In từng bất biến ok/XX; dòng cuối PASS hoặc FAIL <danh sách>; mã thoát 0/1. Bất biến bị ADR thay thế (nếu có) vẫn chạy bản gốc ở đây: đỏ thì phải có ADR đi kèm (xem spec mục "Bất biến bị thay").
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-}"
if [ -z "$FRONT" ] || [ ! -f "$FRONT/package.json" ]; then echo "FAIL cần đường dẫn tohong-front làm tham số đầu tiên"; exit 1; fi
FRONT="$(cd "$FRONT" && pwd)"
TMPF="$(mktemp)"; bad=""; n=0
for f in "$HERE"/../invariants/_shared/inv-*.sh "$HERE"/../invariants/planner/front/layout/inv-*.sh "$HERE"/../invariants/planner/front/navigation/inv-*.sh "$HERE"/../invariants/planner/front/budget/inv-*.sh; do
  [ -f "$f" ] || continue
  n=$((n+1)); name="$(basename "$(dirname "$f")")/$(basename "$f" .sh)"
  if (cd "$FRONT" && TOHONG_FRONT_REPO="$FRONT" bash "$f") >"$TMPF" 2>&1; then echo "  ok $name"; else echo "  XX $name :: $(tail -1 "$TMPF" | cut -c1-200)"; bad="$bad $name"; fi
done
rm -f "$TMPF"
if [ "$n" -eq 0 ]; then echo "FAIL không tìm thấy bất biến nào"; exit 1; fi
if [ -n "$bad" ]; then echo "FAIL bất biến đỏ:$bad"; exit 1; fi
echo PASS
