#!/usr/bin/env bash
# Eval T-162 tiêu chí 1 (tên dài, dữ liệu biên): bọc eval/T-163/adv-02-so-do-bien.cjs (adversary). Repo trang: ${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}.
HERE="$(cd "$(dirname "$0")" && pwd)"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
export D3="${D3:-/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js}"
exec node "$HERE/../T-163/adv-02-so-do-bien.cjs"
