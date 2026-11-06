#!/usr/bin/env bash
# T-074 tiêu chí 6: chưa có nhãn thật thì FAIL rõ ràng (không PASS, không im lặng); nhãn mẫu không bao giờ cho PASS.
cd "$(dirname "$0")/../.." || exit 1
out=$(node eval/T-074/match_eval.mjs --labels /nonexistent/t074-labels.json 2>&1); code=$?
last=$(echo "$out" | grep -v '^$' | tail -1)
[ "$code" -eq 1 ] || { echo "FAIL thiếu nhãn mà mã thoát là $code"; exit 1; }
case "$last" in "FAIL chưa có nhãn thật"*) ;; *) echo "FAIL dòng cuối chưa nói rõ 'chưa có nhãn thật': $last"; exit 1;; esac
if [ ! -f eval/T-074/labels.json ]; then
  out=$(node eval/T-074/match_eval.mjs 2>&1); code=$?; last=$(echo "$out" | grep -v '^$' | tail -1)
  [ "$code" -eq 1 ] && case "$last" in "FAIL chưa có nhãn thật"*) true;; *) false;; esac || { echo "FAIL chạy mặc định khi chưa có labels.json phải FAIL rõ: $last"; exit 1; }
fi
echo "PASS thiếu nhãn thật thì FAIL rõ: $last"
