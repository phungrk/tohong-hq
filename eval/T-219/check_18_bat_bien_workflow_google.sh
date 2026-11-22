#!/usr/bin/env bash
# T-219 tiêu chí 18: workflow Google mới không phá các bất biến của mọi workflow Google ở repo tohong.
# Code Gate chỉ chạy bất biến của vùng planner/vendor và cấp cha, KHÔNG chạy các vùng con planner/vendor/images/** hay planner/admin/vendor-enrich/**; tệp này gọi chúng ở tầng 1
# (cùng cách T-203 check_11). Chỉ gọi nguyên tệp trong bể (không sao chép, không sửa); chúng đọc repo tohong qua $TOHONG_REPO hoặc ../tohong. Chạy từ gốc tohong-hq.
# Gồm: vendor-enrich inv-005 (workflow dữ liệu kèm báo cáo), inv-019 (actions: read), inv-020 (GH_TOKEN ở bước check_runs), inv-021 (bước giữ khoá tên "Google:"), inv-022 (mọi tên trong
# vòng `for wf` tồn tại); images inv-012, inv-023 (cổng Re-run trước checkout), inv-024 (log còn khi huỷ), inv-030, inv-031, inv-035, inv-036 (Google không tự chạy ngoài đường duyệt tay).
# In PASS khi cả 12 đều PASS, FAIL <tên> nếu có tệp đỏ.
set -uo pipefail
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
INV="$HQ/eval/invariants/planner"
PATTERNS=(
  "admin/vendor-enrich/inv-005-" "admin/vendor-enrich/inv-019-" "admin/vendor-enrich/inv-020-" "admin/vendor-enrich/inv-021-" "admin/vendor-enrich/inv-022-"
  "vendor/images/inv-012-" "vendor/images/inv-023-" "vendor/images/inv-024-" "vendor/images/inv-030-" "vendor/images/inv-031-" "vendor/images/inv-035-" "vendor/images/inv-036-"
)
bad=()
for pat in "${PATTERNS[@]}"; do
  f="$(ls "$INV"/${pat}*.py 2>/dev/null | head -n1)"
  if [ -z "$f" ]; then bad+=("$pat (thiếu tệp)"); continue; fi
  if [ -z "${TOHONG_REPO:-}" ]; then out="$(python3 -I "$f" 2>&1)"; else out="$(TOHONG_REPO="$TOHONG_REPO" python3 -I "$f" 2>&1)"; fi; rc=$?
  echo "  $([ $rc -eq 0 ] && echo ok || echo XX) ${f#$INV/} :: $(echo "$out" | tail -n1 | cut -c1-160)"
  [ $rc -eq 0 ] || bad+=("${f#$INV/}")
done
if [ ${#bad[@]} -gt 0 ]; then echo "FAIL ${bad[0]}$([ ${#bad[@]} -gt 1 ] && echo " (+$(( ${#bad[@]} - 1 )) tệp nữa)")"; exit 1; fi
echo PASS
