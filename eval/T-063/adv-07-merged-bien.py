#!/usr/bin/env python3
"""Tầng 3 T-063 · lệnh `merged` ở biên:
 a) merged cho việc CHƯA done (doing) → task.py từ chối (rc≠0), sổ cái không thêm sự kiện, issue không có ④
 b) merged hai lần cho việc bậc C done → đúng MỘT comment ④ trên issue (mốc ④ không lặp), issue đóng
 c) merged cho việc bậc A done (đã ③④ + đóng khi accept) → không sinh thêm ④
 d) merged --by engineering → từ chối
Mong đợi theo ADR-012 bổ sung + tiêu chí 2, 4. GitHub giả, không mạng."""
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _advfail import Ledger, new, posted, patched
L = Ledger()
try:
    t = L.task
    new(L, 1, 7, "C"); t("start", "T-001", "--by", "engineering")
    ev = (L.tmp / "ledger" / "events.jsonl").read_text()
    r = t("merged", "T-001", "--by", "capu", "--link", "https://github.com/o/r/pull/1", ok=False)
    assert r.returncode != 0, "a) merged cho việc doing được nhận"
    assert (L.tmp / "ledger" / "events.jsonl").read_text() == ev, "a) merged bị từ chối nhưng vẫn ghi sổ cái"
    r = t("merged", "T-001", "--by", "engineering", "--link", "x", ok=False)
    assert r.returncode != 0, "d) merged --by engineering được nhận"
    t("handoff", "T-001", "--by", "engineering"); t("accept", "T-001", "--by", "adversary", "--note", "ok")
    rc, out, calls = L.mirror(); assert rc == 0, out
    assert not any("④" in b for b in posted(calls, "7")), "a) bậc C chưa merged đã có ④"
    t("merged", "T-001", "--by", "capu", "--link", "https://github.com/o/r/pull/1")
    t("merged", "T-001", "--by", "chief-of-staff", "--link", "https://github.com/o/r/pull/1")
    L.reset_calls(); rc, out, calls = L.mirror(); assert rc == 0, out
    b = posted(calls, "7")
    assert sum("④" in x for x in b) == 1, f"b) merged hai lần → {sum('④' in x for x in b)} comment ④"
    assert any(p.get("state") == "closed" for p in patched(calls, "7")), "b) bậc C merged không đóng issue"
    new(L, 2, 8, "A"); t("start", "T-002", "--by", "engineering"); t("handoff", "T-002", "--by", "engineering")
    t("accept", "T-002", "--by", "adversary", "--note", "ok")
    t("merged", "T-002", "--by", "chief-of-staff", "--link", "https://github.com/o/r/pull/2")
    L.reset_calls(); rc, out, calls = L.mirror(); assert rc == 0, out
    assert sum("④" in x for x in posted(calls, "8")) == 1, f"c) bậc A: {posted(calls, '8')}"
    print("PASS merged: từ chối khi chưa done/sai người, hai lần chỉ một ④, bậc A không thêm ④")
finally:
    L.close()
