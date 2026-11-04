#!/usr/bin/env bash
# adv-03 (T-055): máy có thanh cuộn cổ điển chiếm chỗ: mở/đóng lớp không làm khung và nội dung nền dịch ngang; lớp phủ khớp khung. Spec T-054 mục 5.1, 5.2, 5.4, 7.3.
exec bash "$(cd "$(dirname "$0")" && pwd)/lib/run.sh" 03-thanh-cuon-co-dien.cjs "${1:-}"
