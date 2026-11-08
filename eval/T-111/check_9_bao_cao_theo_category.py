#!/usr/bin/env python3
"""T-111 tiêu chí 1 (báo cáo theo category). OFFLINE (Google giả). Kịch bản cơ bản (8 vendor, 2 category file; xem _t111.scenario_basic). Sau `enrich.py`, stdout có, MỖI category chạy một dòng
  CATEGORY_REPORT category=<c> processed=<n> kept=<n> with_photos=<n> removed=<n> temp_closed=<n> review=<n> error=<n> unprocessed=<n>
và một dòng category=TOTAL (tổng các dòng trên). Định nghĩa (vendor tính vào category ĐẦU TIÊN theo thứ tự `--category` có id đó; cùng id ở nhiều file là MỘT vendor):
  processed = vendor có >= 1 lượt Text Search trong lần chạy này; kept = kết cục nhận khớp (có place_id); with_photos = kept có >= 1 ảnh Google; removed = bị gỡ lần này (CLOSED_PERMANENTLY hoặc no_match x2);
  temp_closed = kết cục tạm đóng cửa; review = low_confidence; error = lỗi HTTP; unprocessed = còn trong phạm vi nhưng chưa tìm vì dừng trần.
  Ràng buộc: processed = kept + removed + temp_closed + review + error; with_photos <= kept.
Mong đợi cho kịch bản: venue processed=5 kept=2 with_photos=2 removed=1 (s_closed_perm) temp_closed=1 review=1; wedding_attire processed=2 (s_gone, s_noshort; s_closed_perm đã tính ở venue) kept=0 removed=2.
Các số cũng phải khớp dữ liệu sau chạy (đếm lại từ vendors.json / removed_vendors.json / audit). GOOGLE_USAGE dòng cuối khớp số lượt thật. Chạy lần 2 (không còn gì để làm trừ s_temp):
báo cáo lần 2 chỉ còn s_temp processed=1. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
bad = []
r, FX, PL, RULES = x.scenario_basic()
rc, out, calls = x.run_basic(r, FX)
rows = {d["category"]: d for d in x.kv(out, "CATEGORY_REPORT")}
F = ("processed", "kept", "with_photos", "removed", "temp_closed", "review", "error", "unprocessed")
for c in ("venue", "wedding_attire", "TOTAL"):
    if c not in rows:
        bad.append("thiếu dòng CATEGORY_REPORT category=%s" % c)
if not bad:
    for c, d in rows.items():
        v = {k: int(d.get(k, -1)) for k in F}
        if min(v.values()) < 0:
            bad.append("%s: thiếu trường (cần %s)" % (c, ", ".join(F)))
        elif v["processed"] != v["kept"] + v["removed"] + v["temp_closed"] + v["review"] + v["error"] or v["with_photos"] > v["kept"]:
            bad.append("%s: ràng buộc processed = kept + removed + temp_closed + review + error, with_photos <= kept bị vi phạm: %r" % (c, v))
    exp = {"venue": dict(processed=5, kept=2, with_photos=2, removed=1, temp_closed=1, review=1, error=0, unprocessed=0),
           "wedding_attire": dict(processed=2, kept=0, with_photos=0, removed=2, temp_closed=0, review=0, error=0, unprocessed=0)}
    for c, e in exp.items():
        got = {k: int(rows[c][k]) for k in F}
        if got != e:
            bad.append("%s: mong %r, thấy %r" % (c, e, got))
    for k in F:
        if int(rows["TOTAL"][k]) != sum(int(rows[c][k]) for c in exp):
            bad.append("TOTAL.%s không bằng tổng các category" % k)
    kept = sum(1 for c in ("venue", "wedding_attire") for v in r.vendors(c) if t.has_pid(v))
    if kept != 2:
        bad.append("dữ liệu sau chạy có %d vendor có place_id, báo cáo ghi kept=2" % kept)
u = t.usage(out)
if u != {"text_search": t.n_kind(calls, "search"), "photo_details": 0, "photo_media": t.n_kind(calls, "media")}:
    bad.append("GOOGLE_USAGE %r không khớp lượt thật" % u)
lines = [l for l in out.splitlines() if l.strip()]
if not lines or not lines[-1].startswith("GOOGLE_USAGE"):
    bad.append("dòng cuối stdout phải là GOOGLE_USAGE")
PL2 = dict(PL)
PL2["PC"] = t.place("Nhà hàng Charlie Temp", x.GADDR % 3, status="CLOSED_TEMPORARILY")
rc, out2, calls2 = x.run_basic(r, x.fx(PL2, RULES))
tot2 = next((d for d in x.kv(out2, "CATEGORY_REPORT") if d.get("category") == "TOTAL"), {})
if tot2.get("processed") != "1" or tot2.get("temp_closed") != "1":
    bad.append("lần 2: mong TOTAL processed=1 temp_closed=1 (chỉ s_temp thử lại), thấy %r" % tot2)
t.done(bad, "CATEGORY_REPORT đúng định nghĩa và khớp dữ liệu (venue 5/2/2/1/1/1, wedding_attire 2/0/0/2), TOTAL là tổng, GOOGLE_USAGE khớp, lần 2 chỉ vendor tạm đóng được thử lại")
