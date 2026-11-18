#!/usr/bin/env bash
# T-213 adv-01 (đối kháng): test lọc Status sau khi sửa vẫn RÀNG BUỘC số đếm với dữ liệu, không bị nới.
# Trên dữ liệu tohong 9c341703 (regen.sh của T-212): bản không đột biến phải xanh; mỗi đột biến sai của API
# trong lib/vendorEnrich.js (statusOk) phải làm test/test_vendor_enrich.js ĐỎ. Đột biến chỉ trong bản sao tạm.
#  M1 loại hàng override khỏi ô nhóm (cách "sửa" sai hướng)   M2 không cho hàng chờ review rời nhóm
#  M3 lệch một hàng: ẩn đúng một hàng name_similar bất kỳ     M4 nhét thêm hàng override nhóm khác vào name_similar
# Bắt được việc xoá / hardcode assertion dòng 277 mà check_1 của T-212 không bắt. Mã thoát 2 = thiếu điều kiện.
H="$(cd "$(dirname "$0")" && pwd)"; HQ="$H"
while [ "$HQ" != "/" ] && [ ! -f "$HQ/scripts/gate.py" ]; do HQ="$(dirname "$HQ")"; done
OUT="$(bash "$HQ/eval/T-212/lib/regen.sh")" || { echo "$OUT"; exit 2; }
S="$(echo "$OUT" | sed -n 's/^SCRATCH=//p' | tail -1)"; ROOT="$(dirname "$S")"
case "$S" in "${TMPDIR:-/tmp}"/tmp.*/back) [ -d "$S" ] || { echo "FAIL regen.sh không trả bản sao"; exit 2; } ;; *) echo "FAIL SCRATCH lạ: $S"; exit 2 ;; esac
trap 'rm -rf "$ROOT"' EXIT
F="$S/lib/vendorEnrich.js"; T="test/test_vendor_enrich.js"
ORIG='return !pend && r.group === status;'
grep -qF "$ORIG" "$F" || { echo "FAIL không thấy dòng statusOk gốc để đột biến"; exit 2; }
cp "$F" "$F.orig"
run() { ( cd "$S" && node --test "$T" >/dev/null 2>&1 ); }
run || { echo "FAIL bản không đột biến đỏ trên dữ liệu 9c341703"; exit 1; }
VICTIM="$(cd "$S" && node -e 'const R=require("./lib/vendorEnrichReport.generated.js");const v=(R.VENDOR_ENRICH_REPORT||R).vendors||[];const x=v.filter(r=>r.group==="name_similar");process.stdout.write(x.length?x[x.length-1].id:"")' 2>/dev/null)"
[ -n "$VICTIM" ] || { echo "FAIL không đọc được hàng name_similar từ báo cáo"; exit 2; }
declare -A M=(
  [M1]='return !pend \&\& r.group === status \&\& !r.override;'
  [M2]='return r.group === status;'
  [M3]="return !pend \\&\\& r.group === status \\&\\& !(status === \"name_similar\" \\&\\& r.id === \"$VICTIM\");"
  [M4]='return !pend \&\& (r.group === status || (status === "name_similar" \&\& !!r.override));'
)
bad=""
for k in M1 M2 M3 M4; do
  cp "$F.orig" "$F"; sed -i "s#return !pend && r.group === status;#${M[$k]}#" "$F"
  grep -qF "$ORIG" "$F" && { echo "FAIL đột biến $k không áp được"; exit 2; }
  run && bad="$bad $k"
done
cp "$F.orig" "$F"
[ -z "$bad" ] && { echo "PASS test lọc Status đỏ với cả 4 đột biến API (M1..M4), xanh khi không đột biến"; exit 0; }
echo "FAIL test vẫn xanh khi API sai:$bad (assertion lọc Status bị nới hoặc mất)"; exit 1
