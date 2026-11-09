#!/usr/bin/env bash
# T-117 adv-03 (adversary). Đổi đỉnh sheet là đổi chung cho MỌI bước (sheet dùng chung); spec T-115 "Không đổi bước 0, 1, 3a, 3b".
# Kiểm các bước đó không hỏng ở điện thoại 320x568, 360x640, 390x664: dải kéo / đầu sheet nằm trong vùng nhìn thấy (đỉnh >= 0);
# nút hành động chính của bước (Bắt đầu; Tiếp theo; Xem Gu của tôi + Bỏ qua; Vào Tơ Hồng) sau khi cuộn tới nằm trọn trong vùng nhìn thấy, không bị che; không cuộn ngang.
# Logic: eval/T-117/lib/a03.cjs. Chạy: bash eval/T-117/adv-03-buoc-khac-van-dung-duoc.sh (cwd = repo tohong-front, hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/a03.cjs"
