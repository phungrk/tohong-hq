#!/usr/bin/env bash
# Bất biến công ty (ADR-011, nguồn: CLAUDE.md "Sổ cái là sự thật"): mọi file board/ đọc được bằng task.py
# và nhật ký ledger/events.jsonl là JSON hợp lệ từng dòng. Đỏ = sổ cái hỏng, không việc nào được qua cổng.
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT" || exit 1
python3 scripts/task.py summary >/dev/null 2>&1 || { echo "FAIL task.py summary lỗi: board/ có file không đọc được"; exit 1; }
python3 - <<'PY' || exit 1
import json, sys
def ok(l):
    try: json.loads(l); return True
    except Exception: return False
bad = [i for i, l in enumerate(open("ledger/events.jsonl", encoding="utf-8"), 1) if l.strip() and not ok(l)]
if bad: print(f"FAIL ledger/events.jsonl dòng không phải JSON: {bad[:5]}"); sys.exit(1)
print("PASS sổ cái đọc được")
PY
