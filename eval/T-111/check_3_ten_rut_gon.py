#!/usr/bin/env python3
"""T-111 tiêu chí 2 (lượt thử lại duy nhất khi Google không trả gì; v2 theo T-111-D1 B3). OFFLINE (Google giả, mọi truy vấn không trả gì).
A. Hàm chuẩn `short_name` (eval/T-111/_short.py) khớp bảng short_name_cases.json (khoá ngữ nghĩa: sửa hàm mà lệch bảng là đỏ).
B. Chạy `enrich.py` cho vendor có tên trong bảng: MỌI vendor bị đúng 2 lượt Text Search (không vendor nào bị remove sau đúng một lượt). Lượt 1 = "<tên gốc> <địa danh>" (địa danh:
   Quận N / HCM / đoạn cuối địa chỉ). Lượt 2: nếu `short_name` rút được tên riêng có nghĩa thì "<tên rút gọn> <địa danh>"; nếu không (None) thì "<tên gốc>" KHÔNG kèm địa danh.
   Hai truy vấn của mỗi vendor luôn khác nhau. Cả hai loại cuối cùng bị remove, có dòng REMOVED_VENDOR (id, category, name, q1, q2).
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
exp_total = 2 * len(cases)
for i, cse in enumerate(cases):
    v = vs[i]
    loc = x.locality(v["contact"]["address"])
    q1 = x.fold("%s %s" % (cse["name"], loc))
    sn = cse["short"]
    q2 = x.fold("%s %s" % (sn, loc)) if sn else x.fold(cse["name"])
    mine = [x.fold(q) for q in qs if x.fold(q) in (q1, q2)]
    if mine != [q1, q2]:
        bad.append("%r: mong lượt 1 %r rồi lượt 2 %r, thấy %r" % (cse["name"], q1, q2, mine))
    if q1 == q2:
        bad.append("(lỗi bảng) %r: hai truy vấn trùng" % cse["name"])
    if not x.gone_everywhere(r, v["id"]):
        bad.append("%r: không có gì trả về ở cả hai lượt mà vẫn còn trong danh sách" % cse["name"])
if len(qs) != exp_total:
    bad.append("tổng Text Search %d, mong %d (đúng 2 lượt mỗi vendor)" % (len(qs), exp_total))
rl = {d.get("id"): d for d in x.jlines(out, "REMOVED_VENDOR")}
if len(rl) != len(cases) or any(not d.get("q1") or not d.get("q2") or d.get("q1") == d.get("q2") for d in rl.values()):
    bad.append("REMOVED_VENDOR: mong %d dòng, mỗi dòng có q1 khác q2; thấy %d" % (len(cases), len(rl)))
rc2, out2, calls2 = r.run(x.enrich_all("venue"), FX)
if t.n_kind(calls2, "search"):
    bad.append("chạy lại: %d lượt Text Search, mong 0 (không thử lần thứ ba)" % t.n_kind(calls2, "search"))
t.done(bad, "hàm short_name khớp bảng %d ca; mọi vendor đúng 2 lượt khác nhau (tên rút gọn hoặc tên gốc không kèm địa danh; %d lượt cho %d vendor), có REMOVED_VENDOR, chạy lại 0 lượt" % (len(cases), exp_total, len(cases)))
