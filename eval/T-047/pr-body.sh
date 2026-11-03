#!/usr/bin/env bash
# Eval T-047 tiêu chí 5b: mô tả PR nhúng đủ sáu ảnh trước/sau.
#   cd /home/user/tohong-hq && bash eval/T-047/pr-body.sh <số-PR | đường-dẫn-file-markdown>
# Số PR: lấy mô tả bằng `gh pr view <n> --repo phungrk/tohong-hq-dashboard --json body`. File: kiểm trực tiếp (dùng khi chưa có PR).
# PASS khi mô tả có đủ sáu ảnh markdown ![..](..) trỏ tới docs/screenshots/T-047/{truoc,sau}-{1280,844,390}.png (đường dẫn tương đối hoặc URL tuyệt đối đều được).
set -u
A="${1:-}"; [ -z "$A" ] && { echo "FAIL cần số PR hoặc file mô tả PR"; exit 1; }
if [ -f "$A" ]; then BODY="$(cat "$A")"; else BODY="$(gh pr view "$A" --repo phungrk/tohong-hq-dashboard --json body -q .body 2>/dev/null)" || { echo "FAIL không đọc được PR $A bằng gh"; exit 1; }; fi
miss=""
for n in truoc-1280 sau-1280 truoc-844 sau-844 truoc-390 sau-390; do
  printf '%s' "$BODY" | grep -Eq '!\[[^]]*\]\([^)]*docs/screenshots/T-047/'"$n"'\.png[^)]*\)' || miss="$miss $n"
done
[ -z "$miss" ] && { echo "PASS mô tả PR nhúng đủ 6 ảnh trước/sau"; exit 0; } || { echo "FAIL mô tả PR thiếu ảnh nhúng:$miss"; exit 1; }
