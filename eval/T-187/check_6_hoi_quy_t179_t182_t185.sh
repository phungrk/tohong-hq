#!/usr/bin/env bash
# T-187 tiêu chí 6: đổi dấu số tiền KHÔNG phá hành vi đã có. Chạy lại trên cùng tohong-front: mọi eval front của T-179 (check_1..11), T-182 (adv-01..06), T-185 (check_1..8), cộng hai eval "chữ back giữ nguyên nguyên văn":
# T-167 check_4 (dòng phép so của back in nguyên văn) và T-178 check_4 (chip back "≈ 3.9tr/bàn × …" in nguyên văn, front không viết lại chữ của back).
# Chạy từ gốc tohong-hq: bash eval/T-187/check_6_hoi_quy_t179_t182_t185.sh [--repo <tohong-front>]   (biến TOHONG_FRONT_REPO, PLAYWRIGHT_PATH, T187_JOBS = số eval chạy song song, mặc định 3). In PASS hoặc FAIL <eval>.
set -u
D="$(cd "$(dirname "$0")" && pwd)"; R="$D"; while [ "$R" != "/" ] && [ ! -f "$R/scripts/gate.py" ]; do R="$(dirname "$R")"; done
LIST="$(cd "$R/eval" && ls T-179/check_*.cjs T-182/adv-*.cjs T-185/check_*.cjs T-167/check_4_*.cjs T-178/check_4_*.cjs 2>/dev/null)"
OUT="$(mktemp -d)"; trap 'rm -rf "$OUT"' EXIT
run() { f="$1"; shift; out="$(node "$R/eval/$f" "$@" 2>&1 | tail -1)"; case "$out" in PASS) ;; *) echo "FAIL $f: $out" > "$OUT/$(echo "$f" | tr '/' '_').fail";; esac; }
export -f run 2>/dev/null; export R OUT
printf '%s\n' $LIST | xargs -P "${T187_JOBS:-3}" -I{} bash -c 'run "$@"' _ {} "$@"
if ls "$OUT"/*.fail >/dev/null 2>&1; then cat "$OUT"/*.fail | head -3; exit 1; fi
echo PASS
