#!/usr/bin/env bash
# Nguồn: T-056 (spec products/T-056-chrome-ios-thanh-tab.md v2, qua Spec Gate 2026-11-04, spec-critic). Sự cố production: Chrome iOS che thanh tab sau T-054/T-055.
# Bất biến: khi vùng nhìn thấy (visualViewport) thấp hơn cửa sổ bố cục (innerHeight) vì thanh công cụ trình duyệt, thanh tab nằm trọn trong vùng nhìn thấy,
#   đáy trùng đáy vùng nhìn thấy (offsetTop + height), ở đầu/giữa/cuối trang cả 4 tab, và đi theo khi chênh đổi; khi chênh = 0 thì sát đáy cửa sổ như T-055.
#   Ngoại lệ (không đo ở đây): visualViewport.scale khác 1 (zoom), và đang focus ô nhập chữ/textarea/contenteditable (bàn phím, spec hành vi 8).
# Đo bằng lib/t056/check_vv.cjs (bản chụp cố định của eval/T-056/check_vv.cjs) TC1 + TC2, visualViewport giả lập; không gồm cờ ?vvdebug=1.
# Chạy: bash eval/invariants/planner/front/layout/inv-010-thanh-tab-tron-trong-vung-nhin-thay.sh   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
# CHƯA ÁP DỤNG: chỉ có hiệu lực khi lịch sử git của repo front có commit gắn [T-056]. Trước đó in "PASS chưa áp dụng" để không chặn việc khác trong vùng.
#   Bỏ điều kiện này phải qua Chief of Staff và decisions/.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
if ! git -C "$REPO" log --oneline --grep='\[T-056\]' -1 2>/dev/null | grep -q .; then
  echo "PASS chưa áp dụng: repo front chưa có commit [T-056] (bù visualViewport cho thanh tab chưa ship)"; exit 0
fi
exec node "$HERE/lib/t056/check_vv.cjs" --repo "$REPO" --only 1,2
