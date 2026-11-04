#!/usr/bin/env bash
# Nguồn: T-054 (spec products/T-054-cuon-cap-trang.md v3, qua Spec Gate 2026-11-04, spec-critic). INV-C.
# Bất biến: lớp mở (sheet Mời, ngăn kéo, chat AI, sheet Thêm việc, hộp thoại Cách hoạt động) thì nền không trôi và không nhảy, lớp nằm trong vùng nhìn thấy theo bề rộng khung; đóng bằng mọi cách trả đúng scrollY và mốc nền, lăn lại được. Ai thêm lớp mới phải thêm bước mở vào đây (qua Chief of Staff). Spec mục 5.
# Đo bằng lib/t054/check_ui.cjs (bản chụp cố định của eval/T-054/check_ui.cjs) --only 5.
# Chạy: bash eval/invariants/planner/front/layout/inv-009-lop-mo-khoa-cuon-nen.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
# CHƯA ÁP DỤNG: bất biến chỉ có hiệu lực khi lịch sử git của repo front có commit gắn [T-054] (T-054 đã vào nhánh đang đo).
#   Trên main trước T-054 nó in "PASS chưa áp dụng" để không chặn việc khác trong vùng. Từ lúc T-054 merge, nhánh nào chứa commit đó đều bị đo thật,
#   nên quay lại khung con cuộn sẽ ĐỎ. Bỏ điều kiện này phải qua Chief of Staff và decisions/.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
if ! git -C "$REPO" log --oneline --grep='\[T-054\]' -1 2>/dev/null | grep -q .; then
  echo "PASS chưa áp dụng: repo front chưa có commit [T-054] (cuộn cấp document chưa ship)"; exit 0
fi
exec node "$HERE/lib/t054/check_ui.cjs" --repo "$REPO" --only 5
