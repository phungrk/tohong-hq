#!/usr/bin/env python3
"""T-124 tiêu chí 1: luật nhóm (một vendor một nhóm) và bốn ô đếm, đo trên dữ liệu thật đã chụp.
OFFLINE, xanh sẵn: khoá hàm chuẩn eval/T-124/_t124.py trước khi code. Dữ liệu: eval/T-124/snapshot.json (876 vendor, tohong origin/main 62ee2f8, trích từ
tools/scraper/output/HCMC/*/vendors.json + enrichment-audit.json; Google và marry.vn sinh, không do code).
Đo: (a) 876 vendor, mỗi id đúng một nhóm trong 9 nhóm; (b) số từng nhóm đúng bảng spec (98/7/34/71/73/244/346/3/0), tổng 876;
(c) bốn ô: Enrich 100% = 98, Chưa có ảnh Google = 680, Tên hơi giống = 244, Địa chỉ khác marry = 107; (d) Approve được ở đúng 422 vendor;
(e) ranh giới: tên giống 0,95 -> tên trùng; 0,9499 -> hơi giống; 0,6 -> hơi giống; 0,5999 -> không thấy; ảnh 0 vs 1; tạm đóng thắng mọi nhóm khác.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t124 as t

bad = []
snap = t.load_snapshot()["facts"]
ids = [f["id"] for f in snap]
if len(ids) != 876 or len(set(ids)) != 876:
    bad.append("mong 876 vendor khác nhau, thấy %d (%d id)" % (len(ids), len(set(ids))))
s = t.summarize(snap)
want = {"full": 98, "matched_no_photo": 7, "addr_diff_accepted": 34, "unverified": 71, "name_same_addr_diff": 73, "name_similar": 244,
        "not_found": 346, "temp_closed": 3, "not_enriched": 0}
if s["groups"] != want:
    bad.append("số từng nhóm %r, mong %r" % (s["groups"], want))
if sum(s["groups"].values()) != 876:
    bad.append("tổng các nhóm %d != 876 (một vendor phải đúng một nhóm)" % sum(s["groups"].values()))
if s["chips"] != {"full": 98, "no_google_photo": 680, "name_similar": 244, "addr_diff": 107}:
    bad.append("bốn ô đếm %r" % s["chips"])
if s["approvable"] != 422:
    bad.append("số vendor Approve được %d, mong 422" % s["approvable"])

base = {"id": "x", "name": "x", "category": "venue", "home": "venue", "marry_address": "", "photos": 0, "g": None,
        "audit": {"status": "low_confidence", "conf": 0.5, "name": "n", "candidate": "P", "reject_reason": "low_score", "closed_state": None}}
def with_conf(c):
    f = copy.deepcopy(base); f["audit"]["conf"] = c; return t.classify(f)
for c, g in ((0.95, "name_same_addr_diff"), (0.9499, "name_similar"), (0.6, "name_similar"), (0.5999, "not_found")):
    if with_conf(c) != g:
        bad.append("độ giống tên %s phải vào %s, hàm chuẩn cho %s" % (c, g, with_conf(c)))
gm = {"place_id": "P", "name": "n", "conf": 0.7, "has_flag": True, "address_match": True, "address": "a"}
f = copy.deepcopy(base); f["g"] = gm; f["photos"] = 1
if t.classify(f) != "full": bad.append("khớp địa chỉ + có ảnh phải là full")
f["photos"] = 0
if t.classify(f) != "matched_no_photo": bad.append("khớp địa chỉ + 0 ảnh phải là matched_no_photo")
f["g"] = dict(gm, address_match=False)
if t.classify(f) != "addr_diff_accepted": bad.append("đã nhận + địa chỉ khác marry phải là addr_diff_accepted")
f["g"] = dict(gm, has_flag=False, address_match=None)
if t.classify(f) != "unverified": bad.append("bản ghi Google không có cờ address_match phải là unverified")
f = copy.deepcopy(base); f["audit"]["closed_state"] = "temporarily_closed"; f["audit"]["conf"] = 0.99
if t.classify(f) != "temp_closed": bad.append("tạm đóng cửa phải thắng nhóm tên giống")
f = copy.deepcopy(base); f["audit"] = None
if t.classify(f) != "not_enriched": bad.append("không có Google, không có dòng audit phải là not_enriched")
print("FAIL " + bad[0] + (" (+%d lỗi nữa)" % (len(bad) - 1) if len(bad) > 1 else "") if bad else "PASS")
sys.exit(1 if bad else 0)
