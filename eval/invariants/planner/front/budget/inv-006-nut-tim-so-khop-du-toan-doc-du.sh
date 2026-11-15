#!/usr/bin/env bash
# Nguồn: T-177 (spec products/T-177-nut-tim-ghi-du-toan.md v2, qua Spec Gate 2026-11-15, spec-critic; D1 handoffs/T-177-D1.md).
# INV-006 · Nút "Tìm ..." ở chi tiết hạng mục: số tiền trong chữ nút (nếu có) bằng dự toán ĐANG HIỆN trên thanh (lệch <= 0,05), kể cả ngay khi kéo và khi lưu lỗi;
#   không hiện số 0 hay NaN/undefined/null; ở 360px chữ nút đọc đủ (không ellipsis/line-clamp/overflow ẩn, không tràn, không cuộn ngang). Không khoá cách viết nhãn.
# Đo bằng lib/nut_tim_inv.cjs (màn Ngân sách thật, API giả, Playwright; chỉ đo chữ nhìn thấy và hộp, không đọc mã nguồn).
# Chạy: bash <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO (mặc định $PWD nếu là repo front, không thì <gốc HQ>/../tohong-front), PLAYWRIGHT_PATH.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${TOHONG_FRONT_REPO:-}" ] && [ -f "$PWD/src/screens/Budget.jsx" ]; then export TOHONG_FRONT_REPO="$PWD"; fi
exec node "$HERE/lib/nut_tim_inv.cjs" "$@"
