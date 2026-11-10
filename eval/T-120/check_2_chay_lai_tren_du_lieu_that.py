#!/usr/bin/env python3
"""T-120 tiêu chí 2 (chạy lại trên dữ liệu thật của run 42635049304). OFFLINE (Google giả, trả đúng ứng viên Google đã lưu trong dữ liệu thật; chạy ĐÚNG lệnh CLI).
Bước 0 (đối chứng, luật hiện hành): dựng 663 vendor từ audit_snapshot.json (664 trừ 1 vendor trùng tên khác place_id), chạy `enrich.py` cũ -> tái hiện lý do từ chối của dữ liệu thật.
Bước 1: `enrich.py --state HCMC --category <12 hạng mục> --budget-usd 30 --max-photos 2 --usage-root run-logs --month 2026-11 --recheck-name-match` (Hành vi 4).
Mong: (a) tập vendor được nhận = đúng tập tham chiếu (49: tên >= 0,95, cùng TP.HCM, cùng chữ số, trừ nhóm G6 offline), không hơn không kém, mỗi vendor có place_id đúng ứng viên đã lưu và đúng 2 ảnh Google có ghi công;
(b) đơn vị là ID: vendor nằm ở 2-3 category file (4/49 ca thật: Chau Anh Bridal 3 file, Wings Decor, TRUNG VO, Yada 2 file) vẫn 1 Text Search, 2 ảnh, kết cục áp cho mọi file; đúng 49 lượt Text Search, mỗi lượt cho một vendor trong tập đó (mỗi vendor đúng 1), 98 lượt media, 0 Place Details, 0 lượt cho vendor khác (kể cả 2 vendor G6 và mọi venue);
(c) mọi vendor KHÔNG được nhận: bản ghi vendor và dòng audit y hệt trước khi chạy; (d) chạy lần 2 ngay sau: 0 lượt Google, không file nào đổi; (e) stdout có dòng GOOGLE_USAGE khớp.
In PASS hoặc FAIL <lý do>; thoát 0/1. Spec: products/T-120-nhan-khop-theo-ten.md."""
import copy, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t120 as h
t, x = h.t, h.x
bad = []
root, rows, FX, dropped = h.prepare()
el, _ = h.ref_eligible(rows)
want = {r["id"] for r in el}
if len(want) != 49:
    t.fail("tập tham chiếu mong 49, thấy %d" % len(want))
before_tree = root.tree()
before = {r["id"]: copy.deepcopy([(c_, v_, a_) for c_, v_, a_ in h.records(root, r["id"])]) for r in rows}
rc, out, calls = root.run(h.recheck_argv(rows), FX, timeout=900)
x.save_log(root, "run-recheck-1.log", out)
if rc != 0:
    t.fail("enrich %s thoát %d: %s" % (h.RECHECK_FLAG, rc, (out.strip().splitlines() or [""])[-1][:160]))
got = {}
for r in rows:
    recs = h.records(root, r["id"])
    if any(t.has_pid(v_) for _, v_, _ in recs):
        got[r["id"]] = (recs[0][1], recs[0][2], r)
    # đơn vị là id (như T-111): kết cục áp cho MỌI category file có id (1 Text Search, nhiều file)
    if len({(t.pid_of(v_), len(v_.get("google_photos") or []), (a_ or {}).get("status")) for _, v_, a_ in recs}) != 1:
        bad.append("%s nằm ở %d file nhưng kết cục khác nhau giữa các file" % (r["id"][-6:], len(recs)))
if set(got) != want:
    bad.append("tập được nhận lệch tham chiếu: thừa %r, thiếu %r" % (sorted(i[-6:] for i in set(got) - want)[:4], sorted(i[-6:] for i in want - set(got))[:4]))
for vid, (v, a, r) in got.items():
    if t.pid_of(v) != r["pid"]:
        bad.append("%s: place_id %r khác ứng viên đã lưu" % (vid[-6:], t.pid_of(v)))
    ph = v.get("google_photos") or []
    if len(ph) != 2 or not all("lh3.googleusercontent.com" in p.get("uri", "") and p.get("attributions") for p in ph):
        bad.append("%s: mong đúng 2 ảnh Google có ghi công, thấy %d" % (vid[-6:], len(ph)))
    if (a or {}).get("status") != "enriched" or (a or {}).get("reject_reason"):
        bad.append("%s: audit mong enriched không reject_reason, thấy %r" % (vid[-6:], {k: (a or {}).get(k) for k in ("status", "reject_reason")}))
qs = [q for q in x.queries(calls)]
by = {}
for q in qs:
    hit = [r for r in el if h.fold(r["name"]) in h.fold(q)]
    if len(hit) != 1:
        hit = sorted(hit, key=lambda r: -len(h.fold(r["name"])))[:1]
    by[hit[0]["id"] if hit else q] = by.get(hit[0]["id"] if hit else q, 0) + 1
if len(qs) != 49 or set(by) != want or set(by.values()) != {1}:
    bad.append("Text Search: mong đúng 49 lượt, mỗi vendor trong tập được nhận 1 lượt; thấy %d lượt, %d vendor, lượt/vendor %r" % (len(qs), len(by), sorted(set(by.values()))))
if t.n_kind(calls, "media") != 98 or t.n_kind(calls, "details", "share", "geocode", "maps"):
    bad.append("mong 98 lượt media và 0 Details/geocode/share/maps; thấy media=%d, khác=%d" % (t.n_kind(calls, "media"), t.n_kind(calls, "details", "share", "geocode", "maps")))
u = t.usage(out)
if not u or (u.get("text_search"), u.get("photo_media"), u.get("photo_details")) != (49, 98, 0):
    bad.append("GOOGLE_USAGE mong text_search=49 photo_media=98 photo_details=0, thấy %r" % u)
for r in rows:
    if r["id"] in want:
        continue
    if h.records(root, r["id"]) != before[r["id"]]:
        bad.append("%s (%s, %s) không được nhận mà bản ghi/audit đã đổi" % (r["id"][-6:], r["cat"], r["reason"]))
        if len(bad) > 8:
            break
mid = root.tree()
rc2, out2, calls2 = root.run(h.recheck_argv(rows), FX, timeout=900)
if rc2 != 0 or calls2:
    bad.append("chạy lần 2: mong thoát 0 và 0 lượt Google, thấy rc=%d, %d lượt" % (rc2, len(calls2)))
if root.tree() != mid:
    bad.append("chạy lần 2 làm đổi file: %r" % sorted(k for k in set(mid) | set(root.tree()) if mid.get(k) != root.tree().get(k))[:3])
t.done(bad, "chạy lại nhận đúng %d/%d vendor theo tên (49 lượt Text Search, 98 ảnh, 0 lượt cho vendor khác), vendor còn lại y nguyên, lần 2 không tốn gì" % (len(got), len(rows)))
