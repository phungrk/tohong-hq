#!/usr/bin/env bash
# T-123 adv-01 (adversary). Phần tử đang focus trong vùng nội dung onboarding (ô tên khi bàn phím mở để lại 480..545px; nút Số khách khi focus)
# không bị footer che sau khi trình duyệt cuộn nó vào tầm nhìn. Logic: eval/T-123/lib/a01.cjs.
# Chạy: bash eval/T-123/adv-01-focus-khong-bi-footer-che.sh (đặt TOHONG_FRONT_REPO hoặc cwd = repo tohong-front)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/a01.cjs"
