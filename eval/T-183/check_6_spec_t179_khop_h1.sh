#!/usr/bin/env bash
# T-183 tiêu chí 6 (tài liệu). Spec T-179 không còn câu tự mâu thuẫn về thẻ chọn hạng mục: H1 M3 nói thẻ chọn áp CÙNG luật H1, nên không còn câu "không đổi lối chọn hạng mục" / "như hôm nay"
# / "không có logic không in trùng" cho thẻ chọn; còn bullet H1 về thẻ chọn; và "Lịch sử sửa" có dòng ghi việc T-183. Chạy từ gốc tohong-hq: bash eval/T-183/check_6_spec_t179_khop_h1.sh
set -u
D="$(cd "$(dirname "$0")" && pwd)"; R="$D"; while [ "$R" != "/" ] && [ ! -f "$R/scripts/gate.py" ]; do R="$(dirname "$R")"; done
F="$(ls "$R"/products/T-179-*.md 2>/dev/null | head -1)"; [ -n "$F" ] || { echo "FAIL thiếu spec T-179"; exit 1; }
grep -q 'Lối thẻ chọn hạng mục (`catId = null`): chọn một hạng mục trên thẻ chọn áp CÙNG luật H1' "$F" || { echo "FAIL mất bullet H1 M3 về thẻ chọn hạng mục"; exit 1; }
if grep -n -E 'catId = null`? không đổi|Không đổi lối chọn hạng mục|không có logic ["“]không in trùng' "$F" >/dev/null; then echo "FAIL còn câu trái H1 M3: $(grep -n -E 'catId = null`? không đổi|Không đổi lối chọn hạng mục|không có logic ["“]không in trùng' "$F" | head -2 | cut -c1-120 | tr '\n' ' ')"; exit 1; fi
sed -n '/^## Lịch sử sửa/,$p' "$F" | grep -q 'T-183' || { echo "FAIL Lịch sử sửa chưa có dòng T-183"; exit 1; }
echo PASS
