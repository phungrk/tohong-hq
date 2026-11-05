#!/usr/bin/env bash
# Chạy 6 eval của T-053. Đặt EVAL_TMPDIR vào scratchpad của phiên. Mất ~12 phút (check 1 chạy 10 lần check cũ).
#   cd /home/user/tohong-hq && EVAL_TMPDIR=<scratchpad> bash eval/T-053/run.sh [--front DIR]
HERE="$(cd "$(dirname "$0")" && pwd)"; rc=0
for f in "$HERE"/check_[1-6]_*.py; do printf '%s ' "$(basename "$f")"; python3 "$f" "$@" || rc=1; done
exit $rc
