#!/usr/bin/env bash
# Nguồn: T-169 (spec products/T-169-ho-so-mot-nguon-su-that.md v3, H3, H4; "Bất biến đề xuất" INV-B); spec-critic rút khi spec qua Spec Gate 2026-11-15.
# Nằm ở eval/T-169/bat-bien-cho-merge/ cùng INV-A; xanh cả trên main 1519d44 (hàng rào chống hồi quy), nhưng đi chung INV-A để Chief of Staff đưa vào eval/invariants/planner/profile/ sau merge.
# INV-B · GHI KHÔNG MẤT, ĐỌC KHÔNG GHI. (a) Mọi GET (hồ sơ, summary, Khách mời, Ngân sách), tab Vendor và một lượt chat KHÔNG ghi profile.yaml, budget.json, guests.json
#   (dữ liệu cũ lệch chỉ chuẩn hoá trong bộ nhớ, không di trú khi đọc); (b) sau mỗi đường ghi (PATCH onboarding/Dashboard, chat update_profile từng trường, PUT /budget)
#   mọi khoá có trước trong hồ sơ, bảng ngân sách, danh sách khách vẫn còn và mọi giá trị ngoài thông tin vừa ghi giữ nguyên (tên, vùng, shortlist, loại trừ, khoản chi, khách, khoá lạ).
# Nội dung chạy: eval T-169 tiêu chí 6. Biến: TOHONG_BACK_REPO (mặc định ../tohong-back). Tìm gốc HQ bằng dò ngược tới scripts/gate.py (ADR-070).
set -u
d="$(cd "$(dirname "$0")" && pwd)"
while [ "$d" != "/" ] && [ ! -f "$d/scripts/gate.py" ]; do d="$(dirname "$d")"; done
[ -f "$d/scripts/gate.py" ] || { echo "FAIL không tìm thấy gốc tohong-hq"; exit 1; }
cd "$d" || exit 1
export TOHONG_BACK_REPO="${TOHONG_BACK_REPO:-$d/../tohong-back}"
out="$(node eval/T-169/check_6_khong_mat_du_lieu_doc_khong_ghi.mjs 2>&1)"; rc=$?
if [ $rc -ne 0 ]; then echo "FAIL $(printf '%s' "$out" | tail -1 | cut -c1-400)"; exit 1; fi
echo "PASS đọc không ghi R2 hồ sơ; mọi đường ghi giữ mọi khoá và giá trị ngoài thông tin vừa ghi"
