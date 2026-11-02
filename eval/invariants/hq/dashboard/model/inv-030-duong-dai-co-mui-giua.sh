#!/usr/bin/env bash
# Nguồn: T-039 (spec products/T-039-mui-ten-huong.md v2, qua Spec Gate 2026-11-02, spec-critic; đề xuất INV-B của Product).
# Bất biến: mọi p_* dài ≥ 220u có đúng một mũi giữa [data-at=mid], đường ngắn hơn không có; mũi giữa đạt cùng chuẩn (đặc, cùng màu, 5-7px × 4-7px, đúng hướng, trên đường), tâm không nằm trong khối, không che chữ, không đè bot; ở 1280, 390, 390 phóng to, sáng và tối.
# Khối đích suy bằng hình học (khối có khoảng cách có dấu nhỏ nhất tới đầu mũi cuối), không dùng bảng cố định: đường p_* thêm sau này tự được kiểm.
# Áp dụng khi index.html có mũi tên [data-part=ah] hoặc repo có docs/screenshots/T-039/; trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-030-duong-dai-co-mui-giua.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/t039_inv.cjs" --repo "$REPO" --check mid-arrow
