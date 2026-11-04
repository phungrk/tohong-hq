#!/usr/bin/env bash
# adv-05 (T-055): Onboarding khoá nền; mở sâu #/ngan-sach/<id> rồi tải lại; Tab không vào khối gợi ý đang ẩn hay màn ẩn; 320px không cuộn ngang ở trang con và khi lớp mở. Spec T-054 mục 1, 2.1, 3.1, 4.7, 5.1, 7.2, 8.5.
exec bash "$(cd "$(dirname "$0")" && pwd)/lib/run.sh" 05-onboarding-mo-sau-tab-320.cjs "${1:-}"
