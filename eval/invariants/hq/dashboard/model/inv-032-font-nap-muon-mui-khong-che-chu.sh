#!/usr/bin/env bash
# Nguồn: T-049 adv-03/adv-05 (adversary, 2026-11-03, evalplus; Chief of Staff đồng ý rút thành bất biến). Spec T-047 mục 4, T-039 4.1 "không che chữ".
# Bất biến: font thật của trang ("Be Vietnam Pro", OFL, lib/BeVietnamPro-Regular.ttf) nạp muộn 2,5s, sau khi mũi tên và nhãn đã dựng bằng font dự phòng.
# Sau khi font nạp: không mũi tên [data-part=ah] nào (cuối, giữa) che chữ trong #model svg hay đè thân bot quá 0,5u, không lỗi JS;
# ở 360x800, 375x667, 390x844, 390 phóng to, 844x900, 1280x900. Đo bằng MEASURE của lib/t039_inv.cjs.
# Áp dụng khi index.html có mũi tên [data-part=ah] hoặc repo có docs/screenshots/T-039/; trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-032-font-nap-muon-mui-khong-che-chu.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/font_inv.cjs" --repo "$REPO"
