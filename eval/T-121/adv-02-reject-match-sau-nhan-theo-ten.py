#!/usr/bin/env python3
"""T-121 eval đối kháng 02 (adversary; spec-critic đề nghị ca này). Spec T-120 Hành vi 2, 5: vendor nhận theo tên rồi Capu ghi reject_match (T-110)
-> bị hạ ở MỌI category file: không place_id/ảnh, contact.address = address_source, dòng audit không accepted_by, và BIẾN MẤT khỏi name-match-accepted.csv
(sổ dựng lại từ trạng thái), dù lượt sau là enrich.py thường (không cờ). Vendor còn lại giữ dòng. 0 lượt Google cho lượt áp duyệt tay.
OFFLINE (Google giả, đúng lệnh CLI). In PASS hoặc FAIL <lý do>; thoát 0/1."""
import csv, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-120"))
import _t120 as h  # noqa: E402
t, x = h.t, h.x
bad = []
S = "%d Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"
V = [("n", "November Twin Boutique", ("makeup", "flower", "invitation")), ("a", "Lumen Alpha Makeup", ("makeup",)), ("r", "Rosa Reject Atelier", ("makeup",))]
files, PL, rules = {}, {}, []
for k, (vid, n, cs) in enumerate(V):
    for c in cs:
        files.setdefault(c, []).append(t.vendor("adv121_" + vid, n, S % (11 + k), (h.DIR_CATEGORY[c],)))
    PL["P" + vid] = t.place(n, "%d Pasteur, Bến Nghé, Hồ Chí Minh" % (21 + k), pid="P" + vid, nphotos=3)
    rules.append((h.fold(n), ["P" + vid]))
rules.sort(key=lambda r: -len(r[0]))
root = t.Root(files)
x.usage_logs(root, ts=0, details=0, media=0)
FX = x.fx(PL, rules)
cats = [c for c in h.ORDER if c in files]


def csv_ids():
    out = []
    for c in os.listdir(root.out):
        p = root.p(os.path.join(c, "name-match-accepted.csv"))
        if os.path.exists(p):
            out += [r["id"] for r in csv.DictReader(open(p, encoding="utf-8-sig", newline=""))]
    return sorted(out)


root.run(x.enrich_all(cats), FX)
rc, _, _ = root.run(x.enrich_all(cats, extra=[h.RECHECK_FLAG]), FX)
if rc or csv_ids() != ["adv121_a", "adv121_n", "adv121_r"]:
    t.fail("fixture: mong 3 vendor nhận theo tên sau --recheck-name-match, csv thấy %r" % csv_ids())
root.set_overrides([t.entry("adv121_n", "reject_match", place_id="Pn", reason="Capu: nhầm nhà (adv T-121)"),
                    t.entry("adv121_r", "reject_match", place_id="Pr", reason="Capu: nhầm nhà (adv T-121)")])
rc, out, calls = root.run(x.enrich_all(cats), FX)
if rc:
    t.fail("enrich.py thường thoát %d" % rc)
if x.queries(calls) or t.n_kind(calls, "media"):
    bad.append("áp reject_match mà gọi Google (%d Text Search, %d media)" % (len(x.queries(calls)), t.n_kind(calls, "media")))
if csv_ids() != ["adv121_a"]:
    bad.append("name-match-accepted.csv sau reject_match mong chỉ còn adv121_a, thấy %r" % csv_ids())
for vid in ("n", "r"):
    for c in cats:
        v = root.vendor("adv121_" + vid, c)
        if not v:
            continue
        a = root.audit(c).get("adv121_" + vid) or {}
        if t.has_pid(v) or v.get("google_photos") or v["contact"].get("address") != v["contact"].get("address_source"):
            bad.append("%s (%s): reject_match mà còn place_id/ảnh/địa chỉ Google" % (vid.upper(), c))
        if a.get("accepted_by") or a.get("status") == "enriched":
            bad.append("%s (%s): reject_match mà dòng audit còn %r/%r" % (vid.upper(), c, a.get("status"), a.get("accepted_by")))
if not t.has_pid(root.vendor("adv121_a", "makeup")):
    bad.append("A (không bị duyệt tay) bị hạ theo")
t.done(bad, "reject_match sau nhận theo tên: hạ ở mọi file, địa chỉ gốc, mất khỏi name-match-accepted.csv, 0 lượt Google")
