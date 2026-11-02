#!/usr/bin/env bash
# Adversary T-040: 11 bot (dữ liệu BUSY của inv char) ở 1280/390/phóng to/320, đo lúc 0, 4s, 8s và sau đổi cỡ: mũi không đè bot, không che chữ.
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"; H="$(cd "$(dirname "$0")" && pwd)"
node "$H/lib/adv_busy.cjs"
