#!/usr/bin/env python3
"""T-207 tiêu chí 2 (offline): sau khi resolve điền từ báo cáo (0 Google), `enrich.py --state HCMC --category venue` (overrides.py) VẪN chạy đủ kiểm:
  - business_status CLOSED_PERMANENTLY  -> OVERRIDE_ERROR <vid> place_closed_permanently
  - business_status CLOSED_TEMPORARILY  -> OVERRIDE_ERROR <vid> place_temporarily_closed
  - địa chỉ Google ngoài tỉnh/thành của vendor (INV-016) -> OVERRIDE_ERROR <vid> out_of_province
  - hai vendor có địa chỉ gốc khác nhau cùng place_id (INV-017) -> OVERRIDE_ERROR <vid> place_conflict (cả hai)
  - OPERATIONAL, đúng tỉnh, không trùng -> áp: vendor có place_id đó, contact.address = địa chỉ Google, không OVERRIDE_ERROR.
Bản thân resolve KHÔNG chặn các mục này (vẫn điền resolved, 0 Google): quyết định đóng cửa/tỉnh/trùng chỉ nằm ở một nơi (áp duyệt tay).
Không nhắc cách cài đặt."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t207 as k

VS = ["ok", "perm", "temp", "far", "c1", "c2"]
r = k.mk_root(VS)
# hai vendor trùng place_id phải có địa chỉ gốc khác nhau
for v in r.vendors():
    if v["id"] == "c2":
        v["contact"]["address"] = v["contact"]["address_source"] = "500 Lê Văn Việt, Quận 9, Thành phố Hồ Chí Minh"
r.write("venue/vendors.json", {"vendors": r.vendors()})
HN = "5 Tràng Tiền, Hoàn Kiếm, Hà Nội"
k.write_report(r, [k.row("ok", "P_OK"), k.row("perm", "P_PERM", status="CLOSED_PERMANENTLY"), k.row("temp", "P_TMP", status="CLOSED_TEMPORARILY"),
                   k.row("far", "P_FAR", address=HN), k.row("c1", "P_DUP"), k.row("c2", "P_DUP")])
r.set_overrides([k.acc(v, {"ok": "P_OK", "perm": "P_PERM", "temp": "P_TMP", "far": "P_FAR", "c1": "P_DUP", "c2": "P_DUP"}[v]) for v in VS])
bad = []
rc, out, calls = r.run(k.t.RESOLVE, k.t.fixture({}, deny=True))
if calls:
    bad.append("resolve gọi Google %d lần" % len(calls))
if any(not (e.get("resolved") or {}).get("place_id") for e in r.overrides()["overrides"]):
    bad.append("resolve không điền resolved cho đủ 6 mục (nó không được tự lọc đóng cửa/tỉnh/trùng): %s" % out[-300:])
rc, out, _ = r.run(k.t.ENRICH, k.t.fixture({}))
errs = {}
for m in re.finditer(r"OVERRIDE_ERROR (\S+) (\S+):", out):
    errs.setdefault(m.group(1), []).append(m.group(2))
want = {"perm": "place_closed_permanently", "temp": "place_temporarily_closed", "far": "out_of_province", "c1": "place_conflict", "c2": "place_conflict"}
for vid, code in want.items():
    if errs.get(vid) != [code]:
        bad.append("%s: OVERRIDE_ERROR %r, kỳ vọng [%r]" % (vid, errs.get(vid), code))
if "ok" in errs or "unresolved" in str(errs):
    bad.append("mục ok bị lỗi: %r" % errs.get("ok"))
ok = r.vendor("ok")
lg = [e for e in (ok or {}).get("enrichment_log", []) if e.get("source") == "google_maps" and e.get("place_id") == "P_OK"]
if not lg or (ok.get("contact") or {}).get("address") != k.ADDR:
    bad.append("vendor ok không được áp (place_id P_OK / địa chỉ Google)")
for vid in want:
    if any(e.get("place_id") for e in (r.vendor(vid) or {}).get("enrichment_log", []) if e.get("source") == "google_maps"):
        bad.append("%s bị nhận place_id dù áp bị từ chối" % vid)
k.done(bad, "resolve điền từ báo cáo rồi overrides.py vẫn chặn đóng cửa vĩnh viễn/tạm, ngoài tỉnh, trùng place; mục sạch được áp")
