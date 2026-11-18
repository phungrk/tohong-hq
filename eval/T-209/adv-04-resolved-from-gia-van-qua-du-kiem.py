#!/usr/bin/env python3
"""T-209 adv-04 (tầng 3, offline): `resolved_from` không phải giấy thông hành. manual_overrides.json có sẵn khối `resolved` ghi
resolved_from="enrich_report" (tay ghi, không qua resolve); `enrich.py --category venue` (overrides.py) vẫn chạy đủ kiểm (spec T-207 Hành vi 2, Quyết định 5):
  perm  CLOSED_PERMANENTLY          -> place_closed_permanently
  temp  CLOSED_TEMPORARILY          -> place_temporarily_closed
  far   địa chỉ Hà Nội              -> out_of_province (INV-016)
  mis   resolved.place_id khác place_id của mục -> unresolved
  c1,c2 cùng place_id, địa chỉ gốc khác -> place_conflict (INV-017)
  ok    OPERATIONAL, đúng tỉnh       -> áp, không lỗi
Không chạy resolve; không Place Details cho place_id của các mục (enrich.py vẫn Text Search vendor chưa nhận, ngoài phạm vi eval)."""
import os, re, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-207"))
import _t207 as k

VS = ["ok", "perm", "temp", "far", "mis", "c1", "c2"]
r = k.mk_root(VS)
vv = r.vendors()
for v in vv:
    if v["id"] == "c2":
        v["contact"]["address"] = v["contact"]["address_source"] = "500 Lê Văn Việt, Quận 9, Thành phố Hồ Chí Minh"
r.write("venue/vendors.json", {"vendors": vv})


def blk(pid, status="OPERATIONAL", addr=k.ADDR):
    return {"place_id": pid, "name": "Nhà hàng Mẫu", "formatted_address": addr, "business_status": status, "resolved_at": k.ago(1), "resolved_from": "enrich_report"}


ents = [k.t.entry("ok", "accept_place", place_id="P_OK", resolved=blk("P_OK")),
        k.t.entry("perm", "accept_place", place_id="P_PERM", resolved=blk("P_PERM", "CLOSED_PERMANENTLY")),
        k.t.entry("temp", "accept_place", place_id="P_TMP", resolved=blk("P_TMP", "CLOSED_TEMPORARILY")),
        k.t.entry("far", "accept_place", place_id="P_FAR", resolved=blk("P_FAR", addr="5 Tràng Tiền, Hoàn Kiếm, Hà Nội")),
        k.t.entry("mis", "accept_place", place_id="P_MIS", resolved=blk("P_OTHER")),
        k.t.entry("c1", "accept_place", place_id="P_DUP", resolved=blk("P_DUP")),
        k.t.entry("c2", "accept_place", place_id="P_DUP", resolved=blk("P_DUP"))]
r.set_overrides(ents)
rc, out, calls = r.run(k.t.ENRICH, k.t.fixture({}))
errs = {}
for m in re.finditer(r"OVERRIDE_ERROR (\S+) (\S+):", out):
    errs.setdefault(m.group(1), []).append(m.group(2))
want = {"perm": "place_closed_permanently", "temp": "place_temporarily_closed", "far": "out_of_province", "mis": "unresolved",
        "c1": "place_conflict", "c2": "place_conflict"}
bad = []
for vid, code in want.items():
    if errs.get(vid) != [code]:
        bad.append("%s: OVERRIDE_ERROR %r, kỳ vọng [%r]" % (vid, errs.get(vid), code))
    if any(e.get("place_id") for e in (r.vendor(vid) or {}).get("enrichment_log", []) if e.get("source") == "google_maps"):
        bad.append("%s bị nhận place_id dù phải bị chặn" % vid)
if "ok" in errs:
    bad.append("ok bị lỗi %r" % errs["ok"])
if any(c["kind"] == "details" and any(p in c["url"] for p in ("P_OK", "P_PERM", "P_TMP", "P_FAR", "P_MIS", "P_OTHER", "P_DUP")) for c in calls):
    bad.append("áp duyệt tay gọi Place Details cho mục đã có resolved")
k.done(bad, "resolved_from=enrich_report ghi tay vẫn qua đủ kiểm đóng cửa, tỉnh, khớp place_id, trùng place")
