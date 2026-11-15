#!/usr/bin/env bash
# T-169 tiêu chí 7. KHÔNG HỒI QUY: chuẩn hoá hồ sơ không đổi những gì đã chốt: (1) INV-005 số khách hiệu lực (ADR-094: bảng guests > 0 thắng, seed 0 = không có),
# (2) T-167 check_3 (couple.wedding_date thắng khi lệch, trường nguồn trong profileSnapshot), (3) T-159 check_6 (nguồn bảng dùng số người dùng thấy), (4) bộ test của tohong-back xanh (`npm test`).
# Chạy từ gốc tohong-hq. Biến: TOHONG_BACK_REPO (mặc định ../tohong-back).
set -u
HQ="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$HQ" || exit 1
BACK="${TOHONG_BACK_REPO:-$HQ/../tohong-back}"
bad=""
run() { local n="$1"; shift; local out last; out="$("$@" 2>&1)"; local rc=$?; last="$(printf '%s' "$out" | tail -1)"; [ $rc -ne 0 ] && bad="$bad [$n: ${last:0:200}]"; return 0; }
run inv-005 bash eval/invariants/planner/vendor/inv-005-mot-so-khach-hieu-luc-tab-chat-seed.sh
run T-167-check_3 node eval/T-167/check_3_so_server_dung_khong_lo_cap_doi_khac.mjs
run T-159-check_6 bash eval/T-159/check_6_nguon_bang_dung_so_nguoi_dung_thay.sh
if [ -f "$BACK/package.json" ]; then run test-back bash -c "cd '$BACK' && npm test --silent"; else bad="$bad [thiếu tohong-back]"; fi
if [ -n "$bad" ]; then echo "FAIL$bad"; exit 1; fi
echo PASS
