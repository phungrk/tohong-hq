#!/usr/bin/env bash
# Adversary T-040: đổi cỡ liên tục 8 lần/30ms rồi dừng ở 390 và 1280, 320px (+phóng to), phóng to bật/tắt 5 lần, xoay 844x390, tối lúc chạy, DPR 2/3, mũi p_rework_exec ≤ 5,3px. Đo bằng MEASURE của inv-029..031.
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"; H="$(cd "$(dirname "$0")" && pwd)"
node "$H/lib/adv_probe.cjs" resize && node "$H/lib/adv_probe.cjs" 320 && node "$H/lib/adv_probe.cjs" zoomtoggle && node "$H/lib/adv_probe.cjs" darkrt && node "$H/lib/adv_probe.cjs" dpr && node "$H/lib/adv_probe.cjs" rework
