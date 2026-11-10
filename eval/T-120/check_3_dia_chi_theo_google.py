#!/usr/bin/env python3
"""T-120 tiêu chí 3 (địa chỉ vendor được nhận theo luật mới đổi sang địa chỉ Google Maps; địa chỉ marry.vn gốc giữ vĩnh viễn). OFFLINE (Google giả, dữ liệu thật của run 42635049304).
Sau bước 0 (luật hiện hành) và `enrich.py ... --recheck-name-match` (Hành vi 4), đo trên mọi vendor:
  (a) vendor được nhận theo tên: `contact.address` bằng ĐÚNG TỪNG KÝ TỰ chuỗi formattedAddress mà Google trả (bản ghi `enrichment_log[google_maps].formatted_address` cùng chuỗi), `contact.address_source`
      bằng địa chỉ marry.vn gốc (không đổi một ký tự); ít nhất 40/49 vendor có địa chỉ mới khác địa chỉ gốc (địa chỉ thật sự được cập nhật);
  (b) vendor không được nhận: `contact.address` = `contact.address_source` = địa chỉ gốc (Google không ghi đè địa chỉ của vendor bị từ chối);
  (c) chạy `enrich.py` thường (không cờ) ngay sau đó: 0 lượt Text Search, mọi `contact.address` và `contact.address_source` y nguyên;
  (d) Capu duyệt tay `reject_match` một vendor đã được nhận rồi chạy `enrich.py` thường: vendor đó về như chưa từng khớp, `contact.address` = địa chỉ gốc (`address_source` vẫn nguyên), không place_id/ảnh.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t120 as h
t, x = h.t, h.x
bad = []
root, rows, FX, dropped = h.prepare()
el, _ = h.ref_eligible(rows)
want = {r["id"]: r for r in el}
rc, out, calls = root.run(h.recheck_argv(rows), FX, timeout=900)
x.save_log(root, "run-recheck-1.log", out)
if rc != 0:
    t.fail("enrich %s thoát %d: %s" % (h.RECHECK_FLAG, rc, (out.strip().splitlines() or [""])[-1][:160]))


def addrs(vid):
    recs = h.records(root, vid)
    ads = {(v.get("contact") or {}).get("address") for _, v, _ in recs}
    srcs = {(v.get("contact") or {}).get("address_source") for _, v, _ in recs}
    if len(ads) > 1 or len(srcs) > 1:
        bad.append("%s: các category file có contact.address/address_source khác nhau" % vid[-6:])
    return (recs[0][1] if recs else None), (recs[0][0] if recs else None), next(iter(ads), None), next(iter(srcs), None)


changed = 0
for r in rows:
    v, cat, ad, src = addrs(r["id"])
    if v is None:
        bad.append("%s biến mất khỏi vendors.json" % r["id"][-6:]); continue
    if src != r["src"]:
        bad.append("%s: address_source đổi: %r -> %r" % (r["id"][-6:], r["src"][:40], (src or "")[:40])); continue
    if r["id"] in want:
        g = t.glog(v) or {}
        if ad != r["gaddr"] or g.get("formatted_address") != r["gaddr"]:
            bad.append("%s: contact.address=%r, log.formatted_address=%r; mong đúng chuỗi Google %r" % (r["id"][-6:], (ad or "")[:40], (g.get("formatted_address") or "")[:40], r["gaddr"][:40]))
        changed += ad != src
    elif ad != src:
        bad.append("%s không được nhận mà contact.address đã khác địa chỉ gốc: %r" % (r["id"][-6:], (ad or "")[:50]))
if changed < 40:
    bad.append("chỉ %d/49 vendor được nhận có địa chỉ mới khác địa chỉ gốc (mong >= 40)" % changed)
rc2, out2, calls2 = root.run(x.enrich_all(h.cats_arg(rows)), FX, timeout=900)
x.save_log(root, "run-normal-2.log", out2)
if rc2 != 0 or t.n_kind(calls2, "search"):
    bad.append("enrich thường sau recheck: mong thoát 0 và 0 Text Search, thấy rc=%d, %d lượt" % (rc2, t.n_kind(calls2, "search")))
for r in rows:
    v, cat, ad, src = addrs(r["id"])
    exp_ad = r["gaddr"] if r["id"] in want else r["src"]
    if v and (ad != exp_ad or src != r["src"]):
        bad.append("%s: sau enrich thường contact.address/address_source đổi (address=%r)" % (r["id"][-6:], (ad or "")[:40])); break
if want:
    vid = sorted(want)[0]
    r = want[vid]
    root.set_overrides([t.entry(vid, "reject_match", place_id=r["pid"], reason="Capu: Google nhận nhầm nơi (fixture eval T-120)")])
    rc3, out3, calls3 = root.run(x.enrich_all(h.cats_arg(rows)), FX, timeout=900)
    v, cat, ad, src = addrs(vid)
    if rc3 != 0 or t.has_pid(v) or v.get("google_photos") or ad != r["src"] or src != r["src"]:
        bad.append("reject_match sau khi nhận theo tên: mong về như chưa khớp (không place_id/ảnh, address = địa chỉ gốc); thấy rc=%d pid=%r address=%r" % (rc3, t.pid_of(v), (ad or "")[:40]))
t.done(bad, "địa chỉ vendor được nhận = chuỗi Google từng ký tự (%d/49 khác địa chỉ gốc), address_source bất biến, vendor bị từ chối giữ địa chỉ gốc, về lại khi bị duyệt tay loại" % changed)
