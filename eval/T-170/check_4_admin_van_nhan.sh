#!/usr/bin/env bash
# T-170 tiêu chí 4 (admin): bảng "Danh sách vendor", ô chọn "Nhãn" và ngăn kéo enrich ("Nhãn giá: …") VẪN hiện nhãn nguồn giá (ADR-099: admin giữ nhãn). Dùng lại eval/T-164/check_5b_nhan_admin.cjs
# (nó đo đúng hành vi admin, không đo app cặp đôi nên không lỗi thời). Xanh trên main và phải xanh sau khi cài; đỏ nghĩa là việc bỏ nhãn đã xoá nhầm nhãn ở admin.
# Chạy từ gốc tohong-hq: bash eval/T-170/check_4_admin_van_nhan.sh · Biến: TOHONG_FRONT_REPO (mặc định ../tohong-front), PLAYWRIGHT_PATH.
set -u
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
FRONT="${TOHONG_FRONT_REPO:-$HQ/../tohong-front}"
[ -f "$FRONT/package.json" ] || { echo "FAIL không thấy repo tohong-front (đặt TOHONG_FRONT_REPO)"; exit 2; }
out="$(node "$HQ/eval/T-164/check_5b_nhan_admin.cjs" --repo "$FRONT" 2>&1 | tail -3)"
if echo "$out" | grep -q '^PASS'; then echo PASS; exit 0; fi
echo "$out" | grep '^FAIL' | head -1 | sed 's/^FAIL /FAIL [admin mất nhãn] /' || true
echo "$out" | grep -q '^FAIL' || echo "FAIL eval admin không chạy được: $(echo "$out" | tr '\n' ' ' | cut -c1-200)"
exit 1
