#!/usr/bin/env python3
"""T-120 tiêu chí 6 (Capu đọc được diff hành vi: ai được nhận theo tên, địa chỉ cũ so địa chỉ mới; review không còn vendor đã nhận). OFFLINE (Google giả, dữ liệu thật của run 42635049304).
Sau `enrich.py ... --recheck-name-match` (Hành vi 4) đo:
  (a) mỗi category là category ĐẦU TIÊN (thứ tự chạy venue, photography, wedding_attire, makeup, flower, ...) chứa một vendor được nhận có file `output/HCMC/<category>/name-match-accepted.csv` (UTF-8, có BOM hoặc không), cột ĐÚNG và theo thứ tự:
      id,name,google_name,similarity,address_source,google_address,place_id,maps_url ; mỗi ID được nhận đúng MỘT dòng (vendor nằm ở 3 file như Chau Anh Bridal vẫn 1 dòng; tổng 49 dòng, không phải 54); sắp theo id; không dòng nào cho vendor không được nhận;
      google_name = tên Google đã lưu, similarity = độ giống ghi trong dữ liệu (sai số 0,001), address_source = địa chỉ marry.vn gốc, google_address = chuỗi Google,
      maps_url = `https://www.google.com/maps/place/?q=place_id:<place_id>`; category không có vendor được nhận thì không có file đó;
  (b) vendor được nhận không còn dòng low_confidence_place trong review-needed.csv; vendor còn bị từ chối giữ nguyên dòng review (cùng cờ) như trước khi chạy; không vendor nào đồng thời ở review và ở báo cáo;
  (c) tổng số dòng báo cáo = 49 = số `accepted_by=name_near_exact` trong dòng audit (dòng audit và bản ghi log của vendor được nhận mang accepted_by, address_match=false; vendor nhận bằng sáu cổng không mang accepted_by).
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import csv, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t120 as h
t, x = h.t, h.x
COLS = ["id", "name", "google_name", "similarity", "address_source", "google_address", "place_id", "maps_url"]
bad = []
root, rows, FX, dropped = h.prepare()
el, _ = h.ref_eligible(rows)
want = {r["id"]: r for r in el}
rev_before = {cat: root.review(cat) for cat in os.listdir(root.out) if os.path.isdir(root.p(cat))}
rc, out, calls = root.run(h.recheck_argv(rows), FX, timeout=900)
if rc != 0:
    t.fail("enrich %s thoát %d: %s" % (h.RECHECK_FLAG, rc, (out.strip().splitlines() or [""])[-1][:160]))
seen = {}
cats_with = {h.first_cat(r) for r in el}   # một dòng cho mỗi ID, ở category ĐẦU TIÊN (theo thứ tự chạy) chứa id
for cat in sorted(rev_before):
    p = root.p(os.path.join(cat, "name-match-accepted.csv"))
    if cat not in cats_with:
        if os.path.exists(p):
            bad.append("%s: không có vendor được nhận mà vẫn có name-match-accepted.csv" % cat)
        continue
    if not os.path.exists(p):
        bad.append("%s: thiếu name-match-accepted.csv" % cat); continue
    rd = csv.reader(open(p, encoding="utf-8-sig", newline=""))
    head = next(rd, [])
    if head != COLS:
        bad.append("%s: cột %r, mong %r" % (cat, head, COLS)); continue
    recs = [dict(zip(COLS, row)) for row in rd]
    ids = [d["id"] for d in recs]
    if ids != sorted(ids):
        bad.append("%s: dòng không sắp theo id" % cat)
    exp = sorted(r["id"] for r in el if h.first_cat(r) == cat)
    if ids != exp:
        bad.append("%s: id báo cáo %d, mong %d (đúng tập vendor được nhận trong category)" % (cat, len(ids), len(exp)))
    for d in recs:
        r = want.get(d["id"])
        if not r:
            continue
        seen[d["id"]] = seen.get(d["id"], 0) + 1
        ok = (d["name"] == r["name"] and d["google_name"] == r["matched"] and abs(float(d["similarity"] or -1) - r["conf"]) <= 0.0011 and d["address_source"] == r["src"]
              and d["google_address"] == r["gaddr"] and d["place_id"] == r["pid"] and d["maps_url"] == "https://www.google.com/maps/place/?q=place_id:" + r["pid"])
        if not ok:
            bad.append("%s: dòng báo cáo sai nội dung %r" % (d["id"][-6:], {k: d[k][:30] for k in COLS})); break
if sorted(seen) != sorted(want) or set(seen.values()) - {1}:
    bad.append("báo cáo phải có mỗi vendor được nhận đúng 1 dòng: thấy %d/%d vendor, lặp %r" % (len(seen), len(want), sorted(set(seen.values()))))
for cat, before in rev_before.items():
    after = root.review(cat)
    for vid, row in before.items():
        if "low_confidence_place" not in (row.get("flags") or ""):
            continue
        if vid in want:
            if vid in after and "low_confidence_place" in (after[vid].get("flags") or ""):
                bad.append("%s đã được nhận mà vẫn còn dòng low_confidence_place trong review (%s)" % (vid[-6:], cat))
        elif vid not in after or after[vid].get("flags") != row.get("flags"):
            bad.append("%s vẫn bị từ chối mà dòng review đã đổi/mất (%s)" % (vid[-6:], cat))
n_acc = set()
for cat in rev_before:
    for vid, a in (root.audit(cat) or {}).items():
        if a.get("accepted_by") == "name_near_exact":
            n_acc.add(vid)
            v = root.vendor(vid, cat)
            g = t.glog(v) or {}
            if a.get("status") != "enriched" or a.get("address_match") is not False or g.get("accepted_by") != "name_near_exact" or g.get("address_match") is not False:
                bad.append("%s: audit/log mong accepted_by=name_near_exact, address_match=false, status=enriched" % vid[-6:])
        elif a.get("accepted_by"):
            bad.append("%s: accepted_by lạ %r" % (vid[-6:], a.get("accepted_by")))
if n_acc != set(want):
    bad.append("số ID có accepted_by=name_near_exact là %d, mong %d" % (len(n_acc), len(want)))
t.done(bad, "báo cáo name-match-accepted.csv đủ %d vendor (địa chỉ cũ/mới, tên, độ giống, link Maps), review không còn vendor đã nhận, dòng review khác y nguyên" % len(want))
