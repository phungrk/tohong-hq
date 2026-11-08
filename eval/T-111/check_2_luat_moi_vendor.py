#!/usr/bin/env python3
"""T-111 tiêu chí 2 (luật cho mỗi vendor, ADR-049). OFFLINE (Google giả). Chạy ĐÚNG `enrich.py --state HCMC --category venue,wedding_attire --budget-usd 30 --max-photos 2 ...` trên 10 vendor (v2, theo T-111-D1):
  s_keep       Google trả đúng nơi, OPERATIONAL, qua sáu cổng        -> giữ: place_id, google_photos đúng 2 ảnh (max_photos=2 dù Google có 3), 2 lượt media.
  s_closed_perm đúng nơi, CLOSED_PERMANENTLY, ở 2 category file       -> gỡ khỏi CẢ HAI file, removed_vendors.json (lý do chứa CLOSED_PERMANENTLY), không ảnh.
  s_temp       đúng nơi, CLOSED_TEMPORARILY                           -> còn trong vendors.json, không place_id, không ảnh, không trong removed, dòng audit đúng định nghĩa T-110 (closed_state + retry).
  s_tlow       ứng viên CLOSED_TEMPORARILY nhưng G1 từ chối            -> low_confidence + review NHƯNG vẫn mang closed_state + retry (T-110 nguồn ii): vendor bị ẩn, không remove.
  s_low        ứng viên tên/địa chỉ khác (G1 từ chối)                 -> low_confidence + dòng review-needed.csv, vendor Ở LẠI, không bị gỡ, không ảnh Google.
  s_short_ok   lượt 1 không trả gì (tên có "Tiệc Cưới"), lượt 2 tên rút gọn "Echo Pearl" trả đúng -> giữ; đúng 2 lượt; lượt 2 = "<tên rút gọn> <địa danh>".
  s_golf       lượt 1 không trả gì; lượt 2 (tên rút gọn) trả ứng viên tên "Golf Royal": G1 chấm bằng TÊN GỐC của vendor (độ giống 0,377 < 0,4) -> low_confidence + review, ở lại.
               (Chấm bằng tên rút gọn sẽ cho 0,588 và, vì địa chỉ trùng, nhận khớp: sai. B4.)
  s_gone       cả hai lượt không trả gì                                -> remove khỏi mọi file, removed_vendors.json (lý do nói no_match, KHÔNG chứa CLOSED_PERMANENTLY, không manual), đúng 2 lượt.
  s_noshort    "Mai House" không có tên rút gọn, không trả gì         -> VẪN đúng 2 lượt: lượt 2 = tên gốc KHÔNG kèm địa danh ("Mai House"), khác lượt 1; rồi remove. Không vendor nào bị remove sau đúng một lượt (B3).
Stdout có đúng một dòng `REMOVED_VENDOR {json}` cho mỗi vendor bị gỡ vì no_match (id, category, name, q1, q2) để Capu duyệt và `--restore` (M5).
Rồi lần 1b (Google không trả gì ở lượt nào): vendor tạm đóng (s_temp, s_tlow) vẫn thử lại 2 lượt mỗi vendor, ở lại, vẫn closed_state + retry, KHÔNG remove (B2).
Rồi lần 2 (Google báo s_temp mở lại): chỉ s_temp và s_tlow (còn retry) được tìm; s_temp được nhận khớp với ảnh, hết closed_state/retry; vendor khác 0 lượt (kể cả s_low, đã có audit).
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
n = {k: x.count_for(calls, k) for k in ("alpha garden", "bravo old", "charlie temp", "delta khac", "echo pearl", "foxtrot moon", "mai house", "hotel tlow", "golf royal")}
exp_n = {"alpha garden": 1, "bravo old": 1, "charlie temp": 1, "delta khac": 1, "echo pearl": 2, "foxtrot moon": 2, "mai house": 2, "hotel tlow": 1, "golf royal": 2}
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
if not x.is_temp_closed(ar):
    bad.append("s_temp: dòng audit phải mang closed_state='temporarily_closed' và retry=true (T-110 Hành vi 6); thấy %r" % (ar and {k: ar.get(k) for k in ("status", "retry", "closed_state")}))
TL = r.vendor("s_tlow")
atl = r.audit().get("s_tlow") or {}
if not TL or t.has_pid(TL) or atl.get("status") != "low_confidence" or not x.is_temp_closed(atl) or "s_tlow" not in r.review() or any(e["vendor"]["id"] == "s_tlow" for e in r.removed()):
    bad.append("s_tlow: ứng viên CLOSED_TEMPORARILY bị cổng từ chối phải là low_confidence + closed_state + retry, có dòng review, KHÔNG remove, không place_id (T-110 nguồn ii); thấy %r" % {k: atl.get(k) for k in ("status", "closed_state", "retry")})
GF = r.vendor("s_golf", "wedding_attire")
ag = r.audit("wedding_attire").get("s_golf") or {}
if not GF or t.has_pid(GF) or ag.get("status") != "low_confidence" or ag.get("reject_reason") != "low_score" or float(ag.get("confidence") or 1) >= 0.4 or "s_golf" not in r.review("wedding_attire"):
    bad.append("s_golf: lượt 2 trả ứng viên 'Golf Royal' phải bị G1 chấm theo TÊN GỐC (độ giống 0,377 < 0,4): low_confidence + low_score + review, ở lại; thấy %r" % {k: ag.get(k) for k in ("status", "reject_reason", "confidence")})
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
rl = {d.get("id"): d for d in x.jlines(out, "REMOVED_VENDOR")}
if set(rl) != {"s_gone", "s_noshort"}:
    bad.append("REMOVED_VENDOR: mong đúng 2 dòng (s_gone, s_noshort), thấy %r" % sorted(rl))
for vid, nm in (("s_gone", "Nhà hàng Foxtrot Moon (Quận 1)"), ("s_noshort", "Mai House")):
    d = rl.get(vid) or {}
    if d.get("name") != nm or d.get("category") != "wedding_attire" or not d.get("q1") or not d.get("q2") or x.fold(d.get("q1", "")) == x.fold(d.get("q2", "")):
        bad.append("REMOVED_VENDOR %s: cần name, category=wedding_attire, q1 và q2 khác nhau; thấy %r" % (vid, d))
q2 = [q for q in x.queries(calls) if "mai house" in x.fold(q)]
if len(q2) == 2 and not (x.fold(q2[0]) == x.fold("Mai House " + x.locality(x.ADDR % 7)) and x.fold(q2[1]) == "mai house"):
    bad.append("s_noshort: lượt 1 'Mai House <địa danh>', lượt 2 'Mai House' (tên gốc không kèm địa danh); thấy %r" % q2)
for vid, cat in (("s_gone", "wedding_attire"), ("s_noshort", "wedding_attire")):
    rec = next((e["vendor"] for e in r.removed(cat) if e["vendor"]["id"] == vid), None)
    o = next(v for v in orig[cat] if v["id"] == vid)
    if rec is None or any(rec.get(kk) != vv for kk, vv in o.items() if kk != "contact"):
        bad.append("%s: bản ghi removed phải giữ nguyên các trường gốc của vendor (khôi phục được)" % vid)
q1 = [q for q in x.queries(calls) if "echo pearl" in x.fold(q)]
if len(q1) == 2 and not ("tiec cuoi" in x.fold(q1[0]) and "tiec cuoi" not in x.fold(q1[1]) and x.fold(q1[1]).startswith("echo pearl")):
    bad.append("s_short_ok: lượt 2 phải dùng tên rút gọn 'Echo Pearl' (không còn 'Tiệc Cưới'); thấy %r" % q1)
u = t.usage(out)
if u != {"text_search": 13, "photo_details": 0, "photo_media": 4}:
    bad.append("GOOGLE_USAGE %r, mong text_search=13 photo_details=0 photo_media=4" % u)
if x.n_requests(out, "search") != 13 or x.n_requests(out, "media") != 4:
    bad.append("GOOGLE_REQUEST: mong mỗi request một dòng (13 search, 4 media), thấy %d search, %d media" % (x.n_requests(out, "search"), x.n_requests(out, "media")))
# Lần 1b: Google không trả gì ở bất kỳ lượt nào.
rc1b, out1b, calls1b = x.run_basic(r, x.fx({}, []))
if t.n_kind(calls1b, "search") != 4 or x.count_for(calls1b, "charlie temp") != 2 or x.count_for(calls1b, "hotel tlow") != 2:
    bad.append("lần 1b: mong 4 Text Search (s_temp 2 + s_tlow 2: thử lại gồm lượt rút gọn), thấy %r" % x.queries(calls1b))
for vid in ("s_temp", "s_tlow"):
    a1 = r.audit().get(vid) or {}
    if not r.vendor(vid) or any(e["vendor"]["id"] == vid for e in r.removed()) or not x.is_temp_closed(a1):
        bad.append("lần 1b: %s đang tạm đóng, lần sau Google không trả gì: phải GIỮ trạng thái ẩn (closed_state + retry), KHÔNG remove, vẫn trong vendors.json" % vid)
# Lần 2: Google báo s_temp mở lại.
PL2 = dict(PL)
PL2["PC"] = t.place("Nhà hàng Charlie Temp", x.GADDR % 3, nphotos=3)
rc2, out2, calls2 = x.run_basic(r, x.fx(PL2, RULES))
if t.n_kind(calls2, "search") != 2 or x.count_for(calls2, "charlie temp") != 1 or x.count_for(calls2, "hotel tlow") != 1:
    bad.append("lần 2: mong đúng 2 Text Search (s_temp và s_tlow còn retry), thấy %r" % x.queries(calls2))
T2 = r.vendor("s_temp")
a2 = r.audit().get("s_temp") or {}
if not (t.has_pid(T2) and len(T2.get("google_photos") or []) == 2) or x.is_temp_closed(a2) or a2.get("retry") or a2.get("closed_state"):
    bad.append("lần 2: s_temp mở lại và qua sáu cổng phải được nhận (place_id + 2 ảnh), hết closed_state và hết retry")
t.done(bad, "luật ADR-049 đúng: giữ+ảnh<=2, CLOSED_PERMANENTLY gỡ ở mọi file, tạm đóng (kể cả ứng viên bị cổng từ chối) ở lại, ẩn, không remove dù lần sau không trả gì, được nhận khi mở lại; low_confidence vào review không remove; lượt 2 chấm bằng tên gốc; no_match luôn qua 2 lượt khác nhau rồi remove, có REMOVED_VENDOR; 13 Text Search + 4 media")
