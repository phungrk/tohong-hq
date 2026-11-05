#!/usr/bin/env bash
# Nguồn: T-068 Code Gate (adversary, 2026-11-05), rút từ eval đối kháng eval/T-068/adv-01.sh; spec products/T-066-anh-minh-hoa-tu-tao.md M4.
# Bất biến: ô minh hoạ có cạnh ngắn < 80px (không có chữ nhãn) phải hiện tooltip = tên truy cập khi rê chuột: phần tử trúng chuột ở tâm ô, hoặc tổ tiên gần nhất có title, mang title đúng bằng aria-label "Ảnh minh hoạ: <hạng mục>". Có thuộc tính title mà lớp ô không nhận chuột thì đỏ.
# Đo bằng lib/small_tile_tooltip.cjs (dữ liệu giả, ảnh hỏng và ảnh thiếu, Chromium 390px; bề mặt 3, 4, 5; elementFromPoint, không đọc mã nguồn).
# Chạy: bash eval/invariants/planner/front/vendor-images/inv-004-o-nho-co-tooltip-khi-re-chuot.sh  (repo front: TOHONG_FRONT_REPO, rồi cwd nếu là repo front, rồi ../tohong-front cạnh tohong-hq).
# CHƯA ÁP DỤNG: chỉ có hiệu lực khi lịch sử git của REPO FRONT có commit gắn [T-066]. Trước đó in "PASS chưa áp dụng".
#   Muốn bỏ điều kiện này phải qua Chief of Staff và ghi vào decisions/.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
HQ="$(cd "$HERE/../../../../.." && pwd)"
REPO=""
for c in "${TOHONG_FRONT_REPO:-}" "$PWD" "$HQ/../tohong-front"; do
  if [ -n "$c" ] && [ -f "$c/package.json" ] && [ -f "$c/src/screens/VendorCtx.jsx" ]; then REPO="$(cd "$c" && pwd)"; break; fi
done
if [ -z "$REPO" ]; then echo "PASS chưa áp dụng: không tìm thấy repo tohong-front"; exit 0; fi
if ! git -C "$REPO" log --oneline --grep='\[T-066\]' -1 2>/dev/null | grep -q .; then
  echo "PASS chưa áp dụng: repo front chưa có commit [T-066] (minh hoạ tự tạo chưa ship)"; exit 0
fi
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/small_tile_tooltip.cjs" --repo "$REPO"
