#!/usr/bin/env python3
"""T-120 tiêu chí 1 (ngưỡng "tên gần tuyệt đối" đo trên dữ liệu thật, hàm chuẩn khoá bằng bảng ca). OFFLINE, không cần cài đặt, xanh sẵn (khoá hàm chuẩn trước khi code).
Dữ liệu: eval/T-120/audit_snapshot.json (664 vendor cần duyệt của run 42635049304; Google và marry.vn sinh, không do code). Hàm chuẩn: eval/T-120/_t120.py::name_rule.
Đo: (a) độ giống tên đã ghi (`confidence`) bằng phép đo tên của pipeline tính lại (sai số <= 0,001) cho mọi dòng; (b) 13 ca thật + 1 ca tổng hợp ở hai phía ngưỡng 0,95
(nhận: Halady, Helen's, Wings...; từ chối: Mơ/M.O.T 0,947, Cherry 3, Hải Sơn/Hải Đăng, SunMoon/24H 0,773, tên trùng mà ở New York/Đà Nẵng) cho đúng kết luận;
(c) trên 639 vendor ngoài venue: đúng 51 ứng viên qua tên+tỉnh+chữ số, 49 sau nhóm G6 offline; mọi dòng có độ giống nằm trong [0,947, 0,952) bằng 0 (ngưỡng nằm giữa khoảng trống: mọi T trong (0,947, 0,952] cho kết quả y hệt);
(d) mọi vendor venue có tên trùng (>= 3 ca) vẫn KHÔNG được luật này nhận (venue giữ sáu cổng). In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t120 as h
bad = []
rows = h.load_rows()
nv = [r for r in rows if not h.is_venue_row(r)]
if len(rows) != 664 or len(nv) != 639:
    bad.append("snapshot mong 664 dòng (639 ngoài venue), thấy %d (%d)" % (len(rows), len(nv)))
off = [(r["id"][-6:], r["conf"], h.name_sim(r["name"], r["matched"])) for r in rows if abs(r["conf"] - h.name_sim(r["name"], r["matched"])) > 0.0011]
if off:
    bad.append("%d dòng có confidence lệch phép đo tên của pipeline, vd %r" % (len(off), off[:2]))
for p in json.load(open(os.path.join(h.HERE, "name_pairs.json"), encoding="utf-8"))["pairs"]:
    got = h.name_rule(p["name"], p["matched"], p["gaddr"])
    if got is not p["expect_accept"]:
        bad.append("ca %r vs %r: mong %s, hàm chuẩn cho %s" % (p["name"][:30], p["matched"][:30], p["expect_accept"], got))
    if p["source"] == "synthetic" and "chữ số" in p["note"] and h.name_sim(p["name"], p["matched"]) < h.THRESHOLD:
        bad.append("ca tổng hợp chữ số phải có độ giống >= 0,95 (để chỉ N3 từ chối), thấy %s" % h.name_sim(p["name"], p["matched"]))
el, cand = h.ref_eligible(rows)
if (len(cand), len(el)) != (51, 49):
    bad.append("mong 51 ứng viên và 49 sau G6 offline, thấy %d và %d" % (len(cand), len(el)))
reasons = {r["reason"] for r in cand}
if not reasons <= set(h.ELIGIBLE_REASONS):
    bad.append("ứng viên có lý do ngoài address_conflict/address_unconfirmed: %r" % reasons)
mid = [r["conf"] for r in nv if 0.947 < r["conf"] < 0.952]
if mid:
    bad.append("có dòng độ giống %r trong khoảng trống (0,947, 0,952): ngưỡng 0,95 không còn nằm giữa khoảng trống" % mid)
top_rej = max(r["conf"] for r in nv if r["conf"] < h.THRESHOLD and h.c.in_province(r["gaddr"]))
low_acc = min(r["conf"] for r in cand)
if (top_rej, low_acc) != (0.947, 0.952):
    bad.append("mong cao nhất bị từ chối 0,947 và thấp nhất được nhận 0,952, thấy %s và %s" % (top_rej, low_acc))
vn = [r for r in rows if h.is_venue_row(r) and h.name_rule(r["name"], r["matched"], r["gaddr"], r["conf"])]
if len(vn) < 3 or any(r["id"] in {e["id"] for e in el} for r in vn):
    bad.append("venue có tên trùng (mong >= 3 ca) phải bị loại khỏi tập được nhận theo tên; thấy %d ca, %d lọt" % (len(vn), sum(1 for r in vn if r["id"] in {e["id"] for e in el})))
if bad:
    print("FAIL %d vi phạm, vd: %s" % (len(bad), " | ".join(bad[:4]))); sys.exit(1)
print("PASS ngưỡng 0,95: %d/%d vendor ngoài venue được nhận theo tên (G6 offline loại thêm %d), khoảng trống (0,947, 0,952), %d ca biên đúng hai phía, %d venue tên trùng vẫn bị giữ" % (len(el), len(nv), len(cand) - len(el), 15, len(vn)))
