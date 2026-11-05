#!/usr/bin/env bash
# Nguồn: T-066 (spec products/T-066-anh-minh-hoa-tu-tao.md v2, qua Spec Gate 2026-11-05, spec-critic).
# Bất biến: ô có ảnh thật không bao giờ mang minh hoạ hay nhãn "Ảnh minh hoạ" (kể cả ảnh tải chậm); lúc đang kiểm (ảnh chưa tải xong, đang tra pool) ô giữ cách hiện cũ, không vẽ svg minh hoạ nào; ảnh treo quá 8 giây thì sang minh hoạ có nhãn.
# Đo bằng lib/vendor_img_inv.cjs --only 4 (dữ liệu giả, ảnh hỏng/chậm/treo giả, Chromium 390px; đo theo vai trò, tên truy cập và điểm ảnh, không đọc mã nguồn).
# Chạy: bash eval/invariants/planner/front/vendor-images/inv-003-anh-tot-va-dang-kiem-khong-minh-hoa.sh  (repo front: TOHONG_FRONT_REPO, rồi cwd nếu là repo front, rồi ../tohong-front cạnh tohong-hq).
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
exec node "$HERE/lib/vendor_img_inv.cjs" --repo "$REPO" --only 4
