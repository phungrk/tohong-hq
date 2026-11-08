#!/usr/bin/env python3
"""T-106 tiêu chí 7 (spec rework T-108, v4): sáu cổng chống khớp nhầm địa điểm, đường LẦN ĐẦU (Text Search giả, KHÔNG gọi Google).
Spec: products/T-106-enrich-venue.md Hành vi 2 (G1..G6). Bảng ca: eval/T-106/gate_cases.json (ca thật từ audit PR tohong#72 + ca biên viết tay:
QL13 = Quốc lộ 13, địa chỉ thiếu số nhà ở một bên, ngưỡng confidence 0,95 ở hai phía, tỉnh/thành viết kiểu 'TP.HCM' / có mã bưu chính / thiếu).
Cách chạy: dựng thư mục output tạm có vendors.json của từng nhóm ca, chạy enrich.py như workflow (--state HCMC --category venue), HTTP giả trả đúng ứng viên
của bảng, rồi đọc vendors.json / enrichment-audit.json / review-needed.csv / removed_vendors.json. Nhóm nhiều vendor chạy cả hai thứ tự (xuôi và ngược):
kết quả cuối KHÔNG được phụ thuộc thứ tự vendor trong file.
Mong đợi theo `expect` của từng ca:
  accepted: còn trong vendors.json, enrichment_log google_maps có place_id của ứng viên, audit ok/enriched, không có dòng review.
  <mã lý do>: còn trong vendors.json NHƯNG không place_id, không google_photos; audit mới nhất status=low_confidence, reject_reason=<mã>, vẫn có matched_name,
              confidence, formatted_address; đúng MỘT dòng review-needed.csv với flags chứa low_confidence_place VÀ <mã>, có google_matched_name + google_confidence;
              contact.address_source còn nguyên.
  removed: gỡ khỏi vendors.json, có trong removed_vendors.json, audit closed_permanently (ADR-044).
Cuối cùng: dòng cuối stdout là GOOGLE_USAGE với text_search = số vendor chạy. Cần TOHONG_REPO. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import csv, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
import _adv_harness as h

here = os.path.dirname(os.path.abspath(__file__))
cases = json.load(open(os.path.join(here, "gate_cases.json"), encoding="utf-8"))
groups = [(cases["run_doc_lap"]["name"], cases["run_doc_lap"]["vendors"], [])]
groups += [(s["name"], s["vendors"], []) for s in cases["chung_place_id"]]
groups += [(s["name"], s["vendors"], []) for s in cases["nha_hang_dong_cua"]]
groups += [(s["name"], s["vendors"], s["preremoved"]) for s in cases["da_go_tu_truoc"]]

# 0. hàm chuẩn trong _common.py phải khớp bảng (khoá ngữ nghĩa, như address_pairs.json)
for name, vs, pre in groups:
    closed = [x for v in vs if v["expect"] == "removed" for x in (v["address"], v["place"]["address"])]
    closed += [x for p in pre for x in (p["address"], p["formatted_address"])]
    passing, ref = [], {}
    for v in vs:
        if v["expect"] == "removed":
            continue
        r = c.reject_reason(v["address"], v["place"]["address"], v["conf"], "HCMC", closed)
        ref[v["id"]] = r
        if r is None:
            passing.append((v["id"], v["place"]["id"], v["address"]))
    g = c.shared_place_id_groups(passing)
    for v in vs:
        if v["expect"] == "removed":
            continue
        r = ref[v["id"]] or ("shared_place_id" if v["id"] in g else None)
        if r != (None if v["expect"] == "accepted" else v["expect"]):
            c.fail("hàm chuẩn _common.py lệch bảng gate_cases.json ở ca %s (%s): hàm cho %r, bảng mong %r" % (v["id"], name, r, v["expect"]))


def vendor_of(v):
    return h.vendor(v["id"], v["name"], v["address"])


def run_group(vs, pre, order):
    seq = vs if order == "xuoi" else list(reversed(vs))
    root = h.make_root({"venue": [vendor_of(v) for v in seq]})
    vd = root / "output" / "HCMC" / "venue"
    if pre:
        (vd / "removed_vendors.json").write_text(json.dumps([
            {"removed_at": "2026-11-08T04:04:01Z", "reason": "google business CLOSED_PERMANENTLY",
             "vendor": {"id": p["id"], "name": p["name"], "city": "HCMC", "contact": {"address": p["address"], "address_source": p["address"]}}}
            for p in pre], ensure_ascii=False), encoding="utf-8")
        (vd / "enrichment-audit.json").write_text(json.dumps([
            {"vendor_id": p["id"], "status": "closed_permanently", "place_id": "pid_" + p["id"], "formatted_address": p["formatted_address"],
             "matched_name": p["name"], "confidence": 1.0} for p in pre], ensure_ascii=False), encoding="utf-8")
    places = {}
    for v in sorted(vs, key=lambda x: -len(x["name"])):
        pl = v["place"]
        places[v["name"]] = [h.place(pl["id"], pl["name"], pl["address"], pl.get("status"))]
    rc, out, calls = h.run_enrich(root, places)
    return root, rc, out, calls


def review_rows(root):
    p = root / "output" / "HCMC" / "venue" / "review-needed.csv"
    if not p.exists():
        return []
    return list(csv.DictReader(open(p, encoding="utf-8-sig", newline="")))


bad = []
n = 0
for name, vs, pre in groups:
    for order in (("xuoi", "nguoc") if len(vs) > 1 else ("xuoi",)):
        tag = "[%s | %s]" % (name, order)
        root, rc, out, calls = run_group(vs, pre, order)
        ids = h.all_ids(root)
        au, recs = h.audit(root), {v["id"]: v for v in h.vendors_in(root, "venue")}
        rows = review_rows(root)
        gone = [i for _, i in h.removed(root)]
        last = [l for l in out.strip().splitlines() if l.strip()][-1:] or [""]
        if not last[0].startswith("GOOGLE_USAGE") or "text_search=%d " % len(vs) not in last[0] + " ":
            bad.append("%s dòng cuối stdout %r, mong GOOGLE_USAGE text_search=%d (rc=%r)" % (tag, last[0][:80], len(vs), rc))
        for v in vs:
            n += 1
            i, exp, a = v["id"], v["expect"], au.get(v["id"]) or {}
            mine = [r for r in rows if (r.get("id") or "").strip() == i]
            if exp != "removed" and abs((a.get("confidence") or 0) - v["conf"]) > 0.002:
                bad.append("%s %s: confidence audit %r khác bảng %r (fixture hỏng hoặc audit thiếu)" % (tag, i, a.get("confidence"), v["conf"]))
                continue
            if exp == "removed":
                if i in ids or i not in gone or a.get("status") != "closed_permanently":
                    bad.append("%s %s: mong gỡ + removed_vendors.json + audit closed_permanently; còn trong vendors=%s, trong removed=%s, status=%r" % (tag, i, i in ids, i in gone, a.get("status")))
                continue
            r = recs.get(i)
            if r is None:
                bad.append("%s %s: vendor biến mất khỏi vendors.json (chỉ CLOSED_PERMANENTLY mới được gỡ)" % (tag, i)); continue
            e = c.google_log(r)
            if exp == "accepted":
                if not e or e.get("place_id") != v["place"]["id"]:
                    bad.append("%s %s: mong nhận khớp (%s) nhưng place_id=%r, audit status=%r reject_reason=%r" % (tag, i, v["place"]["address"][:40], e and e.get("place_id"), a.get("status"), a.get("reject_reason")))
                elif a.get("status") not in ("ok", "enriched") or mine or a.get("reject_reason"):
                    bad.append("%s %s: nhận khớp nhưng audit status=%r reject_reason=%r hoặc có dòng review" % (tag, i, a.get("status"), a.get("reject_reason")))
                continue
            problems = []
            if e: problems.append("còn place_id")
            if r.get("google_photos"): problems.append("còn google_photos")
            if a.get("status") != "low_confidence": problems.append("audit status=%r (mong low_confidence)" % a.get("status"))
            if a.get("reject_reason") != exp: problems.append("audit reject_reason=%r (mong %r)" % (a.get("reject_reason"), exp))
            if a.get("place_id"): problems.append("audit còn place_id")
            if not (a.get("matched_name") and a.get("confidence") and a.get("formatted_address")): problems.append("audit thiếu matched_name/confidence/formatted_address")
            if len(mine) != 1: problems.append("review-needed.csv có %d dòng (mong 1)" % len(mine))
            else:
                fl = (mine[0].get("flags") or "").split("|")
                if "low_confidence_place" not in fl or exp not in fl: problems.append("flags=%r thiếu low_confidence_place hoặc %s" % (mine[0].get("flags"), exp))
                if not (mine[0].get("google_matched_name") or "").strip() or not (mine[0].get("google_confidence") or "").strip(): problems.append("review thiếu google_matched_name/google_confidence")
            if (r.get("contact") or {}).get("address_source") != v["address"]: problems.append("contact.address_source không còn nguyên")
            if problems:
                bad.append("%s %s (mong %s): %s" % (tag, i, exp, "; ".join(problems)))
if bad:
    c.fail("%d/%d lần kiểm lệch luật nhận khớp v4:\n  " % (len(bad), n) + "\n  ".join(bad[:int(os.environ.get("T106_SHOW", "25"))]))
c.ok("%d lượt kiểm (ca thật + ca biên, cả hai thứ tự vendor) đúng sáu cổng, mã lý do, review, GOOGLE_USAGE" % n)
