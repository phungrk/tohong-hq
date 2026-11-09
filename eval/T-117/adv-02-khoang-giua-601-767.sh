#!/usr/bin/env bash
# T-117 adv-02 (adversary). Ranh giới media query 600px và khoảng 601-767px (tablet dọc hẹp, cửa sổ desktop hẹp, điện thoại xoay ngang lớn)
# mà eval T-115 không chạm: 600x664, 601x664, 700x664, 767x664, 768x1024.
# Mong đợi (hành vi 1+4 của spec T-115 áp cho cỡ này): bước 2/3 chưa cuộn đã thấy trọn tiêu đề Số khách và hàng nút đầu, cách footer >= 4px,
# không bị che; footer trong vùng nhìn thấy; nút Tiếp theo >= 44px; không cuộn ngang; sheet trong vùng nhìn thấy.
# Logic: eval/T-117/lib/a02.cjs. Chạy: bash eval/T-117/adv-02-khoang-giua-601-767.sh (cwd = repo tohong-front, hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/a02.cjs"
