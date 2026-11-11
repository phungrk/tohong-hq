#!/usr/bin/env python3
"""T-126 tiêu chí 5 (báo cáo cho Capu: vendor nào bị hạ vì ít review). OFFLINE (Google giả).
`low-review-demoted.csv` (UTF-8, ở thư mục category ĐẦU TIÊN chứa id theo thứ tự chuẩn; mỗi ID đúng một dòng dù ở nhiều file) là SỔ DỰNG LẠI từ trạng thái hiện tại: mọi id đang có dòng audit có hiệu lực
reject_reason=few_reviews. Cột (đúng thứ tự): id, name, category, google_name, google_address, place_id, maps_url, review_count, stage, was_matched.
  place_id = candidate_place_id; maps_url = https://www.google.com/maps/place/?q=place_id:<place_id>; review_count = google_review_count;
  stage = new (lần enrich thường: chưa từng nhận) | stored (áp ngược offline, theo số đã lưu) | live (xác nhận Place Details); was_matched = true khi vendor ĐÃ có ảnh Google trước khi bị hạ, false khi chưa từng nhận.
  google_name/google_address: tên và địa chỉ Google của ứng viên (lần new: từ Google; stored/live: từ bản ghi đã lưu, Place Details chỉ hỏi userRatingCount).
Kịch bản: n1 makeup chưa nhận, Google 0 đánh giá, tên Google khác tên vendor -> new/false · n2 flower 1 đánh giá -> new/false · s1 đã nhận, đọc mới, lưu 1 -> stored/true ·
l0 đã nhận, đọc cũ, thật 0 -> live/true · tw đã nhận ở makeup VÀ flower, đọc mới, lưu 0 -> MỘT dòng stored/true · ok5 5 đánh giá -> không có dòng.
Mong: sổ đủ 5 dòng đúng nội dung; `enrich.py` thường lần nữa KHÔNG đổi sổ (dựng lại cùng kết quả, không nhân đôi, không xoá); Capu thêm accept_place cho n1 -> sau lần chạy kế n1 được nhận,
dòng n1 ra khỏi sổ, 4 dòng còn lại y nguyên. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, csv, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t126 as k
h, x, t = k.h, k.x, k.t
bad = []
A = k.ADDR
files = {"makeup": [t.vendor("t126_n1", "Mốc Review Zero", A % 60, (h.DIR_CATEGORY["makeup"],)),
                    k.matched("t126_tw", "Twin Zero Studio", A % 63, "makeup", "Ptw", k.NEW_TS, 0, cats=["makeup", "flower"])],
         "flower": [t.vendor("t126_n2", "Hoa Review One", A % 61, (h.DIR_CATEGORY["flower"],)),
                    k.matched("t126_tw", "Twin Zero Studio", A % 63, "flower", "Ptw", k.NEW_TS, 0, cats=["makeup", "flower"])],
         "photography": [k.matched("t126_s1", "Stored One Photo", A % 62, "photography", "Ps1", k.NEW_TS, 1),
                         k.matched("t126_l0", "Live Zero Photo", A % 64, "photography", "Pl0", k.OLD_TS, None),
                         k.matched("t126_ok5", "Okay Five Photo", A % 65, "photography", "Pok5", k.NEW_TS, 5)]}
PL = {"Pn1": k.pl("Mốc Review Zero (Google)", A % 60, "Pn1", n=0), "Pn2": k.pl("Hoa Review One", A % 61, "Pn2", n=1), "Pl0": k.pl("Live Zero Photo", A % 64, "Pl0", n=0),
      "Ptw": k.pl("Twin Zero Studio", A % 63, "Ptw", n=0), "Ps1": k.pl("Stored One Photo", A % 62, "Ps1", n=1), "Pok5": k.pl("Okay Five Photo", A % 65, "Pok5", n=5)}
RULES = [("moc review zero", ["Pn1"]), ("hoa review one", ["Pn2"])]
root = k.seed(files)
FX = x.fx(PL, RULES)
cats = [c for c in h.ORDER if c in files]
rc, out, calls = root.run(x.enrich_all(cats), FX)
if rc != 0:
    t.fail("enrich thường thoát %d: %s" % (rc, (out.strip().splitlines() or [""])[-1][:160]))
rc, out, calls = root.run(x.enrich_all(cats, extra=[k.APPLY, k.CONFIRM]), FX)
if rc != 0:
    t.fail("enrich %s %s thoát %d: %s" % (k.APPLY, k.CONFIRM, rc, (out.strip().splitlines() or [""])[-1][:160]))
COLS = ["id", "name", "category", "google_name", "google_address", "place_id", "maps_url", "review_count", "stage", "was_matched"]
paths = {c: root.p(os.path.join(c, k.REPORT)) for c in os.listdir(root.out) if os.path.isfile(root.p(os.path.join(c, k.REPORT)))}
for c, p in paths.items():
    hdr = next(csv.reader(open(p, encoding="utf-8-sig", newline="")))
    if hdr != COLS:
        bad.append("%s/%s: cột mong %r, thấy %r" % (c, k.REPORT, COLS, hdr))
rows = k.report_rows(root)
by = {r["id"]: r for r in rows}
MU = "https://www.google.com/maps/place/?q=place_id:"
want = {"t126_n1": ("makeup", "Mốc Review Zero (Google)", "Pn1", "0", "new", "false"), "t126_n2": ("flower", "Hoa Review One", "Pn2", "1", "new", "false"),
        "t126_s1": ("photography", "Stored One Photo", "Ps1", "1", "stored", "true"), "t126_l0": ("photography", "Live Zero Photo", "Pl0", "0", "live", "true"),
        "t126_tw": ("makeup", "Twin Zero Studio", "Ptw", "0", "stored", "true")}
if len(rows) != 5 or set(by) != set(want):
    bad.append("sổ mong đúng 5 id %r (tw một dòng ở makeup), thấy %d dòng %r" % (sorted(want), len(rows), [(r["id"], r["_cat"]) for r in rows]))
for vid, (cat, gname, pid, n, stage, wm) in want.items():
    r = by.get(vid)
    if not r:
        continue
    got = (r["_cat"], r["category"], r["google_name"], r["place_id"], r["review_count"], r["stage"], r["was_matched"].lower(), r["maps_url"])
    if got != (cat, cat, gname, pid, n, stage, wm, MU + pid):
        bad.append("%s: mong %r, thấy %r" % (vid, (cat, cat, gname, pid, n, stage, wm, MU + pid), got))
    if not r["name"] or not r["google_address"]:
        bad.append("%s: thiếu name/google_address" % vid)
tree = root.tree()
root.run(x.enrich_all(cats), FX)
if {p: v for p, v in root.tree().items() if p.endswith(k.REPORT)} != {p: v for p, v in tree.items() if p.endswith(k.REPORT)}:
    bad.append("`enrich.py` thường làm đổi %s (sổ phải dựng lại cùng kết quả, không nhân đôi, không xoá)" % k.REPORT)
root.set_overrides([t.accept_with_snapshot("t126_n1", "Pn1", PL["Pn1"])])
rc, out, calls = root.run(x.enrich_all(cats), FX)
ids_after = sorted(r["id"] for r in k.report_rows(root))
if ids_after != sorted(set(want) - {"t126_n1"}):
    bad.append("sau khi Capu accept_place n1: sổ mong 4 dòng (không còn n1), thấy %r" % ids_after)
if not t.has_pid(root.vendor("t126_n1", "makeup")):
    bad.append("n1 (Capu duyệt tay, Google 0 đánh giá): mong được nhận")
t.done(bad, "sổ low-review-demoted.csv đủ cột, mỗi ID một dòng, dựng lại từ trạng thái (new/stored/live, was_matched), ổn định khi chạy lại, duyệt tay đưa vendor ra khỏi sổ")
