#!/usr/bin/env python3
"""Bất biến hq/ledger · nguồn: T-079 inv-draft-001 phần (A) + T-082 adv-01 (Code Gate 2026-11-06). Gác theo ADR-028:
chỉ xanh khi scripts/ok_issue.py đã có trên main; đưa vào eval/invariants/hq/ledger/ sau khi PR T-082 merge.
Phần (B) (sổ cái thật) đã nằm ở inv-002.
Chỉ tài khoản phungrk (type User, chính người gửi sự kiện, action created|edited, không phải PR) tạo được `decided` qua issue:
 (A) mọi tổ hợp tác giả/loại/người gửi/action/PR khác: verdict khác decided, sổ cái và board không đổi byte nào;
 (A') login/sender trông như phungrk mà không phải chuỗi phungrk (KELVIN SIGN, Kirin, fullwidth, khoảng trắng/zero-width,
      null, kiểu không phải chuỗi): verdict ignored, reply rỗng, sổ cái không đổi (khớp toàn chuỗi, chỉ bỏ qua hoa/thường ASCII)."""
import itertools, pathlib, sys
ROOT = next(p for p in pathlib.Path(__file__).resolve().parents if (p / "scripts" / "task.py").is_file())
sys.path.insert(0, str(ROOT / "eval" / "T-079"))
from _lib import Box, payload  # noqa: E402
fails = []
B = Box()
try:
    B.new(issue=7); snap = B.snapshot()
    logins = ["mallory", "phungrk2", "github-actions[bot]", "dependabot[bot]", "someone-else"]
    for login, ut, action, pr in itertools.product(logins + ["phungrk"], ("User", "Bot", "Organization"),
                                                   ("created", "edited", "deleted"), (False, True)):
        if login == "phungrk" and ut == "User" and action in ("created", "edited") and not pr:
            continue
        r = B.ok(payload("/ok chọn A", login=login, utype=ut, action=action, pr=pr))
        if B.snapshot() != snap or r["verdict"] == "decided":
            fails.append(f"(A) {login}/{ut}/{action}/pr={pr} làm đổi sổ cái")
    for sender in logins:
        r = B.ok(payload("/ok chọn A", sender=sender, action="edited"))
        if B.snapshot() != snap or r["verdict"] == "decided":
            fails.append(f"(A) bình luận của phungrk bị {sender} sửa vẫn làm đổi sổ cái")
    look = ["phungrK", "PHUNGRK", "phungrk​", " phungrk", "phungrk ", "phungrk\n",
            "рhungrk", "ｐｈｕｎｇｒｋ", "phungrk\u0000"]
    for i, lg in enumerate(look):
        for who in ("login", "sender"):
            r = B.ok(payload("/ok chọn A", cid=5000 + 2 * i + (who == "sender"), **{who: lg}))
            if r["verdict"] != "ignored" or r["reply"] or B.snapshot() != snap:
                fails.append(f"(A') {who}={lg!r}: verdict={r['verdict']}")
                B.close(); B = Box(); B.new(issue=7); snap = B.snapshot()
    for bad in (["phungrk"], {"login": "phungrk"}, 0, None):
        p = payload("/ok chọn A", cid=6000); p["comment"]["user"]["login"] = bad
        r = B.ok(p)
        if r["verdict"] != "ignored" or B.snapshot() != snap:
            fails.append(f"(A') login kiểu {type(bad).__name__}: verdict={r['verdict']}")
finally:
    B.close()
assert not fails, "\n".join(fails[:12])
print("PASS chỉ phungrk (User, chính người gửi, created|edited, không PR, khớp toàn chuỗi) tạo được decided qua issue")
