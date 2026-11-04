#!/usr/bin/env bash
# Nguồn: T-054 (spec products/T-054-cuon-cap-trang.md v3, qua Spec Gate 2026-11-04, spec-critic). INV-B.
# Bất biến: header dính đầu và thanh tab dính đáy vùng nhìn thấy ở mọi vị trí cuộn (cả trang con với nút Quay lại); ở đầu trang header không che chữ, ở cuối trang thanh tab và khối gợi ý cài không che chữ; khối gợi ý hiện ở đầu trang trên iPhone. Spec mục 3.
# Đo bằng lib/t054/check_ui.cjs (bản chụp cố định của eval/T-054/check_ui.cjs) --only 3.
# Chạy: bash eval/invariants/planner/front/layout/inv-008-header-va-thanh-tab-dinh.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
# CHƯA ÁP DỤNG: bất biến chỉ có hiệu lực khi lịch sử git của repo front có commit gắn [T-054] (T-054 đã vào nhánh đang đo).
#   Trên main trước T-054 nó in "PASS chưa áp dụng" để không chặn việc khác trong vùng. Từ lúc T-054 merge, nhánh nào chứa commit đó đều bị đo thật,
#   nên quay lại khung con cuộn sẽ ĐỎ. Bỏ điều kiện này phải qua Chief of Staff và decisions/.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
if ! git -C "$REPO" log --oneline --grep='\[T-054\]' -1 2>/dev/null | grep -q .; then
  echo "PASS chưa áp dụng: repo front chưa có commit [T-054] (cuộn cấp document chưa ship)"; exit 0
fi
exec node "$HERE/lib/t054/check_ui.cjs" --repo "$REPO" --only 3
