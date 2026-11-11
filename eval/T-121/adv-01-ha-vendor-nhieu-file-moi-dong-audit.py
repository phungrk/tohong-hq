#!/usr/bin/env python3
"""T-121 eval đối kháng 01 (adversary, Code Gate). Spec T-120 Hành vi 0 (kết cục áp cho bản ghi VÀ dòng audit ở mọi category file có id),
Hành vi 3 (accepted_by chỉ trên vendor đang được nhận theo đường 2), Hành vi 7 (vendor nhận theo đường 2 bị hạ khi N1-N4 hết đúng, vd G6 mới).
OFFLINE (Google giả eval/T-111/_fake, chạy đúng lệnh CLI trong bản sao tools/scraper). Hai kịch bản:
  A  vendor N ở 3 file (makeup, flower, invitation) được nhận theo tên qua --recheck-name-match; sau đó scraper thêm vendor B (photography) khác địa chỉ gốc,
     Google trả CÙNG place_id và B qua sáu cổng -> G6: N bị hạ shared_place_id. Mong: ở CẢ BA file, bản ghi không place_id VÀ dòng audit không còn
     status=enriched, không còn accepted_by.
  B  vendor V (makeup) được nhận theo tên; sau đó cùng id xuất hiện ở category file venue (venue chỉ có đường 1) -> V bị hạ. Mong: ở mọi file, dòng audit
     không còn status=enriched/accepted_by khi bản ghi đã mất place_id.
Lỗi bắt được (PR #82, 2026-11-11): settle chỉ sửa dòng audit của file đang chạy (primary); dòng audit ở file khác giữ "enriched" + accepted_by=name_near_exact
cho vendor đã bị hạ. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-120"))
import _t120 as h  # noqa: E402
t, x = h.t, h.x
bad = []
S = "%d Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"


def stale(root, vid):
    """[(file, status, accepted_by)] cho file mà bản ghi không có place_id nhưng dòng audit còn enriched/accepted_by."""
    out = []
    for cat in sorted(os.listdir(root.out)):
        if not os.path.isdir(root.p(cat)):
            continue
        v = root.vendor(vid, cat)
        a = (root.audit(cat) or {}).get(vid) or {}
        if v and not t.has_pid(v) and (a.get("status") == "enriched" or a.get("accepted_by")):
            out.append((cat, a.get("status"), a.get("accepted_by")))
    return out


# --- A: G6 mới với vendor nhiều file
GA = "34 Pasteur, Bến Nghé, Hồ Chí Minh"
cats = ["makeup", "flower", "invitation"]
files = {c: [t.vendor("adv121_n", "November Twin Boutique", S % 24, (h.DIR_CATEGORY[c],))] for c in cats}
root = t.Root(files)
x.usage_logs(root, ts=0, details=0, media=0)
FX = x.fx({"Pn": t.place("November Twin Boutique", GA, pid="Pn", nphotos=3)}, [(h.fold("November Twin Boutique"), ["Pn"])])
rc0, _, _ = root.run(x.enrich_all(cats), FX)
rc1, out1, _ = root.run(x.enrich_all(cats, extra=[h.RECHECK_FLAG]), FX)
if rc0 or rc1 or not all(t.has_pid(root.vendor("adv121_n", c)) for c in cats):
    t.fail("fixture A: mong N được nhận theo tên ở cả 3 file sau --recheck-name-match (rc=%d/%d)" % (rc0, rc1))
root.write("photography/vendors.json", {"vendors": [t.vendor("adv121_b", "November Twin Boutique", GA, ("photography",))]})
rc2, out2, _ = root.run(x.enrich_all(["photography"] + cats), FX)
if rc2:
    t.fail("A: enrich.py thường thoát %d" % rc2)
if any(t.has_pid(root.vendor("adv121_n", c)) for c in cats):
    bad.append("A: G6 mới mà N còn place_id ở %r" % [c for c in cats if t.has_pid(root.vendor("adv121_n", c))])
s = stale(root, "adv121_n")
if s:
    bad.append("A: N đã bị hạ (G6) mà dòng audit còn enriched/accepted_by ở file %r" % s)

# --- B: id xuất hiện ở venue sau khi đã nhận theo tên
files = {"makeup": [t.vendor("adv121_v", "Velvet Later Hall", S % 26, (h.DIR_CATEGORY["makeup"],))]}
root = t.Root(files)
x.usage_logs(root, ts=0, details=0, media=0)
FX = x.fx({"Pv": t.place("Velvet Later Hall", "36 Pasteur, Bến Nghé, Hồ Chí Minh", pid="Pv", nphotos=3)}, [(h.fold("Velvet Later Hall"), ["Pv"])])
root.run(x.enrich_all(["makeup"]), FX)
root.run(x.enrich_all(["makeup"], extra=[h.RECHECK_FLAG]), FX)
if not t.has_pid(root.vendor("adv121_v", "makeup")):
    t.fail("fixture B: mong V được nhận theo tên trước khi có bản ghi venue")
root.write("venue/vendors.json", {"vendors": [t.vendor("adv121_v", "Velvet Later Hall", S % 26, ("venue",))]})
rc3, _, _ = root.run(x.enrich_all(["venue", "makeup"]), FX)
if rc3:
    t.fail("B: enrich.py thường thoát %d" % rc3)
if any(t.has_pid(root.vendor("adv121_v", c)) for c in ("venue", "makeup") if root.vendor("adv121_v", c)):
    bad.append("B: id có bản ghi venue mà vẫn giữ nhận theo tên")
s = stale(root, "adv121_v")
if s:
    bad.append("B: V đã bị hạ (có bản ghi venue) mà dòng audit còn enriched/accepted_by ở file %r" % s)
t.done(bad, "vendor nhận theo tên bị hạ (G6 mới, id thành venue): bản ghi và dòng audit ở mọi file cùng hạ, không còn accepted_by")
