#!/usr/bin/env bash
# T-117 adv-04 (adversary). Bàn phím ảo + lớp con trong sheet ở điện thoại.
# (a) Bước 1 (bước có ô nhập tên; bước 2 không có ô nhập chữ): 390x664 và 360x640, focus ô tên đầu rồi thu viewport còn 300px cao
#     (mô phỏng bàn phím Android thu layout viewport; Chromium không có bàn phím thật), cuộn ô vào tầm nhìn như trình duyệt làm:
#     ô tên đang nhập nằm trọn trong vùng nhìn thấy và không bị footer/nút che.
# (b) Bước 2: mở lịch "Ngày cưới dự kiến" ở 320x568, 360x640, 390x664: nút Chọn và Huỷ của lịch trong vùng nhìn thấy, không bị che.
# Logic: eval/T-117/lib/a04.cjs. Chạy: bash eval/T-117/adv-04-ban-phim-ao-va-lich.sh (cwd = repo tohong-front, hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/a04.cjs"
