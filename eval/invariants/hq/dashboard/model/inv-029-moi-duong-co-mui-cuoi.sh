#!/usr/bin/env bash
# Nguồn: T-039 (spec products/T-039-mui-ten-huong.md v2, qua Spec Gate 2026-11-02, spec-critic; đề xuất INV-A của Product).
# Bất biến: mọi path[id^=p_] trong #model svg có đúng một mũi cuối [data-part=ah][data-at=end][data-for=<id>]: nhìn thấy, fill đặc cùng màu đường, dài 5-7px và rộng 4-7px hiển thị, lệch hướng đi ≤ 20°, đầu mũi trên đường (≤ 1,5u, cho kéo dài 8u) và cách mép khối gần nhất 0,8-3,5u, vẽ sau khối đó và trước #fx_f, không chồng khối khác, không che chữ, không đè thân bot (>0,5u); ở 1280, 390, 390 phóng to, sáng và tối.
# Khối đích suy bằng hình học (khối có khoảng cách có dấu nhỏ nhất tới đầu mũi cuối), không dùng bảng cố định: đường p_* thêm sau này tự được kiểm.
# Áp dụng khi index.html có mũi tên [data-part=ah] hoặc repo có docs/screenshots/T-039/; trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-029-moi-duong-co-mui-cuoi.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/t039_inv.cjs" --repo "$REPO" --check end-arrow
