#!/usr/bin/env bash
# Khung chạy chung cho eval đối kháng T-055: chạy node trong nhóm tiến trình riêng, kill cả nhóm khi xong hoặc khi bị ngắt.
#   bash eval/T-055/lib/run.sh <file.cjs> [thư-mục-tohong-front]   (mặc định: TOHONG_FRONT_REPO hoặc cwd, như gate.py --cwd)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
JS="$HERE/$1"; REPO="${2:-${TOHONG_FRONT_REPO:-$PWD}}"
setsid node "$JS" "$REPO" & PID=$!
trap 'kill -KILL -- -$PID 2>/dev/null; exit 130' INT TERM HUP
wait $PID; CODE=$?
kill -KILL -- -$PID 2>/dev/null
exit $CODE
