#!/usr/bin/env bash
# T-212 · khung chung: dựng bản sao tạm của tohong-back (cây làm việc của TOHONG_BACK_REPO, không đụng bản gốc) rồi sinh lại
# lib/vendorPool.generated.js + lib/vendorEnrichReport.generated.js từ ĐÚNG commit dữ liệu của tohong, theo các bước của
# .github/workflows/sync-vendor-pool.yml (offline, không Google). In ra đường dẫn bản sao ở dòng cuối: SCRATCH=<path>.
# Môi trường: TOHONG_BACK_REPO (mặc định ../tohong-back cạnh gốc HQ), TOHONG_REPO (mặc định ../tohong cạnh gốc HQ),
#   TOHONG_DATA_REF (mặc định 9c341703b3b6ec8cdffab72618bbadc5f7636b48; commit phải có sẵn trong TOHONG_REPO: git fetch origin resolve-overrides/run-44412131387).
# Chỉ đọc repo gốc (git archive, cp). Mã thoát 2 = thiếu điều kiện (không phải kết quả eval).
set -euo pipefail
H="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; HQ="$H"
while [ "$HQ" != "/" ] && [ ! -f "$HQ/scripts/gate.py" ]; do HQ="$(dirname "$HQ")"; done
BACK="${TOHONG_BACK_REPO:-$HQ/../tohong-back}"; TH="${TOHONG_REPO:-$HQ/../tohong}"
REF="${TOHONG_DATA_REF:-9c341703b3b6ec8cdffab72618bbadc5f7636b48}"
[ -f "$BACK/worker.js" ] || { echo "FAIL không thấy tohong-back (đặt TOHONG_BACK_REPO)"; exit 2; }
git -C "$TH" cat-file -e "$REF^{commit}" 2>/dev/null || { echo "FAIL tohong thiếu commit $REF (git fetch origin resolve-overrides/run-44412131387)"; exit 2; }
S="$(mktemp -d)"; mkdir "$S/back" "$S/tohong"
( cd "$BACK" && tar --exclude=./.git --exclude=./node_modules -cf - . ) | tar -xf - -C "$S/back"
ln -s "$(cd "$BACK" && pwd)/node_modules" "$S/back/node_modules"
git -C "$TH" archive "$REF" | tar -xf - -C "$S/tohong"
( cd "$S/tohong" && bash tools/regen-pool-styles.sh --back "$S/back" --photos-for all >"$S/regen.log" 2>&1 ) || { tail -5 "$S/regen.log"; echo "FAIL sinh pool lỗi"; exit 2; }
( cd "$S/back" && node tools/generate-vendor-enrich-report.js --from "$S/tohong/tools/scraper/output/HCMC/enrich-report.json" >>"$S/regen.log" 2>&1 ) || { echo "FAIL nhúng báo cáo lỗi"; exit 2; }
echo "SCRATCH=$S/back"
