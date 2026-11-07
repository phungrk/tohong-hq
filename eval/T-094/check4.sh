#!/usr/bin/env bash
# Eval tiêu chí 4 của T-094: INV-009 (hq/dashboard: bản công khai không rò) và INV-017 (hq/dashboard: số bể khớp file thật) xanh trên bể thật.
# INV-009 cần D3 (đường dẫn d3.min.js, biến môi trường D3) và node; thiếu D3 thì in FAIL. INV-017 ở bể (nếu đã merge) hoặc ở eval/T-092/bat-bien-cho-merge/.
# Chạy: cd /home/user/tohong-hq && D3=/đường/dẫn/d3.min.js bash eval/T-094/check4.sh      In PASS hoặc FAIL <lý do>; mã thoát 0/1.
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"; bad=""
# D3: biến môi trường, hoặc tự tìm d3.min.js ở các chỗ quen (INV-009 cần)
if [ -z "${D3:-}" ] || [ ! -f "$D3" ]; then for c in /tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js "$ROOT"/../tohong-hq-dashboard/d3.min.js; do [ -f "$c" ] && export D3="$c" && break; done; fi
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
o=$(bash "$ROOT"/eval/invariants/hq/dashboard/inv-009-*.sh 2>&1); [ $? -eq 0 ] || bad="$bad INV-009: $(echo "$o" | tail -1);"
f=$(ls "$ROOT"/eval/invariants/hq/dashboard/inv-017-*.py "$ROOT"/eval/T-092/bat-bien-cho-merge/inv-017-*.py 2>/dev/null | head -1)
if [ -z "$f" ]; then bad="$bad không thấy INV-017;"; else o=$(python3 "$f" 2>&1); [ $? -eq 0 ] || bad="$bad INV-017: $(echo "$o" | tail -1);"; fi
if [ -n "$bad" ]; then echo "FAIL$bad"; exit 1; fi; echo PASS
