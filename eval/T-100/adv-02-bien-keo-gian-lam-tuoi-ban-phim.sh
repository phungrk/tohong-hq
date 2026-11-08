#!/usr/bin/env bash
# Eval đối kháng T-100 (adversary, tầng 3): biên kéo giãn, localStorage hỏng, đổi cỡ khi đang mở, làm tươi co/giãn danh sách, Home/End trên tab đang chọn, vòng Tab (spec T-096 mục B, C, D, E).
# Chạy: bash eval/T-100/adv-02-bien-keo-gian-lam-tuoi-ban-phim.sh [--only A,B,C,D,E,F]
# Biến: TOHONG_DASHBOARD_REPO (mặc định /home/user/tohong-hq-dashboard), D3 (mặc định d3 trong scratchpad như eval T-096), NODE_PATH (mặc định npm root -g).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
export D3="${D3:-/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js}"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/adv-02-bien-keo-gian-lam-tuoi-ban-phim.cjs" "$@"
