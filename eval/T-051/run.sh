#!/usr/bin/env bash
# Chạy toàn bộ eval tự động của T-051 (offline: server ảnh giả, wrangler giả). Một lệnh, in từng dòng PASS/FAIL, mã thoát 0 khi cả 10 xanh.
#   cd /home/user/tohong-hq && bash eval/T-051/run.sh --back /home/user/tohong-back --front /home/user/tohong-front --tohong /home/user/tohong
# --back/--front/--tohong: thư mục các repo (nhánh của việc). Cần: python3 + Pillow (WebP), node >= 20, Playwright toàn cục (npm root -g) cho tiêu chí 9.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
BACK=""; FRONT=""; TOHONG=""
while [ $# -gt 0 ]; do case "$1" in --back) BACK="$2"; shift 2;; --front) FRONT="$2"; shift 2;; --tohong) TOHONG="$2"; shift 2;; *) echo "FAIL tham số lạ: $1"; exit 1;; esac; done
for v in BACK FRONT TOHONG; do [ -d "${!v}" ] || { echo "FAIL thiếu --$(echo $v | tr A-Z a-z)"; exit 1; }; done
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
rc=0
for n in 1 2 3 4 5 6; do f=$(ls "$HERE"/check_${n}_*.py); printf 'C%s ' "$n"; python3 -W ignore "$f" --back "$BACK" || rc=1; done
printf 'C7 '; python3 "$HERE"/check_7_ve_sinh_repo.py --back "$BACK" --front "$FRONT" --tohong "$TOHONG" || rc=1
printf 'C8 '; python3 "$HERE"/check_8_generator.py --back "$BACK" --tohong "$TOHONG" || rc=1
printf 'C9 '; node "$HERE"/check_9_front_anh_mac_dinh.cjs "$FRONT" || rc=1
printf 'C10 '; (cd "$BACK" && npm test >/tmp/t051-back-test.log 2>&1 && echo "PASS npm test (tohong-back)" || { echo "FAIL npm test tohong-back đỏ: xem /tmp/t051-back-test.log"; exit 1; }) || rc=1
[ $rc -eq 0 ] && echo "PASS toàn bộ" || echo "FAIL có tiêu chí đỏ"
exit $rc
