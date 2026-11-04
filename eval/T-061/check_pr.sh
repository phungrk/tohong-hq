#!/usr/bin/env bash
# Tiêu chí 12 của T-061: PR của việc có ảnh 390 trước và sau cho từng màn trong phạm vi.
#   bash eval/T-061/check_pr.sh <số-PR> [repo, mặc định phungrk/tohong-front]
# PASS khi mô tả PR có: >= 10 ảnh (4 tab + trang con hạng mục + gợi ý vendor + lịch sử chat + admin Thành viên = 8 màn, mỗi màn tối thiểu ảnh "sau" khi đang tải, và "trước" cho 4 tab),
# có chữ "390", có hai mục có chữ "Trước" và "Sau". Không đọc được PR thì FAIL (không đoán).
set -u
PR="${1:-}"; REPO="${2:-phungrk/tohong-front}"
if [ -z "$PR" ]; then echo "FAIL cần số PR"; exit 1; fi
BODY="$(gh api "repos/$REPO/pulls/$PR" --jq .body 2>/dev/null)" || { echo "FAIL không đọc được PR $PR của $REPO (gh chưa đăng nhập hoặc sai số)"; exit 1; }
IMGS="$(printf '%s' "$BODY" | grep -o -E '!\[[^]]*\]\([^)]+\)|<img [^>]*src=' | wc -l)"
[ "$IMGS" -ge 10 ] || { echo "FAIL PR có $IMGS ảnh, cần >= 10"; exit 1; }
printf '%s' "$BODY" | grep -q '390' || { echo "FAIL mô tả PR không ghi rõ khung 390"; exit 1; }
printf '%s' "$BODY" | grep -qi 'trước' || { echo "FAIL thiếu mục ảnh Trước"; exit 1; }
printf '%s' "$BODY" | grep -qi 'sau' || { echo "FAIL thiếu mục ảnh Sau"; exit 1; }
echo PASS
