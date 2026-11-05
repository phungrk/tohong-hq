#!/usr/bin/env bash
# Chạy toàn bộ eval T-058 (offline). cd /home/user/tohong-hq && bash eval/T-058/run.sh --back /home/user/tohong-back
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; BACK=""
while [ $# -gt 0 ]; do case "$1" in --back) BACK="$2"; shift 2;; *) echo "FAIL tham số lạ: $1"; exit 1;; esac; done
[ -d "$BACK" ] || { echo "FAIL thiếu --back"; exit 1; }
rc=0
LOG="$(mktemp -d)"; trap 'rm -rf "$LOG"' EXIT
for f in "$HERE"/check_*.py; do printf '%s ' "$(basename "$f")"; python3 -I -W ignore "$f" --back "$BACK" || rc=1; done
printf 'npm test '; (cd "$BACK" && npm test >"$LOG/npm.log" 2>&1 && echo "PASS" || { echo "FAIL npm test đỏ: xem log npm (bị xoá khi thoát; chạy lại npm test để xem)"; exit 1; }) || rc=1
[ $rc -eq 0 ] && echo "PASS toàn bộ" || echo "FAIL có tiêu chí đỏ"; exit $rc
