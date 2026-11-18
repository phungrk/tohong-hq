#!/usr/bin/env python3
"""T-207 tiêu chí 1 (offline, Google giả ở chế độ deny): mục accept_place có place_id KHỚP ứng viên đang tươi trong enrich-report.json
(cả ứng viên đã nhận google.matched=true lẫn ứng viên chưa nhận matched=false) thì `resolve_overrides.py` gọi 0 request Google
(0 Place Details, 0 Text Search, 0 mở link), exit 0, GOOGLE_USAGE toàn 0, và điền khối `resolved` từ báo cáo:
  place_id, name (= google.name), formatted_address (= google.address), business_status, resolved_at (= google.checked_at nguyên văn), resolved_from = "enrich_report".
Mục khác và mọi trường khác của mục (reason, approved_*, decision, place_id) giữ nguyên byte. Chạy lại lần hai: file không đổi.
Cách cài đặt không được nhắc: chỉ CLI, file vào, file ra."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t207 as k

r = k.mk_root(["a", "b", "x"])
CA, CB = k.ago(2), k.ago(10, minutes=7)
k.write_report(r, [k.row("a", "PA", "Nhà hàng Alpha (Google)", k.ADDR, "OPERATIONAL", CA, matched=True),
                   k.row("b", "PB", "Nhà hàng Beta (Google)", "99 Pasteur, Bến Nghé, Quận 1, Hồ Chí Minh", "OPERATIONAL", CB, matched=False)])
ents = [k.acc("a", "PA"), k.acc("b", "PB"), k.t.entry("x", "remove")]
r.set_overrides(ents)
before = r.overrides()
FX = k.t.fixture({}, deny=True)
rc, out, calls = r.run(k.t.RESOLVE, FX)
bad = []
if calls:
    bad.append("resolve gọi Google %d lần (%s) cho mục khớp ứng viên enrich" % (len(calls), sorted({c["kind"] for c in calls})))
if rc != 0:
    bad.append("exit %d, kỳ vọng 0: %s" % (rc, out[-200:]))
u = k.t.usage(out)
if u is None or any(u.get(x, 0) for x in ("text_search", "photo_details", "photo_media")):
    bad.append("GOOGLE_USAGE %r, kỳ vọng toàn 0" % (u,))
after = k.by_vid(r)
for vid, pid, name, addr, ts in (("a", "PA", "Nhà hàng Alpha (Google)", k.ADDR, CA), ("b", "PB", "Nhà hàng Beta (Google)", "99 Pasteur, Bến Nghé, Quận 1, Hồ Chí Minh", CB)):
    e = after.get(vid, {})
    rs = e.get("resolved") or {}
    want = {"place_id": pid, "name": name, "formatted_address": addr, "business_status": "OPERATIONAL", "resolved_at": ts, "resolved_from": "enrich_report"}
    if rs != want:
        bad.append("%s: resolved=%r, kỳ vọng %r" % (vid, rs, want))
    old = {x["vendor_id"]: x for x in before["overrides"]}[vid]
    if {kk: vv for kk, vv in e.items() if kk != "resolved"} != old:
        bad.append("%s: trường ngoài `resolved` bị đổi" % vid)
if after.get("x") != {x["vendor_id"]: x for x in before["overrides"]}["x"]:
    bad.append("mục remove x bị đổi")
snap = open(r.p("manual_overrides.json"), "rb").read()
rc2, out2, calls2 = r.run(k.t.RESOLVE, FX)
if calls2 or open(r.p("manual_overrides.json"), "rb").read() != snap:
    bad.append("chạy lại lần hai: gọi Google hoặc file đổi byte")
k.done(bad, "mục khớp ứng viên enrich: 0 request Google, resolved điền từ báo cáo, resolved_from=enrich_report, chạy lại không đổi byte")
