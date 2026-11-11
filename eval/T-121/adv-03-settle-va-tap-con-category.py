#!/usr/bin/env python3
"""T-121 eval đối kháng 03 (adversary). Spec T-120 Hành vi 0, 4d, 5, 7. OFFLINE (Google giả, đúng lệnh CLI).
  (a) `--recheck-name-match --category flower` cho vendor N ở makeup+flower+invitation: đúng 1 Text Search, nhận ở CẢ BA file (đơn vị là id),
      báo cáo một dòng ở category đầu tiên (makeup), dù makeup không nằm trong lượt chạy.
  (b) Sau đó enrich.py thường với từng tập con category (flower; makeup; venue,honeymoon trống; all): 0 lượt Google, không hạ N/A (settle dùng luật hợp nhất),
      name-match-accepted.csv và mọi vendors.json/audit không đổi byte.
  (c) --recheck-name-match lần hai (all): 0 lượt Google, không file nào đổi.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import csv, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-120"))
import _t120 as h  # noqa: E402
t, x = h.t, h.x
bad = []
S = "%d Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"
V = [("n", "November Twin Boutique", ("makeup", "flower", "invitation")), ("a", "Lumen Alpha Makeup", ("makeup",)), ("e", "Nhà Hàng Echo Venue", ("venue",))]
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
root.run(x.enrich_all(cats), FX)
rc, out, calls = root.run(x.enrich_all(["flower"], extra=[h.RECHECK_FLAG]), FX)
if rc:
    t.fail("recheck --category flower thoát %d" % rc)
if len(x.queries(calls)) != 1 or x.count_for(calls, "november twin") != 1:
    bad.append("(a) mong đúng 1 Text Search cho N, thấy %r" % x.queries(calls))
for c in ("makeup", "flower", "invitation"):
    v = root.vendor("adv121_n", c)
    a = root.audit(c).get("adv121_n") or {}
    if t.pid_of(v) != "Pn" or a.get("accepted_by") != "name_near_exact" or v["contact"].get("address") != "21 Pasteur, Bến Nghé, Hồ Chí Minh":
        bad.append("(a) N ở %s: mong nhận theo tên (Pn, accepted_by, địa chỉ Google), thấy pid=%r audit=%r" % (c, t.pid_of(v), a.get("accepted_by")))


def report():
    out = {}
    for c in sorted(os.listdir(root.out)):
        p = root.p(os.path.join(c, "name-match-accepted.csv"))
        if os.path.exists(p):
            out[c] = [r["id"] for r in csv.DictReader(open(p, encoding="utf-8-sig", newline=""))]
    return out


if report() != {"makeup": ["adv121_n"]}:
    bad.append("(a) báo cáo mong {'makeup': ['adv121_n']}, thấy %r" % report())
root.run(x.enrich_all(cats, extra=[h.RECHECK_FLAG]), FX)   # nhận nốt A
tree = root.tree()
if not t.has_pid(root.vendor("adv121_a", "makeup")):
    bad.append("A không được nhận theo tên")
for sub in (["flower"], ["makeup"], ["invitation"], ["venue"], cats):
    rc, out, calls = root.run(x.enrich_all(sub), FX)
    if rc or x.queries(calls) or t.n_kind(calls, "media"):
        bad.append("(b) enrich.py thường --category %s: rc=%d, %d lượt Google" % (",".join(sub), rc, len(calls)))
    changed = sorted(k for k in set(tree) | set(root.tree()) if tree.get(k) != root.tree().get(k) and "run-logs" not in k)
    if changed:
        bad.append("(b) enrich.py thường --category %s đổi file %r" % (",".join(sub), changed[:4]))
        tree = root.tree()
rc, out, calls = root.run(x.enrich_all(cats, extra=[h.RECHECK_FLAG]), FX)
if rc or calls or root.tree() != tree:
    bad.append("(c) recheck lần hai: rc=%d, %d lượt Google, file đổi=%s" % (rc, len(calls), root.tree() != tree))
if t.has_pid(root.vendor("adv121_e", "venue")):
    bad.append("venue E được nhận (venue chỉ có đường 1)")
t.done(bad, "recheck theo tập con category áp mọi file (1 lượt/id); settle của lượt thường/tập con không hạ, không đổi byte; recheck lần hai 0 lượt")
