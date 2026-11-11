#!/usr/bin/env python3
"""T-121 eval đối kháng 05 (adversary, Code Gate v2 2026-11-11). Spec T-120 Hành vi 1 N4 + Hành vi 6 (G6: hai vendor khác địa chỉ gốc chung place_id thì CẢ HAI
bị shared_place_id, vendor nhận theo đường 2 là thành viên nhóm G6 như mọi vendor đã nhận), Hành vi 0 (kết cục áp cho dòng audit ở mọi file), Hành vi 7.
OFFLINE (Google giả, đúng lệnh CLI). Lượt hỏi lại Google trả CÙNG một nơi P cho hai vendor khác địa chỉ gốc, đều đủ luật tên (Hành vi 4c cho phép Google đổi ý):
  A  vendor A ở makeup, B ở invitation (mỗi vendor một file)                -> cả hai bị hạ shared_place_id, không ai giữ P, csv không có ai
  B  vendor A ở makeup + flower, B ở invitation                              -> như trên, VÀ dòng audit của A ở flower không còn enriched/accepted_by (INV-027)
Lỗi bắt được (PR #82 v2): settle của category sau xét vendor đã bị hạ theo tên bằng sáu cổng (đường 1) nên nó rơi khỏi nhóm G6, vendor kia giữ P;
và dòng this_run của file khác ghi đè dòng audit đã hạ. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import csv, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-120"))
import _t120 as h  # noqa: E402
t, x = h.t, h.x
bad = []
S = "%d Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"
NA, NB = "November Twin Boutique", "November Twin Boutiques"
PL = {"PA": t.place(NA, "21 Pasteur, Bến Nghé, Hồ Chí Minh", pid="PA"), "PB": t.place(NB, "22 Pasteur, Bến Nghé, Hồ Chí Minh", pid="PB"),
      "P": t.place(NA, "23 Pasteur, Bến Nghé, Hồ Chí Minh", pid="P")}
FX0 = x.fx(PL, [(h.fold(NB), ["PB"]), (h.fold(NA), ["PA"])])
FX1 = x.fx(PL, [(h.fold(NB), ["P"]), (h.fold(NA), ["P"])])


def scenario(label, a_cats):
    files = {}
    for c in a_cats:
        files.setdefault(c, []).append(t.vendor("adv121_a", NA, S % 11, (h.DIR_CATEGORY[c],)))
    files["invitation"] = [t.vendor("adv121_b", NB, S % 77, (h.DIR_CATEGORY["invitation"],))]
    cats = [c for c in h.ORDER if c in files]
    root = t.Root(files)
    x.usage_logs(root, ts=0, details=0, media=0)
    root.run(x.enrich_all(cats), FX0)
    for c in cats:
        for vid, a in root.audit(c).items():
            if a.get("status") != "low_confidence" or a.get("reject_reason") not in h.ELIGIBLE_REASONS:
                t.fail("%s fixture: %s/%s mong low_confidence vì địa chỉ, thấy %r" % (label, c, vid, (a.get("status"), a.get("reject_reason"))))
    rc, out, calls = root.run(x.enrich_all(cats, extra=[h.RECHECK_FLAG]), FX1)
    if rc or len(x.queries(calls)) != 2:
        t.fail("%s: recheck rc=%d, %d Text Search (mong 2)" % (label, rc, len(x.queries(calls))))
    for c in cats:
        for v in root.vendors(c):
            a = root.audit(c).get(v["id"]) or {}
            if t.has_pid(v):
                bad.append("%s: %s (%s) còn giữ place_id %s dù vendor khác địa chỉ gốc cũng nhận P (G6: cả hai bị hạ)" % (label, v["id"], c, t.pid_of(v)))
            if a.get("status") == "enriched" or a.get("accepted_by"):
                bad.append("%s: dòng audit %s (%s) còn %r/%r" % (label, v["id"], c, a.get("status"), a.get("accepted_by")))
            elif a.get("reject_reason") != "shared_place_id":
                bad.append("%s: %s (%s) mong reject_reason shared_place_id, thấy %r" % (label, v["id"], c, a.get("reject_reason")))
    ids = []
    for c in os.listdir(root.out):
        p = root.p(os.path.join(c, "name-match-accepted.csv"))
        if os.path.exists(p):
            ids += [r["id"] for r in csv.DictReader(open(p, encoding="utf-8-sig", newline=""))]
    if ids:
        bad.append("%s: name-match-accepted.csv còn %r" % (label, ids))
    tree = root.tree()
    rc, out, calls = root.run(x.enrich_all(cats), FX1)
    if calls or root.tree() != tree:
        bad.append("%s: enrich.py thường sau đó gọi Google/đổi file (chưa hội tụ)" % label)


scenario("A", ("makeup",))
scenario("B", ("makeup", "flower"))
t.done(bad, "G6 giữa hai vendor nhận theo tên ở hai category: cả hai bị hạ, mọi dòng audit hạ theo, csv rỗng, chạy thêm không đổi")
