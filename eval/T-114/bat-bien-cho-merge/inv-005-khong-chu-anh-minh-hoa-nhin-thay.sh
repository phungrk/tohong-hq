#!/usr/bin/env bash
# Nguồn: T-114 (spec products/T-114-bo-chu-anh-minh-hoa.md v1, mục "Bất biến đề xuất"), spec-critic qua Spec Gate 2026-11-09.
# Bất biến (vùng planner/front/vendor-images): ở cả 6 bề mặt vendor (thẻ danh sách gợi ý, gallery chi tiết, chọn so sánh, bảng so sánh,
#   Vendor đã lưu, chi tiết vendor ở Ngân sách), khi ảnh hỏng/thiếu/treo, KHÔNG có chữ "Ảnh minh hoạ" nhìn thấy ở bất kỳ đâu trong trang
#   (text node, chữ trong svg, ::before/::after; mọi cách viết dấu: hoạ/họa, NFC/NFD, hoa/thường, không dấu), VÀ mỗi chỗ ảnh hỏng/thiếu
#   vẫn có đúng một ô role="img" tên "Ảnh minh hoạ: <tên hạng mục>". Tooltip (title) ô nhỏ không phải chữ nhìn thấy, do INV-004 giữ.
# Lý do: Capu 2026-11-09 "Bỏ text ảnh minh hoạ"; chặn chip quay lại (vd ai đó làm lại nhãn theo T-066 M4 cũ).
# Đo bằng lib/no_visible_label.cjs (dữ liệu giả, ảnh hỏng/chậm/treo giả, Chromium 390px; đo chữ nhìn thấy và tên truy cập, không đọc mã nguồn;
#   có selftest thước đo trước khi đo app).
# TRẠNG THÁI: CHỜ MERGE. Trên main a7e5807 (chưa có T-114) bất biến này ĐỎ ở N1 (chip ở bề mặt 1 và 2), đúng như mong đợi.
#   Khi PR T-114 merge, Chief of Staff chuyển nguyên thư mục này (file .sh + lib/) vào eval/invariants/planner/front/vendor-images/
#   (spec-critic đã duyệt việc thêm; đổi số nếu trùng). Script tự tìm eval/_lib/vite_dev.cjs nên chạy được ở cả hai chỗ.
# Chạy: bash eval/T-114/bat-bien-cho-merge/inv-005-khong-chu-anh-minh-hoa-nhin-thay.sh  (repo front: TOHONG_FRONT_REPO, rồi cwd nếu là repo front, rồi ../tohong-front cạnh tohong-hq).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
HQ="$HERE"; while [ "$HQ" != "/" ] && [ ! -f "$HQ/scripts/gate.py" ]; do HQ="$(dirname "$HQ")"; done
REPO=""
for c in "${TOHONG_FRONT_REPO:-}" "$PWD" "$HQ/../tohong-front"; do
  if [ -n "$c" ] && [ -f "$c/package.json" ] && [ -f "$c/src/screens/VendorCtx.jsx" ]; then REPO="$(cd "$c" && pwd)"; break; fi
done
if [ -z "$REPO" ]; then echo "PASS chưa áp dụng: không tìm thấy repo tohong-front"; exit 0; fi
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/no_visible_label.cjs" --repo "$REPO"
