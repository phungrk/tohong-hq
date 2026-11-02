#!/usr/bin/env bash
# Nguồn: T-037 (spec products/T-037-bam-nhan-vat-tom-tat.md v2, ADR-017, qua Spec Gate 2026-11-01, spec-critic).
# Bất biến: dù dữ liệu việc hay sự kiện live có detail, link, ghi chú, defect, không chữ nào trong #fx_s và #model-sum-live chứa chúng (dashboard là trang công khai).
# Áp dụng từ khi T-037 vào (trang có #model-sum-live hoặc repo có docs/screenshots/T-037/); trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/model/inv-024-tom-tat-khong-ro.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
# Cần Playwright (NODE_PATH từ `npm root -g`) và d3 cục bộ (biến D3).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/lib/sum_inv.cjs" --repo "$REPO" --check no-leak
