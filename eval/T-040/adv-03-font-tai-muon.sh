#!/usr/bin/env bash
# Adversary T-040: font "Be Vietnam Pro" tải muộn 2,5s (thay bằng DejaVu Sans Mono, rộng hơn): nhãn rộng ra sau khi mũi đã dựng; mũi vẫn không che chữ ở 1280 và 390.
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"; H="$(cd "$(dirname "$0")" && pwd)"
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf node "$H/lib/adv_probe.cjs" font
