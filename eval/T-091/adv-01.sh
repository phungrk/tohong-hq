#!/usr/bin/env bash
# T-091 adv-01: K6 qua Cảnh báo + không tự cuộn, K5 làm tươi dữ liệu/việc rời Xong ở limit 10, hoà phút id khác chữ số, focus bàn phím.
# cd /home/user/tohong-hq && bash eval/T-091/adv-01.sh   (cần D3, Playwright; ~3 phút)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/adv-01.cjs"
