#!/usr/bin/env python3
"""T-079 tiêu chí 2: `/ok <nội dung>` từ phungrk trên issue của việc đang escalated -> sổ cái có đúng 1 sự kiện decided
(from capu, detail = nội dung đã chuẩn hoá), việc về `doing` giữ bởi chủ việc, và có câu xác nhận để đăng lên issue."""
import sys, pathlib, re
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _lib import Box, payload, URL
# (thân bình luận, nội dung kỳ vọng). Chuẩn hoá: bỏ khoảng trắng đầu/cuối, mọi dãy khoảng trắng/xuống dòng -> 1 dấu cách.
CASES = [
    ("/ok chọn A", "chọn A"),
    ("/ok   chọn A,   thêm điều kiện  ", "chọn A, thêm điều kiện"),
    ("/OK chọn A", "chọn A"),
    ("/Ok chọn A", "chọn A"),
    ("  /ok chọn A", "chọn A"),
    ("/ok\nchọn A\nvà làm ngay", "chọn A và làm ngay"),
    ("/ok chọn A\r\ndòng hai", "chọn A dòng hai"),
    ("/ok\tchọn A", "chọn A"),
    ("/ok --close", "--close"),                               # chữ, không phải cờ: việc KHÔNG được đóng
    ("/ok $(touch PWNED) `id` ; rm -rf x", "$(touch PWNED) `id` ; rm -rf x"),
    ("/ok làm theo phương án B, bỏ phần phụ — vì giá", "làm theo phương án B, bỏ phần phụ — vì giá"),
]
fails = []
for body, want in CASES:
    B = Box()
    try:
        tid = B.new(issue=7)
        n0 = len(B.events())
        r = B.ok(payload(body))
        ev = B.events()
        new = ev[n0:]
        if r["verdict"] != "decided" or r["task"] != tid:
            fails.append(f"{body!r}: verdict={r['verdict']} task={r['task']} reason={r['reason']}"); continue
        if len(new) != 1 or new[0]["event"] != "decided":
            fails.append(f"{body!r}: phải thêm đúng 1 sự kiện decided, thêm {[e['event'] for e in new]}"); continue
        e = new[0]
        if e["from"] != "capu" or e["detail"] != want:
            fails.append(f"{body!r}: from={e['from']!r} detail={e['detail']!r}, mong {want!r}")
        if e.get("link") != URL.format(n=7, c=1001):
            fails.append(f"{body!r}: link phải là URL bình luận, nhận {e.get('link')!r}")
        if e.get("state") != "doing" or e.get("holder") != "product" or B.state(tid) != "doing":
            fails.append(f"{body!r}: việc phải về doing/product, nhận state={e.get('state')} holder={e.get('holder')}")
        rep = r["reply"]
        if not rep.startswith(f"<!-- tohong-ok:1001:decided -->") or "Đã ghi" not in rep or tid not in rep:
            fails.append(f"{body!r}: câu xác nhận thiếu marker/'Đã ghi'/mã việc: {rep[:120]!r}")
        if want.split()[0] not in rep and not want.startswith(("$", "-")):
            fails.append(f"{body!r}: câu xác nhận không nhắc lại nội dung")
        if (B.tmp / "PWNED").exists() or list(B.tmp.glob("**/PWNED")):
            fails.append(f"{body!r}: nội dung bình luận đã được chạy như lệnh (tạo file PWNED)")
    finally:
        B.close()
# nội dung có @ không được kích hoạt nhắc tên trong câu xác nhận
B = Box()
try:
    B.new(issue=7)
    r = B.ok(payload("/ok nhờ @mallory xem và @org/team"))
    if r["verdict"] != "decided":
        fails.append(f"ca @: verdict={r['verdict']}")
    elif re.search(r"(?<![\w`\\])@(mallory|org)", r["reply"].replace("@​", "")) or "@mallory" in r["reply"] or "@org/team" in r["reply"]:
        fails.append("câu xác nhận chứa @mallory/@org/team nguyên dạng -> gửi thông báo cho người lạ")
    if B.events()[-1]["detail"] != "nhờ @mallory xem và @org/team":
        fails.append("sổ cái phải giữ nguyên nội dung (kể cả @), chỉ câu trả lời được vô hiệu @")
finally:
    B.close()
assert not fails, "\n".join(fails)
print(f"PASS {len(CASES)+1} ca /ok hợp lệ ghi đúng 1 sự kiện decided (from capu), việc về doing, có xác nhận, không chạy nội dung")
