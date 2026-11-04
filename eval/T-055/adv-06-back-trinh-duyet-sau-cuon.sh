#!/usr/bin/env bash
# adv-06 (T-055): lăn chuột rồi bấm Back/Forward của trình duyệt (không qua history.* của trang) sau 16/60/250ms: cả hai trang về đúng vị trí ở mọi khung hình. Spec T-054 mục 4.1, 4.2.
exec bash "$(cd "$(dirname "$0")" && pwd)/lib/run.sh" 06-back-trinh-duyet-sau-cuon.cjs "${1:-}"
