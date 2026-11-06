#!/usr/bin/env python3
import sys
def _h(t,v,tb):
    print("FAIL "+" | ".join(str(v).splitlines()[:12])); sys.exit(1)
sys.excepthook=_h
"""BẤT BIẾN ĐỀ XUẤT hq/ledger (Spec critic rút vào bể khi spec T-079 qua cổng; file này là bản nháp chạy được).
Chỉ tài khoản phungrk (type User, và là người gửi sự kiện) mới tạo được sự kiện `decided` qua issue.
 (A) mọi tổ hợp tác giả/loại/người gửi/action/PR khác ngoài phungrk-User-created|edited: sổ cái và board không đổi byte nào;
 (B) trên sổ cái thật: mọi `decided` có link dạng …/issues/<n>#issuecomment-<id> phải có from=capu, detail không rỗng, link thuộc phungrk/tohong-hq,
     <n> bằng trường issue của việc đó (không quyết hộ việc của issue khác)."""
import itertools, json, re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _lib import Box, payload, ROOT
fails = []
# (B) sổ cái thật
tasks = {}
import os; os.environ.setdefault("TOHONG_ROOT", str(ROOT)); sys.path.insert(0, str(ROOT / "scripts")); import task
for t in task.all_tasks(): tasks[t["id"]] = t
for e in task.read_events():
    m = re.fullmatch(r"https://github\.com/phungrk/tohong-hq/issues/(\d+)#issuecomment-\d+", e.get("link") or "")
    if e.get("event") == "decided" and "#issuecomment-" in (e.get("link") or ""):
        if not m or e.get("from") != "capu" or not (e.get("detail") or "").strip() or tasks.get(e["task"], {}).get("issue") != m.group(1):
            fails.append(f"(B) sự kiện {e.get('id')} ({e['task']}) quyết qua issue không hợp lệ")
# (A) ma trận
logins = ["mallory", "phungrk2", "github-actions[bot]", "dependabot[bot]", "someone-else"]
B = Box()
try:
    B.new(issue=7); snap = B.snapshot()
    for login, ut, action, pr in itertools.product(logins + ["phungrk"], ("User", "Bot", "Organization"), ("created", "edited", "deleted"), (False, True)):
        legit = login == "phungrk" and ut == "User" and action in ("created", "edited") and not pr
        if legit: continue
        r = B.ok(payload("/ok chọn A", login=login, utype=ut, action=action, pr=pr))
        if B.snapshot() != snap or r["verdict"] == "decided": fails.append(f"(A) {login}/{ut}/{action}/pr={pr} làm đổi sổ cái")
    for sender in logins:
        r = B.ok(payload("/ok chọn A", sender=sender, action="edited"))
        if B.snapshot() != snap or r["verdict"] == "decided": fails.append(f"(A) bình luận của phungrk bị {sender} sửa vẫn làm đổi sổ cái")
finally:
    B.close()
assert not fails, "\n".join(fails[:10])
print("PASS chỉ phungrk (User, chính người gửi) tạo được decided qua issue; sổ cái thật không có decided qua issue sai")
