#!/usr/bin/env bash
# Eval đối kháng T-038 (adversary, 2026-11-02). Spec products/T-037-bam-nhan-vat-tom-tat.md mục 3 ("sum-bg không chồng lên thân bot
# của chính nhân vật đó, ≤ 0,5u") và mục 6 ("nhân vật đang give/take vẫn bấm được; cử động không đổi"): tóm tắt đang mở, có dot tới khối
# làm nhân vật 'take' (nhảy -9 đơn vị cục bộ ≈ 20u) hoặc 'give': ở mọi khung, sum-bg không đè thân bot đo tại khung đó (390, 1280).
# Tầng 1 (C4) và inv-026 chỉ đo lúc nhân vật đứng yên. Kèm: xss (tên có thẻ/emoji), rapid (bấm dồn 11 nhân vật), esc (Esc x5).
# Chạy: bash eval/T-038/adv-01.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html, hoặc /home/user/tohong-hq-dashboard)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && grep -q 'id="model"' "$PWD/index.html" && REPO="$PWD" || REPO=/home/user/tohong-hq-dashboard; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
rc=0
for c in motion xss rapid esc; do node "$HERE/lib/adv_sum.cjs" --repo "$REPO" --check "$c" || rc=1; done
exit $rc
