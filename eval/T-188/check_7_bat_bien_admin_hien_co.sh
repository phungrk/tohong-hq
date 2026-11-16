#!/usr/bin/env bash
# T-188 tiêu chí 7: với cờ tắt (mặc định), các bất biến hiện có về "không phải admin -> 403" vẫn xanh trên cả hai repo.
# Chạy: members INV-002 (403 trước dữ liệu), vendor-enrich INV-008 (người ngoài không thấy, không gọi API vendor), vendor-enrich INV-010 (đọc là admin, ghi/ký là Capu).
# Cố ý ép cờ về tắt trong môi trường chạy (ADMIN_OPEN, VITE_ADMIN_OPEN rỗng) để máy có cờ bật cũng không làm bất biến đỏ oan.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
INV="$HERE/../invariants/planner/admin"
export ADMIN_OPEN="" VITE_ADMIN_OPEN=""
export TOHONG_BACK_REPO="${TOHONG_BACK_REPO:-$HERE/../../../tohong-back}" TOHONG_FRONT_REPO="${TOHONG_FRONT_REPO:-$HERE/../../../tohong-front}"
bad=0
for f in "$INV/members/inv-002-khong-admin-403-truoc-du-lieu.sh" "$INV/vendor-enrich/inv-008-nguoi-ngoai-khong-thay-khong-goi-api-vendor.sh"; do
  if bash "$f" >/tmp/t188-inv.$$ 2>&1; then echo "  ok $(basename "$f")"; else echo "  XX $(basename "$f")"; tail -3 /tmp/t188-inv.$$; bad=1; fi
done
f="$INV/vendor-enrich/inv-010-drawer-doc-la-admin-ghi-ky-la-capu.py"
if python3 -I "$f" >/tmp/t188-inv.$$ 2>&1; then echo "  ok $(basename "$f")"; else echo "  XX $(basename "$f")"; tail -3 /tmp/t188-inv.$$; bad=1; fi
rm -f /tmp/t188-inv.$$
if [ $bad -eq 0 ]; then echo PASS; exit 0; fi
echo "FAIL một bất biến admin hiện có đỏ khi cờ tắt"; exit 1
