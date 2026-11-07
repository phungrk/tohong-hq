#!/usr/bin/env bash
# T-091 adv-02: K7 không cuộn ngang ở 390/320px khi hiện hết thẻ, tiêu đề dài không dấu cách.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/adv-02.cjs"
