#!/usr/bin/env bash
# Nguồn: T-181 (adversary adv-02-ten-dai-320-360, lỗ bể ADR-110); spec T-177 H6. Rút bởi spec-critic 2026-11-15.
# INV-007 · Nút "Tìm ..." ở chi tiết hạng mục với tên hạng mục dài (KHÔNG dấu cách và có dấu cách), ở 320px và 360px:
#   mọi dòng chữ nằm trong nút và trong khung (không tràn), không bị cắt (ellipsis/line-clamp/overflow ẩn), đọc đủ tên hạng mục,
#   nút trong khung, trang không cuộn ngang, icon tìm còn trong nút và không bị bóp. Không khoá cách viết nhãn (không so nguyên văn, không đòi số dòng).
# Đo bằng lib/nut_tim_ten_dai_inv.cjs (màn Ngân sách thật, API giả, Playwright; chỉ đo chữ nhìn thấy và hộp, không đọc mã nguồn).
# Chạy: bash <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO (mặc định $PWD nếu là repo front, không thì <gốc HQ>/../tohong-front), PLAYWRIGHT_PATH.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${TOHONG_FRONT_REPO:-}" ] && [ -f "$PWD/src/screens/Budget.jsx" ]; then export TOHONG_FRONT_REPO="$PWD"; fi
exec node "$HERE/lib/nut_tim_ten_dai_inv.cjs" "$@"
