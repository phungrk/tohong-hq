#!/usr/bin/env bash
# Eval T-047 tiêu chí 5b: mô tả PR nhúng đủ sáu ảnh trước/sau.
#   cd /home/user/tohong-hq && bash eval/T-047/pr-body.sh [số-PR | nhánh | đường-dẫn-file-markdown]   (mặc định nhánh t-047-mui-ten-to)
# Số PR hoặc nhánh: lấy mô tả qua REST (`gh api repos/phungrk/tohong-hq-dashboard/pulls...`; GraphQL bị chặn ở phiên cloud, ADR-020). File: kiểm trực tiếp (dùng khi chưa có PR).
# PASS khi mô tả có đủ sáu ảnh markdown ![..](..) trỏ tới docs/screenshots/T-047/{truoc,sau}-{1280,844,390}.png (đường dẫn tương đối hoặc URL tuyệt đối đều được).
set -u
A="${1:-t-047-mui-ten-to}"   # mặc định: PR của nhánh t-047-mui-ten-to
if [ -f "$A" ]; then BODY="$(cat "$A")"; else R=phungrk/tohong-hq-dashboard; case "$A" in *[!0-9]*) BODY="$(gh api "repos/$R/pulls?head=phungrk:$A&state=all" --jq '.[0].body // empty' 2>/dev/null)";; *) BODY="$(gh api "repos/$R/pulls/$A" --jq '.body // empty' 2>/dev/null)";; esac; [ -n "$BODY" ] || { echo "FAIL không đọc được PR $A bằng gh"; exit 1; }; fi
miss=""
for n in truoc-1280 sau-1280 truoc-844 sau-844 truoc-390 sau-390; do
  printf '%s' "$BODY" | grep -Eq '!\[[^]]*\]\([^)]*docs/screenshots/T-047/'"$n"'\.png[^)]*\)' || miss="$miss $n"
done
[ -z "$miss" ] && { echo "PASS mô tả PR nhúng đủ 6 ảnh trước/sau"; exit 0; } || { echo "FAIL mô tả PR thiếu ảnh nhúng:$miss"; exit 1; }
