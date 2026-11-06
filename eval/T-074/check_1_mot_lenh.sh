#!/usr/bin/env bash
# T-074 tiêu chí 1: một lệnh in tỉ lệ trùng top 5 theo từng hạng mục và kết thúc bằng PASS/FAIL. Chạy với nhãn mẫu.
cd "$(dirname "$0")/../.." || exit 1
out=$(node eval/T-074/match_eval.mjs --labels eval/T-074/labels.sample.json 2>&1); code=$?
for c in photography makeup attire venue; do
  echo "$out" | grep -E "^$c +[0-9]+ +[0-9]+/[0-9]+ +[0-9]+(\.[0-9])?%" >/dev/null || { echo "FAIL thiếu dòng tỉ lệ % của hạng mục $c"; echo "$out" | tail -5; exit 1; }
done
last=$(echo "$out" | grep -v '^$' | tail -1)
case "$last" in PASS*|FAIL*) ;; *) echo "FAIL dòng cuối phải bắt đầu PASS hoặc FAIL, đang là: $last"; exit 1;; esac
[ "$code" -eq 1 ] && [ "${last%% *}" = FAIL ] || { echo "FAIL nhãn mẫu không được cho kết quả đạt (mã thoát $code, dòng cuối: $last)"; exit 1; }
echo "PASS một lệnh in tỉ lệ 4 hạng mục, dòng cuối: $last"
