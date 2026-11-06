#!/usr/bin/env python3
"""Bất biến hq/ledger · nguồn: T-079 (Spec Gate 2026-11-06, spec products/T-079-ok-tren-issue.md mục A1, A2, B1; ADR-027).
Mọi sự kiện `decided` trong ledger/events.jsonl có link tới một bình luận issue (`#issuecomment-`) phải:
  - có link đúng dạng https://github.com/phungrk/tohong-hq/issues/<n>#issuecomment-<id>,
  - có from = capu và detail không rỗng,
  - có <n> bằng trường `issue` của chính việc đó (không quyết hộ việc gắn issue khác).
Phần ma trận tác giả (chỉ phungrk, type User, chính người gửi) chạy được khi đã có scripts/ok_issue.py;
nó nằm ở eval/T-079/inv-draft-001-... và sẽ được rút vào bể sau Code Gate."""
import os, re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
os.environ.setdefault("TOHONG_ROOT", str(ROOT))
import task  # noqa: E402

LINK = re.compile(r"https://github\.com/phungrk/tohong-hq/issues/(\d+)#issuecomment-\d+")
tasks = {t["id"]: t for t in task.all_tasks()}
bad = []
for e in task.read_events():
    link = e.get("link") or ""
    if e.get("event") != "decided" or "#issuecomment-" not in link:
        continue
    m = LINK.fullmatch(link)
    why = []
    if not m: why.append("link sai dạng/kho")
    if e.get("from") != "capu": why.append(f"from={e.get('from')!r}")
    if not (e.get("detail") or "").strip(): why.append("detail rỗng")
    if m and str(tasks.get(e.get("task"), {}).get("issue", "")) != m.group(1):
        why.append(f"issue của việc {tasks.get(e.get('task'), {}).get('issue')!r} khác #{m.group(1)}")
    if why:
        bad.append(f"{e.get('id')} ({e.get('task')}): " + ", ".join(why))
if bad:
    print("FAIL sự kiện decided qua issue không hợp lệ: " + "; ".join(bad[:10])); sys.exit(1)
print("PASS mọi decided qua issue: link đúng kho, from capu, detail không rỗng, đúng issue của việc")
