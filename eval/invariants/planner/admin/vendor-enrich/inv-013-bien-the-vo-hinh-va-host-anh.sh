#!/usr/bin/env bash
# Bất biến planner/admin/vendor-enrich (ADR-088), nguồn eval/T-157/adv-05-bien-the-vo-hinh-va-host (adversary T-157, xanh trên main sau tohong-back#56).
# Dò gốc tohong-hq ngược tới scripts/gate.py (ADR-070) rồi chạy bản gốc trong eval/T-157/lib (phụ thuộc eval/T-152/lib).
set -u
d="$(cd "$(dirname "$0")" && pwd)"; while [ "$d" != "/" ] && [ ! -f "$d/scripts/gate.py" ]; do d="$(dirname "$d")"; done
exec node "$d/eval/T-157/lib/adv-05-bien-the-vo-hinh-va-host.mjs" "$@"
