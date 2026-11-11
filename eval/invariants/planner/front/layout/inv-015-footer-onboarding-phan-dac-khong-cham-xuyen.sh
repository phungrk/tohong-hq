#!/usr/bin/env bash
# Nguồn: T-122 (spec products/T-122-onboarding-footer-mo-dan.md v2, Chốt 6 + hành vi 1/6; qua Spec Gate 2026-11-11, spec-critic; defect T-122-D1).
# Bất biến: footer Onboarding (bước 2/3 và bước 3a chọn ảnh), ở mọi vị trí cuộn (đầu, giữa, cuối) và các viewport điện thoại
#   390x650, 375x632, 390x664, 393x662, 375x667, 320x568, 430x932, 390x300 (bước 2), 390x650, 320x568, 375x667 (bước 3a):
#   mọi điểm của footer từ mép trên chữ/nút đầu tiên trong footer trở xuống (dòng gợi ý, lề hai bên nút, khe giữa hai nút, đệm đáy; lưới 12x4px toàn bề ngang sheet)
#   KHÔNG trả về phần tử của vùng nội dung cuộn (không chạm xuyên); hai nút của footer nhận chạm tại tâm của chính chúng.
#   Dải phía trên chữ/nút đầu tiên của footer (dải mờ của T-122) không bị ràng buộc.
# Lý do: bản thử T-122 v1 cho cả hộp footer chạm xuyên; chạm đệm dưới "Bỏ qua" ở bước 3a chọn một ảnh nằm khuất mà eval hành vi vẫn xanh.
# Đo bằng lib/t122/inv_cham.cjs (dùng bản chụp cố định lib/t122/lib.cjs). Phần tử tìm theo nhãn/hành vi, không theo class/DOM.
# Xanh trên tohong-front main a7e5807 và trên bản thử eval/T-122/proto-on-pr66.diff (v2) áp lên #66; ĐỎ trên bản thử v1 (2026-11-11).
# Chạy: bash <file>   (cwd = repo tohong-front, như gate.py --cwd; hoặc đặt TOHONG_FRONT_REPO)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/t122/inv_cham.cjs" --repo "$REPO"
