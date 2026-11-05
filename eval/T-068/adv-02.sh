#!/usr/bin/env bash
# Eval đối kháng T-068 (adversary): M5 + checklist C6: hạng mục lạ (reserve, mc, rỗng, undefined, null, constructor, __proto__, toString...) ra cùng minh hoạ chung.
# Chi tiết và cách đo: eval/T-068/_advlib.cjs (case generic). Repo front: $1, rồi TOHONG_FRONT_REPO, rồi ../tohong-front cạnh tohong-hq.
# Chạy: cd /home/user/tohong-hq && bash eval/T-068/adv-02.sh [/home/user/tohong-front]
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
HQ="$(cd "$HERE/../.." && pwd)"
FRONT="${1:-${TOHONG_FRONT_REPO:-$HQ/../tohong-front}}"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/_advlib.cjs" --repo "$FRONT" --case generic
