#!/usr/bin/env bash
# Nguồn: T-061 (spec products/T-061-skeleton-dang-tai.md v3, qua Spec Gate 2026-11-04, spec-critic).
# Bất biến: khi bật prefers-reduced-motion: reduce, ở 4 tab, lúc chờ không animation nào đang chạy trong vùng [aria-busy="true"], và vùng vẫn có khối tô màu nhìn thấy (đứng yên, không biến mất).
# Đo bằng lib/loading_inv.cjs --only 3, dùng API giả: /api/me 300ms, dữ liệu 1,5s, Chromium 390x844. Không dùng bộ chọn class/style, không đọc mã nguồn.
# Chạy: bash eval/invariants/planner/front/loading/inv-003-vung-cho-ton-trong-reduced-motion.sh   (cwd = repo tohong-front, giống gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
# CHƯA ÁP DỤNG: chỉ có hiệu lực khi lịch sử git của repo front có commit gắn [T-061]. Trước đó in "PASS chưa áp dụng" để không chặn việc khác trong vùng.
#   Muốn bỏ điều kiện này phải qua Chief of Staff và ghi vào decisions/.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
if ! git -C "$REPO" log --oneline --grep='\[T-061\]' -1 2>/dev/null | grep -q .; then
  echo "PASS chưa áp dụng: repo front chưa có commit [T-061] (skeleton đang tải chưa ship)"; exit 0
fi
exec node "$HERE/lib/loading_inv.cjs" --repo "$REPO" --only 3
