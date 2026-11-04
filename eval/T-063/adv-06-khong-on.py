#!/usr/bin/env python3
"""Tầng 3 T-063 · tổ hợp phải KHÔNG ồn / không vỡ:
 a) leo thang hai lần (escalate → decide → escalate) → hai comment leo thang, khoá khác nhau, cả hai gán Capu
 b) evalplus, reject --kind code, reject --kind spec, handoff, started → không sinh comment nào (ADR: chỉ 4 mốc)
 c) chạy lại khi mất state (marker đã trên issue) → 0 comment mới
 d) việc có sự kiện trong ledger nhưng board/T-xxx.md đã bị xoá → bỏ qua, không lỗi
 e) done bậc C qua adversary → gán Capu, không đóng; done bậc A qua adversary → ③ ④ và đóng
Chạy với GitHub giả, không mạng."""
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from _advlib import Ledger, posted, patched
import re, shutil
L = Ledger()
try:
    t = L.task
    t("new", "--title", "esc", "--to", "engineering", "--tier", "B", "--area", "hq/ledger", "--issue", "1", "--criteria", "c", "--eval", "true", "--by", "chief-of-staff")
    t("start", "T-001", "--by", "engineering"); t("escalate", "T-001", "--by", "engineering", "--note", "q1")
    t("decide", "T-001", "--note", "làm tiếp"); t("escalate", "T-001", "--by", "engineering", "--note", "q2")
    t("new", "--title", "noisy", "--to", "engineering", "--tier", "B", "--area", "hq/ledger", "--issue", "2", "--criteria", "c", "--eval", "true", "--by", "chief-of-staff")
    t("start", "T-002", "--by", "engineering"); t("handoff", "T-002", "--by", "engineering")
    t("evalplus", "T-002", "--by", "adversary", "--eval", "x.py", "--note", "n")
    t("handoff", "T-002", "--by", "engineering"); t("reject", "T-002", "--by", "adversary", "--kind", "code", "--against", "e")
    t("handoff", "T-002", "--by", "engineering"); t("reject", "T-002", "--by", "adversary", "--kind", "spec", "--against", "INV-1")
    t("new", "--title", "c", "--to", "engineering", "--tier", "C", "--area", "hq/ledger", "--issue", "3", "--criteria", "c", "--eval", "true", "--by", "chief-of-staff")
    t("start", "T-003", "--by", "engineering"); t("handoff", "T-003", "--by", "engineering"); t("accept", "T-003", "--by", "adversary", "--note", "ok")
    t("new", "--title", "a", "--to", "engineering", "--tier", "A", "--area", "hq/ledger", "--issue", "4", "--criteria", "c", "--eval", "true", "--by", "chief-of-staff")
    t("start", "T-004", "--by", "engineering"); t("handoff", "T-004", "--by", "engineering"); t("accept", "T-004", "--by", "adversary", "--note", "ok")
    t("new", "--title", "gone", "--to", "engineering", "--tier", "A", "--area", "hq/ledger", "--issue", "5", "--criteria", "c", "--eval", "true", "--by", "chief-of-staff")
    (L.tmp / "board" / "T-005.md").unlink()
    rc, out, calls = L.mirror()
    assert rc == 0, out
    b1 = posted(calls, "1"); keys = [re.match(r"<!-- tohong-mirror:(\S+) -->", b).group(1) for b in b1]
    assert sum("Leo thang" in b for b in b1) == 2 and len(set(keys)) == len(keys), f"a) leo thang: {keys}"
    assert sum(p.get("assignees") == ["capu-login"] for p in patched(calls, "1")) == 2, "a) không gán Capu đủ hai lần"
    b2 = posted(calls, "2"); assert len(b2) == 1 and "①" in b2[0], f"b) sự kiện ngoài 4 mốc sinh comment: {b2}"
    p3 = patched(calls, "3"); assert not any(x.get("state") == "closed" for x in p3) and any(x.get("assignees") == ["capu-login"] for x in p3), f"e) C: {p3}"
    b4 = posted(calls, "4"); assert any("③" in b for b in b4) and any("④" in b for b in b4) and any(x.get("state") == "closed" for x in patched(calls, "4")), f"e) A: {b4}"
    assert not posted(calls, "5"), "d) board đã xoá vẫn phản chiếu"
    # c) mất state, issue đã có marker
    shutil.rmtree(L.tmp / "state"); (L.tmp / "state").mkdir(); (L.tmp / "gh" / "calls.json").unlink()
    rc, out, calls2 = L.mirror()
    assert rc == 0 and not [c for c in calls2 if c["method"] != "GET"], f"c) chạy lại ghi trùng: {calls2}"
    print("PASS không ồn, không trùng, board mất không vỡ")
finally:
    L.close()
