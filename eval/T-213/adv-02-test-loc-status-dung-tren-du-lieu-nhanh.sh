#!/usr/bin/env bash
# T-213 adv-02 (đối kháng): số đếm của test lọc Status phải TÍNH từ dữ liệu, không hardcode.
# Chạy trên dữ liệu đang commit trong nhánh của TOHONG_BACK_REPO (không sinh lại): bản gốc phải xanh, và đột biến
# "ẩn đúng một hàng name_similar khi lọc name_similar" phải làm test ĐỎ. Cùng adv-01 (dữ liệu 9c341703), số cứng
# kiểu 222 không thể xanh ở cả hai bộ dữ liệu. Chỉ chạy trong bản sao tạm. Mã thoát 2 = thiếu điều kiện.
H="$(cd "$(dirname "$0")" && pwd)"; HQ="$H"
while [ "$HQ" != "/" ] && [ ! -f "$HQ/scripts/gate.py" ]; do HQ="$(dirname "$HQ")"; done
BACK="${TOHONG_BACK_REPO:-$HQ/../tohong-back}"
[ -f "$BACK/worker.js" ] || { echo "FAIL không thấy tohong-back (đặt TOHONG_BACK_REPO)"; exit 2; }
S="$(mktemp -d)"; trap 'rm -rf "$S"' EXIT
( cd "$BACK" && tar --exclude=./.git --exclude=./node_modules -cf - . ) | tar -xf - -C "$S"
ln -s "$(cd "$BACK" && pwd)/node_modules" "$S/node_modules"
F="$S/lib/vendorEnrich.js"; T="test/test_vendor_enrich.js"; ORIG='return !pend && r.group === status;'
grep -qF "$ORIG" "$F" || { echo "FAIL không thấy dòng statusOk gốc để đột biến"; exit 2; }
run() { ( cd "$S" && node --test "$T" >/dev/null 2>&1 ); }
run || { echo "FAIL test_vendor_enrich đỏ trên dữ liệu của nhánh (số kỳ vọng không tính từ dữ liệu?)"; exit 1; }
V="$(cd "$S" && node -e 'const R=require("./lib/vendorEnrichReport.generated.js");const v=(R.VENDOR_ENRICH_REPORT||R).vendors||[];const x=v.filter(r=>r.group==="name_similar");process.stdout.write(x.length?x[x.length-1].id:"")' 2>/dev/null)"
[ -n "$V" ] || { echo "FAIL không đọc được hàng name_similar từ báo cáo"; exit 2; }
sed -i "s#return !pend && r.group === status;#return !pend \&\& r.group === status \&\& !(status === \"name_similar\" \&\& r.id === \"$V\");#" "$F"
grep -qF "$ORIG" "$F" && { echo "FAIL đột biến không áp được"; exit 2; }
run && { echo "FAIL test vẫn xanh khi API ẩn một hàng name_similar ($V)"; exit 1; }
echo "PASS xanh trên dữ liệu nhánh, đỏ khi API lệch một hàng"; exit 0
