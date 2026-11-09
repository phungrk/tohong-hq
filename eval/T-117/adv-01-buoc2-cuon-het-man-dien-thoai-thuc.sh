#!/usr/bin/env bash
# T-117 adv-01 (adversary). Hành vi 3+4 của spec T-115 tổng quát ra các viewport điện thoại thật nằm GIỮA "màn rất thấp" (320x568, 375x548)
# và ba viewport bắt buộc: iPhone mini/12-13 mini Safari ~375x632, Android 360x640, 384x640, iPhone Plus Safari 414x622, Android 360x740.
# Mong đợi: bước 2/3 cuộn được tới hết; sau khi cuộn hết, tiêu đề Số khách và nút cuối mục Số khách không bị footer che;
# footer trong vùng nhìn thấy; nút Tiếp theo cao >= 44px, không bị che; không cuộn ngang. (Không đòi thấy Số khách khi CHƯA cuộn: spec không hứa ở các cỡ này.)
# Logic: eval/T-117/lib/a01.cjs. Chạy: bash eval/T-117/adv-01-buoc2-cuon-het-man-dien-thoai-thuc.sh (cwd = repo tohong-front, hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/a01.cjs"
