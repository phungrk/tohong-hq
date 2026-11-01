#!/usr/bin/env bash
# Eval đối kháng T-033 ADV-05 (noowner). Spec: products/T-032-khoi-co-viec-thi-sang.md
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$(cd "$(dirname "$0")" && pwd)/lib/adv_t033.cjs" --repo "${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}" --check noowner
