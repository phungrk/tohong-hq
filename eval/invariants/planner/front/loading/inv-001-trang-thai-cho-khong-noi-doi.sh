#!/usr/bin/env bash
# Nguồn: T-061 (spec products/T-061-skeleton-dang-tai.md v3, qua Spec Gate 2026-11-04, spec-critic).
# Bất biến: ở 4 tab (Trang chủ, Kế hoạch, Ngân sách, Khách mời), khi /api/me và dữ liệu chính chưa trả lời, không có chữ trạng thái rỗng giả ("0 người", "Chưa có khách mời", "0/0 việc", "Chưa có số khách", "Chưa đặt sức chứa", "xác nhận · chờ", "Chọn ngày" …), không có chữ chờ trơn "Đang tải…" và không có nút "Thêm …" nhìn thấy. Nhìn thấy nghĩa là rộng và cao > 8px, không ẩn, và độ mờ hiệu dụng >= 0,05 (lớp đã đóng mà opacity 0 thì không tính).
# Đo bằng lib/loading_inv.cjs --only 1, dùng API giả: /api/me 300ms, dữ liệu 1,5s, Chromium 390x844. Không dùng bộ chọn class/style, không đọc mã nguồn.
# Chạy: bash eval/invariants/planner/front/loading/inv-001-trang-thai-cho-khong-noi-doi.sh   (cwd = repo tohong-front, giống gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
# CHƯA ÁP DỤNG: chỉ có hiệu lực khi lịch sử git của repo front có commit gắn [T-061]. Trước đó in "PASS chưa áp dụng" để không chặn việc khác trong vùng.
#   Muốn bỏ điều kiện này phải qua Chief of Staff và ghi vào decisions/.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
if ! git -C "$REPO" log --oneline --grep='\[T-061\]' -1 2>/dev/null | grep -q .; then
  echo "PASS chưa áp dụng: repo front chưa có commit [T-061] (skeleton đang tải chưa ship)"; exit 0
fi
exec node "$HERE/lib/loading_inv.cjs" --repo "$REPO" --only 1
