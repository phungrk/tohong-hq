#!/usr/bin/env bash
# adv-01 (T-055): ngưỡng 8px tính từ chỗ đổi hướng (M3) và mở lớp khi khối gợi ý chiếm chỗ ở cuối trang (M4). Spec T-054 mục 8.2, 8.3, 5.1.
exec bash "$(cd "$(dirname "$0")" && pwd)/lib/run.sh" 01-goi-y-nguong-va-khoa.cjs "${1:-}"
