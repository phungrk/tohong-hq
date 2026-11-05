#!/usr/bin/env bash
# Eval đối kháng T-068 (adversary): M4: ô < 80px phải có tooltip khi rê chuột (title của phần tử trúng chuột = aria-label), bề mặt 3/4/5.
# Chi tiết và cách đo: eval/T-068/_advlib.cjs (case tooltip). Repo front: $1, rồi TOHONG_FRONT_REPO, rồi ../tohong-front cạnh tohong-hq.
# Chạy: cd /home/user/tohong-hq && bash eval/T-068/adv-01.sh [/home/user/tohong-front]
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
HQ="$(cd "$HERE/../.." && pwd)"
FRONT="${1:-${TOHONG_FRONT_REPO:-$HQ/../tohong-front}}"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/_advlib.cjs" --repo "$FRONT" --case tooltip
