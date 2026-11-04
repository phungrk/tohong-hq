#!/usr/bin/env bash
# adv-04 (T-055): sheet vendor ở Ngân sách khoá nền và trả đúng vị trí (chạm lớp tối, Back); Back/Forward liên tiếp không chờ giữ đúng vị trí nhớ. Spec T-054 mục 4.2, 4.3, 5.
exec bash "$(cd "$(dirname "$0")" && pwd)/lib/run.sh" 04-sheet-vendor-va-back-nhanh.cjs "${1:-}"
