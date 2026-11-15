#!/usr/bin/env bash
# Nguồn: T-173 (cài spec T-169 v3, H3.4/H3.5/H4), adversary rút khi accept 2026-11-15 từ eval đối kháng adv-01, adv-02, adv-07 (đều đỏ trên d3b61dc/1ebab91, xanh trên c74c8c6).
# Nằm ở eval/T-173/bat-bien-cho-merge/ (gác tới khi PR back#61 merge); Chief of Staff đưa vào eval/invariants/planner/profile/ cùng INV-A/INV-B sau merge.
# INV · RÁC KHÔNG XOÁ GIÁ TRỊ ĐÃ LƯU. Một lần ghi số khách / ngân sách / ngày cưới / phong cách (chat update_profile hoặc PATCH /api/couples/:id) mang giá trị KHÁC rỗng
#   mà không đọc được chắc chắn ("khoảng 300", "500 triệu", "300tr", object, "29/12/2027", "cuối năm sau", "1.500", "1,200", "12,5", 0.5, [" "]) KHÔNG được:
#   (a) đưa thông tin đó về "không có", (b) ghi đè trường đã lưu (hồ sơ hay budget.json guests/total_tr) bằng giá trị khác ý người viết (1.500 thành 1,5),
#   (c) cho hai kết quả khác nhau giữa chat và PATCH. Chỉ null / "" / [] / 0 là xoá (H3.4). Sinh ra vì bản cài đầu ép rác về 0 rồi lan sang bảng ngân sách (mất số thật).
# Biến: TOHONG_BACK_REPO (mặc định ../tohong-back). Tìm gốc HQ bằng dò ngược tới scripts/gate.py (ADR-070).
set -u
d="$(cd "$(dirname "$0")" && pwd)"
while [ "$d" != "/" ] && [ ! -f "$d/scripts/gate.py" ]; do d="$(dirname "$d")"; done
[ -f "$d/scripts/gate.py" ] || { echo "FAIL không tìm thấy gốc tohong-hq"; exit 1; }
cd "$d" || exit 1
export TOHONG_BACK_REPO="${TOHONG_BACK_REPO:-$d/../tohong-back}"
for e in eval/T-173/adv-01-rac-khong-xoa-so-that.mjs eval/T-173/adv-02-ngay-rac-khong-xoa-ngay-that.mjs eval/T-173/adv-07-dau-phan-cach-khong-doi-so.mjs; do
  out="$(node "$e" 2>&1)"; rc=$?
  if [ $rc -ne 0 ]; then echo "FAIL $(basename "$e"): $(printf '%s' "$out" | tail -1 | cut -c1-400)"; exit 1; fi
done
echo "PASS rác (số, ngày, gu không đọc chắc được) không xoá, không đổi giá trị đã lưu; chat và PATCH cùng kết quả"
