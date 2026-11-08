#!/usr/bin/env python3
"""T-111 tiêu chí 2 (luật cho mỗi vendor, ADR-049). OFFLINE (Google giả). Chạy ĐÚNG `enrich.py --state HCMC --category venue,wedding_attire --budget-usd 30 --max-photos 2 ...` trên 8 vendor:
  s_keep       Google trả đúng nơi, OPERATIONAL, qua sáu cổng        -> giữ: place_id, google_photos đúng 2 ảnh (max_photos=2 dù Google có 3), 2 lượt media.
  s_closed_perm đúng nơi, CLOSED_PERMANENTLY, ở 2 category file       -> gỡ khỏi CẢ HAI file, removed_vendors.json (lý do chứa CLOSED_PERMANENTLY), không ảnh.
  s_temp       đúng nơi, CLOSED_TEMPORARILY                           -> còn trong vendors.json, không place_id, không ảnh, không trong removed, dòng audit tạm đóng (định nghĩa T-110), retry.
  s_low        ứng viên tên/địa chỉ khác (G1 từ chối)                 -> low_confidence + dòng review-needed.csv, vendor Ở LẠI, không bị gỡ, không ảnh Google.
  s_short_ok   lần 1 không trả gì (tên có "Tiệc Cưới"), lần 2 tên rút gọn trả đúng -> giữ; đúng 2 lượt Text Search; lần 2 dùng tên rút gọn.
  s_gone       cả hai lần không trả gì                                 -> remove khỏi mọi file, removed_vendors.json (lý do nói no_match, KHÔNG chứa CLOSED_PERMANENTLY, không manual), đúng 2 lượt.
  s_noshort    "Mai House" không có tên rút gọn, không trả gì         -> đúng 1 lượt (không gọi lại cùng truy vấn), remove.
Rồi lần 2 (Google báo s_temp mở lại): chỉ s_temp được tìm (1 lượt) và được nhận khớp với ảnh; 0 lượt cho vendor khác (kể cả s_low, đã có audit).
Spec: products/T-111-enrich-toan-bo-vendor.md, "Luật cho mỗi vendor". In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
bad = []
r, FX, PL, RULES = x.scenario_basic()
orig = {c: [dict(v) for v in r.vendors(c)] for c in ("venue", "wedding_attire")}
rc, out, calls = x.run_basic(r, FX)
if rc != 0:
    t.fail("enrich thoát %d: %s" % (rc, out.strip().splitlines()[-1:] or ""))
n = {k: x.count_for(calls, k) for k in ("alpha garden", "bravo old", "charlie temp", "delta khac", "echo pearl", "foxtrot moon", "mai house")}
exp_n = {"alpha garden": 1, "bravo old": 1, "charlie temp": 1, "delta khac": 1, "echo pearl": 2, "foxtrot moon": 2, "mai house": 1}
if n != exp_n:
    bad.append("số lượt Text Search theo vendor %r, mong %r" % (n, exp_n))
if t.n_kind(calls, "details", "share"):
    bad.append("có lượt Place Details/share (ảnh phải lấy từ Text Search, không Details)")
k = r.vendor("s_keep")
g = (k or {}).get("google_photos") or []
if not (t.has_pid(k) and len(g) == 2 and all("lh3.googleusercontent.com" in p["uri"] and p.get("attributions") for p in g)):
    bad.append("s_keep: mong place_id + đúng 2 ảnh Google có ghi công; thấy pid=%r ảnh=%d" % (t.pid_of(k), len(g)))
if t.n_kind(calls, "media") != 4:
    bad.append("media: mong 4 (2 vendor được giữ x 2 ảnh), thấy %d" % t.n_kind(calls, "media"))
for c in ("venue", "wedding_attire"):
    if r.vendor("s_closed_perm", c):
        bad.append("s_closed_perm còn trong %s/vendors.json" % c)
rm = [(c, e) for c in ("venue", "wedding_attire") for e in r.removed(c) if e["vendor"]["id"] == "s_closed_perm"]
if len(rm) != 2 or not all("CLOSED_PERMANENTLY" in e["reason"] for _, e in rm):
    bad.append("s_closed_perm: mong 2 bản ghi removed (mỗi file một) có lý do CLOSED_PERMANENTLY, thấy %d" % len(rm))
T = r.vendor("s_temp")
if not T or t.has_pid(T) or T.get("google_photos") or any(e["vendor"]["id"] == "s_temp" for e in r.removed()):
    bad.append("s_temp: phải còn trong vendors.json, không place_id, không ảnh Google, không trong removed")
ar = r.audit().get("s_temp")
if not x.is_temp_closed(ar) or not ar.get("retry"):
    bad.append("s_temp: dòng audit phải là trạng thái tạm đóng cửa của T-110 (status temporarily_closed) kèm retry=true; thấy %r" % (ar and {k: ar.get(k) for k in ("status", "retry", "manual_override")}))
L = r.vendor("s_low")
al = r.audit().get("s_low") or {}
if not L or t.has_pid(L) or L.get("google_photos") or al.get("status") != "low_confidence" or "s_low" not in r.review():
    bad.append("s_low: mong ở lại + low_confidence + có dòng review-needed.csv, không place_id/ảnh Google")
if any(e["vendor"]["id"] == "s_low" for e in r.removed()):
    bad.append("s_low bị remove (low_confidence KHÔNG được remove)")
if not t.has_pid(r.vendor("s_short_ok")):
    bad.append("s_short_ok: lần thử tên rút gọn trúng nhưng vendor không được giữ")
for vid in ("s_gone", "s_noshort"):
    if not x.gone_everywhere(r, vid):
        bad.append("%s: phải bị remove khỏi mọi category file" % vid)
    recs = [e for c in ("venue", "wedding_attire") for e in r.removed(c) if e["vendor"]["id"] == vid]
    if not recs or any("CLOSED_PERMANENTLY" in e["reason"] or e.get("manual") or "no_match" not in e["reason"] for e in recs):
        bad.append("%s: bản ghi removed phải có lý do nêu no_match, không chứa CLOSED_PERMANENTLY, không manual" % vid)
for vid, cat in (("s_gone", "wedding_attire"), ("s_noshort", "wedding_attire")):
    rec = next((e["vendor"] for e in r.removed(cat) if e["vendor"]["id"] == vid), None)
    o = next(v for v in orig[cat] if v["id"] == vid)
    if rec is None or any(rec.get(kk) != vv for kk, vv in o.items() if kk != "contact"):
        bad.append("%s: bản ghi removed phải giữ nguyên các trường gốc của vendor (khôi phục được)" % vid)
q1 = [q for q in x.queries(calls) if "echo pearl" in x.fold(q)]
if len(q1) == 2 and not ("tiec cuoi" in x.fold(q1[0]) and "tiec cuoi" not in x.fold(q1[1]) and x.fold(q1[1]).startswith("echo pearl")):
    bad.append("s_short_ok: lượt 2 phải dùng tên rút gọn 'Echo Pearl' (không còn 'Tiệc Cưới'); thấy %r" % q1)
u = t.usage(out)
if u != {"text_search": 9, "photo_details": 0, "photo_media": 4}:
    bad.append("GOOGLE_USAGE %r, mong text_search=9 photo_details=0 photo_media=4" % u)
# Lần 2: Google báo s_temp mở lại.
PL2 = dict(PL)
PL2["PC"] = t.place("Nhà hàng Charlie Temp", x.GADDR % 3, nphotos=3)
rc2, out2, calls2 = x.run_basic(r, x.fx(PL2, RULES))
if t.n_kind(calls2, "search") != 1 or x.count_for(calls2, "charlie temp") != 1:
    bad.append("lần 2: mong đúng 1 Text Search (s_temp thử lại), thấy %r" % x.queries(calls2))
T2 = r.vendor("s_temp")
a2 = r.audit().get("s_temp") or {}
if not (t.has_pid(T2) and len(T2.get("google_photos") or []) == 2) or x.is_temp_closed(a2) or a2.get("retry"):
    bad.append("lần 2: s_temp mở lại và qua sáu cổng phải được nhận (place_id + 2 ảnh), hết trạng thái tạm đóng và hết retry")
t.done(bad, "bảy nhánh luật đúng: giữ+ảnh<=2, CLOSED_PERMANENTLY gỡ ở mọi file, tạm đóng ở lại rồi được nhận khi mở lại, low_confidence vào review không remove, no_match thử tên rút gọn đúng 1 lần rồi remove (hoặc 1 lượt khi không rút gọn được); 9 Text Search + 4 media")
