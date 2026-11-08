#!/usr/bin/env python3
"""T-111 tiêu chí 2 (thử lại tên rút gọn đúng 1 lần). OFFLINE (Google giả, mọi truy vấn không trả gì).
A. Hàm chuẩn `short_name` (eval/T-111/_short.py) khớp bảng short_name_cases.json (khoá ngữ nghĩa: sửa hàm mà lệch bảng là đỏ).
B. Chạy `enrich.py` cho vendor có tên trong bảng: vendor có tên rút gọn bị đúng 2 lượt Text Search, lượt 2 có truy vấn = "<tên rút gọn> <địa danh>" (địa danh lấy như lượt 1:
   Quận N / HCM / đoạn cuối địa chỉ), lượt 1 = "<tên gốc> <địa danh>"; vendor KHÔNG có tên rút gọn bị đúng 1 lượt (không gọi lại truy vấn y hệt). Cả hai loại cuối cùng bị remove.
C. Chạy lại lần 2: 0 lượt Text Search (vendor đã remove không còn trong danh sách; không ai bị thử lần thứ ba).
Spec: products/T-111-enrich-toan-bo-vendor.md, "Tên rút gọn". In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
bad = []
cases = json.load(open(os.path.join(x.HERE, "short_name_cases.json"), encoding="utf-8"))
for cse in cases:
    if x.short_name(cse["name"]) != cse["short"]:
        bad.append("short_name(%r) = %r, bảng ghi %r" % (cse["name"], x.short_name(cse["name"]), cse["short"]))
if bad:
    t.done(bad, "")
vs = []
for i, cse in enumerate(cases):
    vs.append(x.V("n%02d" % i, cse["name"], i + 1))
r = t.Root({"venue": vs})
FX = x.fx({}, [])
rc, out, calls = r.run(x.enrich_all("venue"), FX)
if rc != 0:
    t.fail("enrich thoát %d: %s" % (rc, out.strip().splitlines()[-1:] or ""))
qs = x.queries(calls)
exp_total = 0
for i, cse in enumerate(cases):
    v = vs[i]
    loc = x.locality(v["contact"]["address"])
    first = x.fold("%s %s" % (cse["name"], loc))
    sn = cse["short"]
    mine = [q for q in qs if x.fold(q) in (first, x.fold("%s %s" % (sn, loc)) if sn else first)]
    want = 2 if sn else 1
    exp_total += want
    got = [x.fold(q) for q in mine]
    if sn and not (len(got) == 2 and got[0] == first and got[1] == x.fold("%s %s" % (sn, loc))):
        bad.append("%r: mong lượt 1 %r rồi lượt 2 %r, thấy %r" % (cse["name"], first, x.fold("%s %s" % (sn, loc)), got))
    if not sn and got != [first]:
        bad.append("%r (không rút gọn được): mong đúng 1 lượt %r, thấy %r" % (cse["name"], first, got))
    if not x.gone_everywhere(r, v["id"]):
        bad.append("%r: không có gì trả về hai lần mà vẫn còn trong danh sách" % cse["name"])
if len(qs) != exp_total:
    bad.append("tổng Text Search %d, mong %d" % (len(qs), exp_total))
rc2, out2, calls2 = r.run(x.enrich_all("venue"), FX)
if t.n_kind(calls2, "search"):
    bad.append("chạy lại: %d lượt Text Search, mong 0 (không thử lần thứ ba)" % t.n_kind(calls2, "search"))
t.done(bad, "hàm short_name khớp bảng %d ca; CLI thử lại đúng 1 lần với tên rút gọn (%d lượt cho %d vendor), vendor không rút gọn được chỉ 1 lượt, chạy lại 0 lượt" % (len(cases), exp_total, len(cases)))
