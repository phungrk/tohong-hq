#!/usr/bin/env bash
# INV-018 (đề xuất, vùng planner/front/layout; adversary T-123, CHỜ MERGE: đỏ trên PR #67 bản 7c0dc49, xanh trên #66 6f20007).
# Phần tử đang được focus trong vùng nội dung của sheet onboarding (ô nhập khi bàn phím ảo mở, nút khi focus) không bao giờ bị footer che
# sau khi trình duyệt cuộn nó vào tầm nhìn (WCAG 2.4.11 Focus Not Obscured). Tổng quát cho mọi thay đổi footer/sheet onboarding,
# không chỉ T-122: footer nào đè lên vùng cuộn thì vùng cuộn phải chừa chỗ khi cuộn-vào-tầm-nhìn.
# Khi đưa vào eval/invariants/planner/front/layout/: chép eval/T-123/lib/a01.cjs vào lib/t123/ của bể và sửa đường dẫn require.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/../lib/a01.cjs"
