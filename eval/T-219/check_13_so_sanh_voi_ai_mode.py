#!/usr/bin/env python3
"""T-219 tiêu chí 13 (offline): so Gemini (lược đồ prompt 2) với vàng Google AI Mode trên 30 venue (chọn theo sha1(id)). Với từng trường (giá, mô tả, sức chứa, liên hệ = điện thoại + website;
facebook không còn vì prompt 2 không hỏi), eval tự chấm bằng bản viết lại độc lập của quy tắc spec (Hành vi 8) rồi so với compare.fields của báo cáo; vendor same_vendor=false: mọi trường
Gemini coi như rỗng (và báo cáo compare.same_vendor_false đếm chúng): đủ 6 hạng mục agree/disagree/gemini_only/ai_mode_only/both_missing/disjoint và agreement_rate
= agree/(agree+disagree) (4 chữ số, null khi mẫu số 0); compare.venues=30; proposal.gemini_vs_ai_mode theo luật spec; compare.json có 30 dòng per_vendor khớp."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
r, rc, out, calls, meta = k.full_run()
chunks = [{"uri": "x", "title": "example.org"}]  # mọi nguồn của thế giới chuẩn có title example.org; nguồn other.net không có trong grounding
per = {v: k.score(meta["gem_ven"][v], meta["gold"][v], chunks) for v in meta["sample_ids"]}
exp = {f: {c: sum(1 for v in per.values() if v[f] == c) for c in k.CATS} for f in k.FIELDS}
for f in k.FIELDS:
    d = exp[f]["agree"] + exp[f]["disagree"]
    exp[f]["agreement_rate"] = round(exp[f]["agree"] / d, 4) if d else None
rep = k.read_report(r) or {}
cp = rep.get("compare") or {}
if cp.get("venues") != 30:
    bad.append("compare.venues=%r, kỳ vọng 30" % cp.get("venues"))
for f in k.FIELDS:
    got = (cp.get("fields") or {}).get(f) or {}
    for c in k.CATS:
        if got.get(c) != exp[f][c]:
            bad.append("%s.%s = %r, kỳ vọng %r" % (f, c, got.get(c), exp[f][c]))
    ga, ea = got.get("agreement_rate"), exp[f]["agreement_rate"]
    if (ga is None) != (ea is None) or (ea is not None and abs(ga - ea) > 5e-5):
        bad.append("%s.agreement_rate = %r, kỳ vọng %r" % (f, ga, ea))
pz = rep.get("price") or {}
gv, am = pz.get("gemini_venue", {}).get("rate"), pz.get("ai_mode_venue", {}).get("rate")
pa = exp["price"]["agreement_rate"]
if cp.get("same_vendor_false") != sum(1 for v in meta["sample_ids"] if meta["gem_ven"][v]["same_vendor"] is False) or not cp.get("same_vendor_false"):
    bad.append("compare.same_vendor_false = %r, kỳ vọng số venue mẫu có same_vendor=false (>=1)" % cp.get("same_vendor_false"))
if None in (gv, am) or pa is None:
    prop = "chua_du_du_lieu"
else:
    prop = "ngang" if gv >= am - 0.10 + 1e-9 and pa >= 0.70 else "kem"
if (cp.get("proposal") or {}).get("gemini_vs_ai_mode") != prop or not (cp.get("proposal") or {}).get("rule"):
    bad.append("proposal.gemini_vs_ai_mode = %r, kỳ vọng %r (kèm rule)" % (cp.get("proposal"), prop))
p = os.path.join(r.path, "p0-out/t/private/compare.json")
cj = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
pv = cj.get("per_vendor") or []
if len(pv) != 30 or {x.get("id") for x in pv} != set(meta["sample_ids"]):
    bad.append("compare.json phải có per_vendor 30 venue đúng tập mẫu")
else:
    for x in pv:
        if any(x.get(f) != per[x["id"]][f] for f in k.FIELDS):
            bad.append("compare.json %s: hạng mục theo trường %r, kỳ vọng %r" % (x["id"], {f: x.get(f) for f in k.FIELDS}, per[x["id"]]))
            break
k.done(bad, "so sánh bốn trường khớp bản chấm độc lập của spec trên 30 venue, đủ 6 hạng mục, tỉ lệ khớp và đề xuất đúng luật")
