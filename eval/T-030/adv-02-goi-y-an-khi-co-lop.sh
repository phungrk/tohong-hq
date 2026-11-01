#!/usr/bin/env bash
# Eval đối kháng T-030 v2 (adversary, 2026-11-01, ADR-011). Kịch bản trong lib/adv_hint.cjs:
# J 6 lớp: mở → gợi ý cài ẩn; Back / đóng bằng giao diện → hiện lại; install_hint_shown đúng 1 lần
# K 2 lớp chồng + Back nhanh; chọn tab từ ngăn kéo; race paywall + đóng chat → gợi ý về đúng
# L "Không nhắc lại" rồi mở/đóng lớp, tải lại → không hiện; lớp mở → không còn nút gợi ý dưới lớp
# M 390x640 có điều kiện gợi ý: sheet "Thêm việc" thấy nút đóng + nút Thêm; ô nhắn chat trong màn.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_FRONT_REPO:-$PWD}"
exec node "$HERE/lib/adv_hint.cjs" --repo "$REPO" "$@"
