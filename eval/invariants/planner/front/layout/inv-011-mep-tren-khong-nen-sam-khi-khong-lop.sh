#!/usr/bin/env bash
# Nguồn: T-059 (spec products/T-059-safari-thanh-tren-xam.md v1, qua Spec Gate 2026-11-04, spec-critic). Sự cố: Safari iPhone tô xám vùng thanh trạng thái sau T-055.
# Bất biến: khi không lớp nào mở, ở cả 4 tab, đầu và giữa trang, không phần tử fixed/sticky (hoặc nằm trong cây con của phần tử fixed/sticky)
#   có hộp chạm mép trên vùng nhìn thấy (y=0) mà nền khác trong suốt hoặc màu giấy rgb(252,248,243) (mọi độ trong), và không có background-image.
#   opacity của phần tử KHÔNG được tính là ẩn (Safari tô thanh trên theo màu nền); display:none / visibility:hidden thì không tính (không vẽ).
# Đo bằng lib/t059/check_tint.cjs (bản chụp cố định của eval/T-059/check_tint.cjs) TC1, Chromium 390x640. Màu thật của thanh Safari chỉ đo được trên iPhone.
# Chạy: bash eval/invariants/planner/front/layout/inv-011-mep-tren-khong-nen-sam-khi-khong-lop.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
# CHƯA ÁP DỤNG: chỉ có hiệu lực khi lịch sử git của repo front có commit gắn [T-059]. Trước đó in "PASS chưa áp dụng" để không chặn việc khác trong vùng.
#   Bỏ điều kiện này phải qua Chief of Staff và decisions/.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
if ! git -C "$REPO" log --oneline --grep='\[T-059\]' -1 2>/dev/null | grep -q .; then
  echo "PASS chưa áp dụng: repo front chưa có commit [T-059] (lớp phủ không nền khi đóng chưa ship)"; exit 0
fi
exec node "$HERE/lib/t059/check_tint.cjs" --repo "$REPO" --only 1
