#!/usr/bin/env bash
# Nguồn: T-122 (spec v2, Chốt 1-2 + hành vi 2; qua Spec Gate 2026-11-11, spec-critic).
# Bất biến: ở bước 2/3 Onboarding, viewport 390x650, 375x632, 390x664, 393x662 (chưa cuộn và đã cuộn hết):
#   nút "Tiếp theo" và "Quay lại bước 1" không bị phủ (elementFromPoint tại tâm), nút chính cao >= 44px;
#   chữ nút Tiếp theo >= 4.5:1 so với nền nút, chữ "Quay lại bước 1" >= 4.5:1 so với nền;
#   nền nút Tiếp theo không lộ nền phía sau (đổi màu nền sau thì nền nút không đổi quá 8/255) và giống nhau ở mọi vị trí cuộn;
#   bấm Tiếp theo sang "BƯỚC 3 / 3", bấm Quay lại bước 1 về "BƯỚC 1 / 3" (375x632).
# Nghĩa: dù footer có mờ hay trang trí thế nào, nút chính không bao giờ bị làm mờ hay khó đọc.
# Đo bằng lib/t122/check.cjs --only 2 (bản chụp cố định của eval/T-122/check.cjs). Xanh trên tohong-front main a7e5807 và bản thử T-122 v2 (2026-11-11).
# Chạy: bash <file>   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/t122/check.cjs" --repo "$REPO" --only 2
