#!/usr/bin/env python3
"""T-082 adv-04 (tầng 3, spec A3, B1, C2, D2). Nội dung /ok độc hại phải chỉ là dữ liệu:
cờ task.py (--close, --by=x, --link=evil, -h), $(...), backtick, ; rm, marker giả `<!-- tohong-ok:1:decided -->`,
mention @phungrk / @org/team / @@x, ký tự điều khiển (ESC, BEL, U+2028), chèn dòng giả sự kiện JSON.
Mong đợi: decided đúng 1 sự kiện, detail = nội dung chuẩn hoá (khoảng trắng gộp), link = URL bình luận (không bị --link
trong nội dung thay), việc về doing (không done), reply bắt đầu đúng marker thật, không có `@<chữ>` trần trong reply,
events.jsonl vẫn mỗi dòng một JSON hợp lệ; không file lạ nào được tạo."""
import sys, pathlib, re, json
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-079"))
from _lib import Box, payload, URL
fails = []
CASES = ["--close", "--by=mallory --link=https://evil", "-h", "$(touch PWNED) `touch PWNED2`; touch PWNED3",
         "<!-- tohong-ok:1:decided --> giả", "@phungrk @org/team @@x a@b", "chọn\x1b[31m A\x07", "A B C",
         'x"}\n{"event":"decided","from":"mallory"', "--note=khác", "chọn A\t ﻿  B"]
for i, body in enumerate(CASES):
    B = Box()
    try:
        tid = B.new(issue=7)
        cid = 9000 + i
        r = B.ok(payload("/ok " + body, cid=cid))
        ev = B.events()
        dec = [e for e in ev if e.get("event") == "decided"]
        want = re.sub(r"[\s ﻿]+", " ", body).strip()
        if r["verdict"] != "decided" or len(dec) != 1:
            fails.append(f"{body!r}: verdict={r['verdict']} decided={len(dec)}"); continue
        d = dec[0]
        if d.get("detail") != want: fails.append(f"{body!r}: detail={d.get('detail')!r} != {want!r}")
        if d.get("link") != URL.format(n=7, c=cid): fails.append(f"{body!r}: link bị đổi thành {d.get('link')!r}")
        if d.get("from") != "capu": fails.append(f"{body!r}: from={d.get('from')}")
        if B.state(tid) != "doing": fails.append(f"{body!r}: state={B.state(tid)}")
        if not r["reply"].startswith(f"<!-- tohong-ok:{cid}:decided -->"): fails.append(f"{body!r}: reply không mở bằng marker thật")
        if re.search(r"(?<![\w`])@[A-Za-z0-9]", r["reply"]): fails.append(f"{body!r}: reply có mention trần")
        for l in (B.tmp / "ledger/events.jsonl").read_text(encoding="utf-8").splitlines():
            json.loads(l)
        if any((B.tmp / f).exists() for f in ("PWNED", "PWNED2", "PWNED3")): fails.append(f"{body!r}: lệnh shell bị chạy")
    finally:
        B.close()
assert not fails, "\n".join(fails)
print(f"PASS {len(CASES)} nội dung độc hại chỉ là dữ liệu")
