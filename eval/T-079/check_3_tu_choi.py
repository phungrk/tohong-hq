#!/usr/bin/env python3
"""T-079 tiêu chí 3: bình luận từ tài khoản khác/bot, hoặc việc không chờ quyết, hoặc nội dung rỗng -> sổ cái và board KHÔNG đổi.
Im lặng (reply rỗng) khi không phải phungrk thật gõ /ok đúng cú pháp; từ chối có lý do khi phungrk gõ /ok mà không ghi được."""
import sys, pathlib, re
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _lib import Box, payload
RO = "Chưa ghi gì vào sổ cái"
# (tên, payload, verdict mong đợi, reply: "" = im lặng, "no" = từ chối có lý do)
SILENT = [
    ("tài khoản khác", payload("/ok chọn A", login="mallory"), ),
    ("bot Actions", payload("/ok chọn A", login="github-actions[bot]", utype="Bot"), ),
    ("login phungrk nhưng type Bot", payload("/ok chọn A", utype="Bot"), ),
    ("tên gần giống", payload("/ok chọn A", login="phungrk2"), ),
    ("tên gần giống 2", payload("/ok chọn A", login="phungr"), ),
    ("người khác SỬA bình luận của phungrk", payload("/ok chọn A", action="edited", sender="mallory"), ),
    ("bình luận trên pull request", payload("/ok chọn A", pr=True), ),
    ("action deleted", payload("/ok chọn A", action="deleted"), ),
    ("không phải lệnh: 'ok'", payload("ok chọn A"), ),
    ("không phải lệnh: '/okay'", payload("/okay chọn A"), ),
    ("không phải lệnh: '/ok2'", payload("/ok2 chọn A"), ),
    ("không phải lệnh: '//ok'", payload("//ok chọn A"), ),
    ("không phải lệnh: lệnh cũ /quyet", payload("/quyet chọn A"), ),
    ("lệnh không ở dòng đầu", payload("chào\n/ok chọn A"), ),
    ("trích dẫn", payload("> /ok chọn A"), ),
    ("giữa câu", payload("anh nghĩ /ok chọn A"), ),
    ("thân rỗng", payload(""), ),
]
REFUSE = [
    ("nội dung rỗng", payload("/ok"), "empty"),
    ("nội dung toàn khoảng trắng", payload("/ok   \n \t \n"), "empty"),
    ("quá dài (>2000 ký tự)", payload("/ok " + "a" * 2001), "too_long"),
    ("issue không gắn việc nào", payload("/ok chọn A", issue=99), "no_task"),
]
fails = []
def fresh(tid_state=None):
    B = Box(); tid = B.new(issue=7)
    return B, tid
for name, p in SILENT:
    B, tid = fresh()
    try:
        before = B.snapshot(); r = B.ok(p)
        if B.snapshot() != before: fails.append(f"{name}: sổ cái/board đổi")
        if r["verdict"] not in ("ignored", "rejected") or r["reply"] != "":
            fails.append(f"{name}: phải im lặng (verdict ignored, reply rỗng), nhận verdict={r['verdict']} reply={r['reply'][:60]!r}")
    finally: B.close()
for name, p, reason in REFUSE:
    B, tid = fresh()
    try:
        before = B.snapshot(); r = B.ok(p)
        if B.snapshot() != before: fails.append(f"{name}: sổ cái/board đổi")
        if r["verdict"] != "rejected" or r["reason"] != reason:
            fails.append(f"{name}: verdict={r['verdict']} reason={r['reason']}, mong rejected/{reason}")
        elif not re.match(r"<!-- tohong-ok:1001:rejected-%s -->" % reason, r["reply"]) or RO not in r["reply"]:
            fails.append(f"{name}: câu từ chối thiếu marker 'tohong-ok:1001:rejected-{reason}' hoặc cụm '{RO}'")
    finally: B.close()
# việc không ở trạng thái chờ quyết
for st in ("doing", "blocked", "done", "review"):
    B = Box()
    try:
        tid = B.new(issue=7, escalate=False)
        if st == "doing": B.task("start", tid, "--by", "product")
        elif st == "blocked": B.task("block", tid, "--by", "product", "--note", "Chờ Capu: làm gì đó")
        elif st == "review":
            B.task("start", tid, "--by", "product"); B.task("handoff", tid, "--by", "product", "--eval", "true")
        elif st == "done":
            B.task("escalate", tid, "--by", "chief-of-staff", "--note", "q"); B.task("decide", tid, "--close", "--note", "bỏ")
        before = B.snapshot(); r = B.ok(payload("/ok chọn A"))
        if B.snapshot() != before: fails.append(f"việc {st}: sổ cái/board đổi")
        if r["verdict"] != "rejected" or r["reason"] != "not_escalated" or RO not in r["reply"]:
            fails.append(f"việc {st}: mong rejected/not_escalated + '{RO}', nhận {r['verdict']}/{r['reason']}")
    finally: B.close()
# hai việc cùng gắn issue 7 và cùng đang chờ quyết: không đoán
B = Box()
try:
    B.new(issue=7); B.new(issue=7)
    before = B.snapshot(); r = B.ok(payload("/ok chọn A"))
    if B.snapshot() != before or r["verdict"] != "rejected" or r["reason"] != "ambiguous":
        fails.append(f"hai việc cùng issue cùng chờ quyết: mong rejected/ambiguous và sổ cái không đổi, nhận {r['verdict']}/{r['reason']}")
finally: B.close()
# một việc có issue 7 đang chờ quyết + một việc khác cùng issue đã doing: chọn đúng việc chờ quyết
B = Box()
try:
    a = B.new(issue=7, escalate=False); B.task("start", a, "--by", "product")
    b = B.new(issue=7)
    r = B.ok(payload("/ok chọn A"))
    if r["verdict"] != "decided" or r["task"] != b:
        fails.append(f"phải chọn việc đang chờ quyết {b}, nhận {r['verdict']}/{r['task']}")
finally: B.close()
assert not fails, "\n".join(fails)
print(f"PASS {len(SILENT)+len(REFUSE)+6} ca bị từ chối/bỏ qua: sổ cái không đổi; im lặng với người lạ, từ chối có lý do với phungrk")
