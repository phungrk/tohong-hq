#!/usr/bin/env bash
# Nguồn: T-076 (spec products/T-076-modal-viec-cho-capu.md v5, INV-P3 của Product), rút bởi adversary ở Code Gate T-078 v2 (2026-11-06).
# Bất biến (hq/dashboard):
#   (a) bản --public của scripts/export_dashboard.py xuất từ sổ cái thật: sự kiện không có detail/link; không chứa đường dẫn máy
#       (/home/, /root/, /tmp/, đường dẫn repo) hay "handoffs/"; mọi URL trong capu_queue là https://github.com/phungrk/<repo>/pull/<n>
#       hoặc link Decision Request (blob/main/inbox/capu/<file>, tree/main/inbox/capu); mỗi link đúng ba khoá label, url, pr_state;
#   (b) nạp đúng dashboard.json đó vào trang: ở Tất cả, planner, hq, mọi thẻ a trong modal Capu là a[data-capu-link] tới github.com/phungrk,
#       target=_blank, rel có noopener; số trên khối = số dòng.
# Áp dụng từ khi exporter xuất capu_queue và trang có #capu-modal (T-076/T-078 vào); trước đó PASS "chưa áp dụng".
# Chạy: bash eval/invariants/hq/dashboard/inv-009-link-capu-an-toan-cong-khai-khong-ro.sh   (repo = $TOHONG_DASHBOARD_REPO hoặc /home/user/tohong-hq-dashboard; cần NODE_PATH, D3)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../../.." && pwd)"
REPO="${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
[ -f "$ROOT/scripts/export_dashboard.py" ] || { echo "PASS chưa áp dụng: chưa có scripts/export_dashboard.py"; exit 0; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
env -u PR_READ_TOKEN -u TOHONG_ROOT python3 "$ROOT/scripts/export_dashboard.py" --out "$TMP/out" --public >/dev/null 2>"$TMP/err" || { echo "FAIL exporter --public không chạy: $(tail -1 "$TMP/err")"; exit 1; }
python3 - "$TMP/out/dashboard.json" "$ROOT" <<'PY' || exit 1
import json, re, sys
p, root = sys.argv[1], sys.argv[2]
raw = open(p, encoding="utf-8").read(); d = json.loads(raw); bad = []
if "capu_queue" not in d:
    print("PASS chưa áp dụng: dashboard.json chưa có capu_queue (T-076)"); sys.exit(0)
for s in ("/home/", "/root/", "/tmp/", root, "handoffs/"):
    if s in raw: bad.append(f"bản công khai chứa {s!r}")
ev = [e for e in d.get("events", []) if "detail" in e or "link" in e]
if ev: bad.append(f"{len(ev)} sự kiện công khai còn detail/link")
OK = re.compile(r"^https://github\.com/phungrk/[\w.-]+/(pull/\d+|blob/main/inbox/capu/[^/?#]+|tree/main/inbox/capu)$")
for e in d["capu_queue"]:
    for l in e.get("links", []):
        if set(l) != {"label", "url", "pr_state"}: bad.append(f"{e.get('task')}: link khoá lạ {sorted(l)}")
        if not OK.match(l.get("url", "")): bad.append(f"{e.get('task')}: url ngoài github.com/phungrk {l.get('url')!r}")
for b in bad: print("FAIL " + b)
print(f"{'FAIL' if bad else 'PASS'} (a) bản công khai: {len(d['capu_queue'])} phần tử capu_queue, {len(d.get('events', []))} sự kiện")
sys.exit(1 if bad else 0)
PY
grep -q '"capu_queue"' "$TMP/out/dashboard.json" || exit 0
exec node "$HERE/lib/link_capu_inv.cjs" --repo "$REPO" --data "$TMP/out/dashboard.json"
