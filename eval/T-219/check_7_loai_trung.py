#!/usr/bin/env python3
"""T-219 tiêu chí 7 (offline): loại trùng. Thế giới chuẩn: PE1 (place_id của vendor xe hoa), PV1 (place_id của một VENUE: mọi category), PR1 (place_id vendor đã gỡ),
PD2 (tên + địa chỉ giống vendor E2), PR2 (tên + địa chỉ giống vendor đã gỡ) bị loại với đúng lý do; P049 giống TÊN của E2 nhưng khác địa chỉ KHÔNG bị loại.
Place trùng không được tới Gemini (phân loại/enrich) hay Place Details. Báo cáo: text_search_results=216 unique_places=54 duplicates_existing=3 duplicates_removed=2 new=49."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
r, rc, out, calls, meta = k.full_run()
dup = k.Root.rows(r, "p0-out/t/private/duplicates.csv")
if not dup or not {"place_id", "name", "address", "reason"} <= set(dup[0]):
    bad.append("thiếu private/duplicates.csv với cột place_id,name,address,reason")
else:
    got = {x["place_id"]: x["reason"] for x in dup}
    exp = {"PE1": "place_id_existing", "PV1": "place_id_existing", "PR1": "place_id_removed", "PD2": "name_address_existing", "PR2": "name_address_removed"}
    if got != exp or len(dup) != 5:
        bad.append("duplicates.csv %r, kỳ vọng %r (mỗi place_id một dòng)" % (got, exp))
cand = r.rows("p0-out/t/private/candidates.csv") or []
ids = [x["place_id"] for x in cand]
if sorted(ids) != sorted(meta["new_ids"]) or "P049" not in ids:
    bad.append("candidates.csv phải gồm đúng 49 ứng viên mới (có P049 giống tên khác địa chỉ), thấy %d" % len(ids))
for c in calls:
    blob = c["text"] if c["kind"] == "gemini" else c["url"]
    for d in meta["dups"]:
        if re.search(r"(?<![A-Za-z0-9])%s(?![A-Za-z0-9])" % d, blob):
            bad.append("place trùng %s bị gửi tới %s" % (d, c["kind"]))
            break
    if c["kind"] == "gemini" and c["role"] == "enrich" and "Đã Gỡ" in c["text"]:
        bad.append("vendor đã gỡ bị enrich")
rep = k.read_report(r) or {}
cd = rep.get("candidates") or {}
exp = {"text_search_results": 216, "unique_places": 54, "duplicates_existing": 3, "duplicates_removed": 2, "new": 49}
if {x: cd.get(x) for x in exp} != exp:
    bad.append("báo cáo candidates %r, kỳ vọng %r" % ({x: cd.get(x) for x in exp}, exp))
k.done(bad, "5 trùng bị loại đúng lý do và không tới Gemini/Details; giống tên khác địa chỉ không bị loại; số đếm khớp")
