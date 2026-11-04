#!/usr/bin/env bash
# Nguồn: T-054 (spec products/T-054-cuon-cap-trang.md v3, qua Spec Gate 2026-11-04, spec-critic). INV-D.
# Bất biến: vị trí cuộn nhớ theo địa chỉ hash: chạm tab, Back, Forward, Quay lại đưa trang về đúng vị trí rời gần nhất ngay ở khung hình đầu (không nháy, không hoạt ảnh); trang chưa xem và trang con mở từ danh sách bắt đầu ở 0; chạm tab đang xem đứng yên, không thêm bước lịch sử. Spec mục 4.
# Đo bằng lib/t054/check_ui.cjs (bản chụp cố định của eval/T-054/check_ui.cjs) --only 4.
# Chạy: bash eval/invariants/planner/front/navigation/inv-007-khoi-phuc-vi-tri-cuon.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
# CHƯA ÁP DỤNG: bất biến chỉ có hiệu lực khi lịch sử git của repo front có commit gắn [T-054] (T-054 đã vào nhánh đang đo).
#   Trên main trước T-054 nó in "PASS chưa áp dụng" để không chặn việc khác trong vùng. Từ lúc T-054 merge, nhánh nào chứa commit đó đều bị đo thật,
#   nên quay lại khung con cuộn sẽ ĐỎ. Bỏ điều kiện này phải qua Chief of Staff và decisions/.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
if ! git -C "$REPO" log --oneline --grep='\[T-054\]' -1 2>/dev/null | grep -q .; then
  echo "PASS chưa áp dụng: repo front chưa có commit [T-054] (cuộn cấp document chưa ship)"; exit 0
fi
exec node "$HERE/lib/t054/check_ui.cjs" --repo "$REPO" --only 4
