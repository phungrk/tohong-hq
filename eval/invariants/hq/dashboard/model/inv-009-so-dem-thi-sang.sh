#!/usr/bin/env bash
# Nguồn: T-032 (spec products/T-032-khoi-co-viec-thi-sang.md v3, qua Spec Gate 2026-11-01, spec-critic; ADR-012, ADR-013, ADR-014).
# Bất biến: khối loại "sáng khi > 0" (Ý định, Spec Writer, Spec Gate, Spec rework, Agent code [số lớn + "N chờ"], Code rework, Code Gate, Capu) sáng khi và chỉ khi số đếm việc hiển thị > 0, đúng màu loại; khối số tích luỹ (Reservoir, Release, Production, nguồn, Insight-báo-cáo) không sáng chỉ vì số > 0.
# Chạy: bash eval/invariants/hq/dashboard/model/inv-009-so-dem-thi-sang.sh   (repo dashboard = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
# Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/model_inv.cjs" --repo "$REPO" --check count-lit
