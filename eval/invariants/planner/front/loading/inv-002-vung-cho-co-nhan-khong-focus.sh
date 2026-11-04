#!/usr/bin/env bash
# Nguồn: T-061 (spec products/T-061-skeleton-dang-tai.md v3, qua Spec Gate 2026-11-04, spec-critic).
# Bất biến: lúc chờ, mỗi vùng [aria-busy="true"] nhìn thấy chứa role=status tên "Đang tải" và không chứa phần tử focus được (nên không phủ header, nút Mở menu/AI hay thanh tab). Tab 14 lần không đưa focus vào vùng. Tải xong thì không còn aria-busy="true". Ở 4 tab, lúc chờ có ít nhất một vùng như vậy.
# Đo bằng lib/loading_inv.cjs --only 2, dùng API giả: /api/me 300ms, dữ liệu 1,5s, Chromium 390x844. Không dùng bộ chọn class/style, không đọc mã nguồn.
# Chạy: bash eval/invariants/planner/front/loading/inv-002-vung-cho-co-nhan-khong-focus.sh   (cwd = repo tohong-front, giống gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
# CHƯA ÁP DỤNG: chỉ có hiệu lực khi lịch sử git của repo front có commit gắn [T-061]. Trước đó in "PASS chưa áp dụng" để không chặn việc khác trong vùng.
#   Muốn bỏ điều kiện này phải qua Chief of Staff và ghi vào decisions/.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
if ! git -C "$REPO" log --oneline --grep='\[T-061\]' -1 2>/dev/null | grep -q .; then
  echo "PASS chưa áp dụng: repo front chưa có commit [T-061] (skeleton đang tải chưa ship)"; exit 0
fi
exec node "$HERE/lib/loading_inv.cjs" --repo "$REPO" --only 2
