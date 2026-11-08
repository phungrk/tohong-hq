#!/usr/bin/env python3
"""T-110 tiêu chí 1: file duyệt tay có schema rõ, chỉ Capu ghi, và code từ chối file sai bằng lỗi rõ ràng. OFFLINE.
Spec: products/T-110-duyet-tay-venue.md, "File duyệt tay".
A. Dữ liệu thật (repo tohong): tools/scraper/output/HCMC/manual_overrides.json tồn tại, đúng schema (schema_version=1, overrides[] mỗi mục có vendor_id, action
   thuộc {accept_place, remove, temporarily_closed, reject_match}, reason, approved_by="capu", approved_on dạng YYYY-MM-DD, decision = đường dẫn tới file trong
   decisions/ của HQ có `decided_by: capu` và nhắc tới vendor_id), mỗi vendor_id một mục; và có đủ 4 mục của ADR-048 với đúng vendor_id/action/maps_link.
B. Fixture: file sai bị `enrich.py` từ chối TRƯỚC khi làm gì: mã thoát 2, dòng `OVERRIDE_FILE_INVALID <mã>` (kèm vendor_id nếu lỗi ở một mục), 0 lượt gọi Google,
   mọi file trong output/ giữ nguyên byte. Mã: bad_json, bad_schema_version, unknown_action, missing_field, bad_approver, bad_date, duplicate_vendor,
   missing_target (accept_place thiếu cả maps_link lẫn place_id; reject_match thiếu place_id), unexpected_field (remove/temporarily_closed mang place_id hay maps_link),
   bad_link (maps_link không thuộc share.google, goo.gl, maps.app.goo.gl, google.com/maps).
C. Fixture: file hợp lệ + vendor_id không tồn tại ở đâu: dòng `OVERRIDE_ERROR <vendor_id> unknown_vendor`, các mục khác vẫn áp, mã thoát 2.
D. Sau enrich và refresh_photos, file duyệt tay không đổi byte (code tự động không được ghi).
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t110 as t

bad = []
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate(doc):
    """Bộ kiểm độc lập theo spec, trả danh sách lỗi (chuỗi)."""
    errs = []
    if doc.get("schema_version") != 1:
        errs.append("schema_version != 1")
    seen = set()
    for e in doc.get("overrides") or []:
        v = e.get("vendor_id")
        if not v or v in seen:
            errs.append("vendor_id thiếu hoặc trùng: %r" % v)
        seen.add(v)
        if e.get("action") not in t.ALLOWED:
            errs.append("%s: action %r" % (v, e.get("action")))
        for k in ("reason", "approved_by", "approved_on", "decision"):
            if not e.get(k):
                errs.append("%s: thiếu %s" % (v, k))
        if e.get("approved_by") != "capu":
            errs.append("%s: approved_by %r (chỉ 'capu')" % (v, e.get("approved_by")))
        if not ISO.match(str(e.get("approved_on") or "")):
            errs.append("%s: approved_on %r" % (v, e.get("approved_on")))
        if e.get("action") == "accept_place" and not (e.get("maps_link") or e.get("place_id")):
            errs.append("%s: accept_place thiếu maps_link/place_id" % v)
        if e.get("action") == "reject_match" and not e.get("place_id"):
            errs.append("%s: reject_match thiếu place_id" % v)
        if e.get("action") in ("remove", "temporarily_closed") and (e.get("place_id") or e.get("maps_link")):
            errs.append("%s: %s không mang place_id/maps_link" % (v, e.get("action")))
        d = os.path.join(t.HQ, str(e.get("decision") or "x"))
        if not os.path.isfile(d):
            errs.append("%s: decision %r không tồn tại trong HQ" % (v, e.get("decision")))
        else:
            txt = open(d, encoding="utf-8").read()
            if not re.search(r"^decided_by:\s*capu\s*$", txt, re.M) or str(v) not in txt:
                errs.append("%s: decision %s phải có decided_by: capu và nhắc vendor_id" % (v, e.get("decision")))
    return errs


# ---- A. dữ liệu thật --------------------------------------------------------------------------------------------------------------------------------
fp = os.path.join(t.c.tohong(), "tools", "scraper", "output", "HCMC", t.OVERRIDES)
if not os.path.isfile(fp):
    bad.append("thiếu tools/scraper/output/HCMC/manual_overrides.json")
else:
    try:
        real = json.load(open(fp, encoding="utf-8"))
    except ValueError as ex:
        real = {}
        bad.append("manual_overrides.json không phải JSON: %s" % ex)
    bad += ["dữ liệu thật: " + e for e in validate(real)]
    by = {e.get("vendor_id"): e for e in real.get("overrides") or []}
    want = {"marry_d4380c0b3cf3": ("accept_place", "https://share.google/tYZdblcikIDPqVJX6"), "marry_f8b40ba4ddef": ("accept_place", "https://share.google/noYBKfSkxUtMoFmJD"),
            "marry_e38f1e755f9c": ("remove", None), "marry_2ee808943c08": ("temporarily_closed", None)}
    for vid, (act, link) in want.items():
        e = by.get(vid)
        if not e or e.get("action") != act or (link and e.get("maps_link") != link):
            bad.append("thiếu/sai mục ADR-048 cho %s (mong %s %s)" % (vid, act, link or ""))

# ---- B. file sai ------------------------------------------------------------------------------------------------------------------------------------
V = [t.vendor("t110_v1", "Nhà hàng Một", "1 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"), t.vendor("t110_v2", "Nhà hàng Hai", "2 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh")]
AUD = [{"vendor_id": v["id"], "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None, "formatted_address": "", "address_match": None} for v in V]
FX = t.fixture({}, [])
ok_entry = t.entry("t110_v2", "remove")


def mut(fn):
    e = copy.deepcopy(ok_entry)
    fn(e)
    return e


CASES = [
    ("bad_json", "{ không phải json", None),
    ("bad_schema_version", {"schema_version": 2, "overrides": [ok_entry]}, None),
    ("unknown_action", {"schema_version": 1, "overrides": [mut(lambda e: e.update(action="approve"))]}, "t110_v2"),
    ("missing_field", {"schema_version": 1, "overrides": [mut(lambda e: e.pop("reason"))]}, "t110_v2"),
    ("bad_approver", {"schema_version": 1, "overrides": [mut(lambda e: e.update(approved_by="claude"))]}, "t110_v2"),
    ("bad_date", {"schema_version": 1, "overrides": [mut(lambda e: e.update(approved_on="08/11/2026"))]}, "t110_v2"),
    ("duplicate_vendor", {"schema_version": 1, "overrides": [ok_entry, t.entry("t110_v2", "temporarily_closed")]}, "t110_v2"),
    ("missing_target", {"schema_version": 1, "overrides": [t.entry("t110_v2", "accept_place")]}, "t110_v2"),
    ("missing_target", {"schema_version": 1, "overrides": [t.entry("t110_v2", "reject_match")]}, "t110_v2"),
    ("unexpected_field", {"schema_version": 1, "overrides": [mut(lambda e: e.update(place_id="ChIJxxxx"))]}, "t110_v2"),
    ("bad_link", {"schema_version": 1, "overrides": [t.entry("t110_v2", "accept_place", maps_link="http://evil.example/maps/place/x")]}, "t110_v2"),
]
for code, doc, vid in CASES:
    r = t.Root({"venue": V, "honeymoon": []})
    r.write("venue/enrichment-audit.json", AUD)
    if isinstance(doc, str):
        open(r.p(t.OVERRIDES), "w", encoding="utf-8").write(doc)
    else:
        r.write(t.OVERRIDES, doc)
    snap = r.tree()
    rc, out, calls = r.run(t.ENRICH, FX)
    line = next((l for l in out.splitlines() if l.startswith("OVERRIDE_FILE_INVALID")), "")
    if rc != 2 or not re.match(r"^OVERRIDE_FILE_INVALID %s\b" % re.escape(code), line) or (vid and vid not in line):
        bad.append("file sai %s: mong mã thoát 2 và 'OVERRIDE_FILE_INVALID %s%s', thấy rc=%r dòng=%r" % (code, code, " " + vid if vid else "", rc, line[:90]))
    if calls:
        bad.append("file sai %s: vẫn gọi Google %d lượt" % (code, len(calls)))
    if r.tree() != snap:
        bad.append("file sai %s: output/ bị đổi (phải từ chối trước khi làm gì)" % code)

# ---- C. vendor_id không tồn tại + D. code tự động không ghi file duyệt tay -------------------------------------------------------------------------
pl = {"PV": t.place("Nhà hàng Một", "1 Lê Lợi, Bến Thành, Hồ Chí Minh")}
r = t.Root({"venue": V, "honeymoon": []})
r.write("venue/enrichment-audit.json", AUD)
ent = [t.entry("t110_khong_co", "remove"), t.accept_with_snapshot("t110_v1", "PV", pl["PV"])]
r.set_overrides(ent)
raw = open(r.p(t.OVERRIDES), "rb").read()
rc, out, calls = r.run(t.ENRICH, t.fixture(pl, []))
if not any(l.startswith("OVERRIDE_ERROR t110_khong_co unknown_vendor") for l in out.splitlines()) or rc != 2:
    bad.append("vendor_id không tồn tại: mong 'OVERRIDE_ERROR t110_khong_co unknown_vendor' và mã thoát 2; thấy rc=%r" % rc)
if not t.has_pid(r.vendor("t110_v1")):
    bad.append("mục hợp lệ không được áp khi mục khác lỗi unknown_vendor")
rc, out, calls = r.run(t.REFRESH, t.fixture(pl, []))
if open(r.p(t.OVERRIDES), "rb").read() != raw:
    bad.append("enrich hoặc refresh_photos đã sửa file duyệt tay (chỉ Capu và bước resolve được ghi)")
t.done(bad, "file duyệt tay thật đúng schema và đủ 4 mục ADR-048 có quyết định của Capu; 11 kiểu file sai bị từ chối trước khi làm gì; unknown_vendor không chặn mục khác; code tự động không ghi file")
