#!/usr/bin/env bash
# Eval đối kháng tầng 3 T-116: xem lib/adv01_ui.cjs.
# Repo front: tham số 1, rồi TOHONG_FRONT_REPO, rồi thư mục hiện tại nếu là tohong-front (gate.py chạy với --cwd), rồi /home/user/tohong-front.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
FRONT="${1:-${TOHONG_FRONT_REPO:-}}"
if [ -z "$FRONT" ]; then
  if [ -f "$PWD/package.json" ] && [ -f "$PWD/src/vendorIllustrations.jsx" ]; then FRONT="$PWD"; else FRONT=/home/user/tohong-front; fi
fi
[ -f "$FRONT/package.json" ] || { echo "FAIL không thấy tohong-front ở $FRONT"; exit 1; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/adv01_ui.cjs" --repo "$(cd "$FRONT" && pwd)"
