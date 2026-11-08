#!/usr/bin/env python3
"""T-106 tiêu chí 8 (spec rework T-108, v4): ÁP LẠI sáu cổng lên dữ liệu đã enrich bằng luật cũ, OFFLINE (không Google, không khoá API).
Spec: products/T-106-enrich-venue.md Hành vi 2 mục "Áp lại". Dựng thư mục output tạm ở trạng thái như PR tohong#72 (vendor đã nhận place_id + ảnh Google +
thông tin Google ghi đè contact.address/phone/website/rating/geo; audit status=enriched), rồi chạy ĐÚNG lệnh enrich của workflow
(--state HCMC --category venue --budget 5.0) khi: mọi HTTP (post/get) ném lỗi, biến GOOGLE_MAPS_API_KEY KHÔNG đặt.
Mong đợi:
  1. Không có lượt Google nào; dòng cuối stdout GOOGLE_USAGE text_search=0 photo_details=0 photo_media=0.
  2. Vendor bị luật mới từ chối (ca thật: Fleur de Lys Q1, Kalina, The ADORA, Grand Palace, Luxury Palace, Silver Creek ở CẢ HAI category venue + honeymoon) về trạng thái
     'như chưa từng khớp' trong MỌI category file có id đó: không place_id (enrichment_log), không google_photos, contact.address = contact.address_source,
     không reviews/top_reviews source google_maps, không merchant_description, không geo_confidence 'exact', contact.phone/website không còn giá trị Google đã ghi;
     audit mới nhất status=low_confidence + reject_reason đúng mã (có matched_name/confidence/formatted_address, không place_id); đúng MỘT dòng review-needed.csv
     (flags chứa low_confidence_place và mã; có google_matched_name, google_confidence). contact.address_source nguyên vẹn.
  3. Vendor được nhận (đối chứng: Tân Sơn Nhất 200 vs 202 cùng đường, hai vendor Pavillon chung place_id cùng địa chỉ) KHÔNG đổi: còn place_id, ảnh, địa chỉ Google, audit enriched, không dòng review.
  4. Chạy lần hai: không đổi gì (idempotent): cùng tập vendor bị hạ, mỗi vendor đúng một dòng review, không vendor nào mất.
Cần TOHONG_REPO. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import contextlib, csv, io, json, os, sys
from unittest import mock
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
import _adv_harness as h

here = os.path.dirname(os.path.abspath(__file__))
cases = json.load(open(os.path.join(here, "gate_cases.json"), encoding="utf-8"))
real = {}
for v in cases["run_doc_lap"]["vendors"] + [x for s in cases["chung_place_id"] for x in s["vendors"]]:
    real[v["id"]] = v
G_PHONE, G_WEB = "GOOGLE-PHONE-0000", "https://google-site.example/x"
DEMOTE = {"marry_8fa049d68064": "out_of_province", "marry_4faee6c1f2ab": "address_conflict", "marry_a84d73bc78b2": "address_unconfirmed",
          "marry_ae22b3a8f79b": "address_conflict", "marry_9c3f1ad337b2": "address_conflict", "marry_2650cc6ef8a1": "address_conflict"}
KEEP = ["marry_597d56365622", "marry_6a6dc5ec7c7e", "marry_ee9f9a427838"]
ALSO_HONEYMOON = {"marry_2650cc6ef8a1"}


def old_state(v):
    pl = v["place"]
    am = c.address_match(v["address"], pl["address"])
    if not c.accept_match(v["conf"], am):
        c.fail("fixture hỏng: luật cũ lẽ ra nhận %s" % v["id"])
    r = h.vendor(v["id"], v["name"], pl["address"])
    r["contact"].update({"address_source": v["address"], "phone": G_PHONE, "website": G_WEB})
    r.update({"latitude": 10.1, "longitude": 106.1, "geo_confidence": "exact", "merchant_description": "mô tả từ Google",
              "reviews": [{"source": "google_maps", "rating": 4.7, "count": 10}],
              "top_reviews": [{"source": "google_maps", "author": "a", "rating": 5, "text": "t"}],
              "google_photos": [{"uri": "https://lh3.googleusercontent.com/test-" + v["id"], "attribution": "tác giả"}]})
    r["enrichment_log"] = [{"source": "google_maps", "timestamp": "2026-11-08T04:03:36", "matched_name": pl["name"], "confidence": v["conf"],
                            "place_id": pl["id"], "formatted_address": pl["address"], "address_match": am,
                            "changes": {"phone": G_PHONE, "website": G_WEB, "address": pl["address"], "rating": 4.7, "review_count": 10,
                                        "top_reviews": 1, "merchant_description": True, "geo": True, "geo_confidence": "exact"}}]
    return r


ids = list(DEMOTE) + KEEP
files = {"venue": [old_state(real[i]) for i in ids], "honeymoon": [old_state(real[i]) for i in ALSO_HONEYMOON]}
root = h.make_root(files)
vd = root / "output" / "HCMC" / "venue"
(vd / "enrichment-audit.json").write_text(json.dumps([
    {"vendor_id": i, "status": "enriched", "matched_name": real[i]["place"]["name"], "confidence": real[i]["conf"], "place_id": real[i]["place"]["id"],
     "formatted_address": real[i]["place"]["address"], "address_match": c.address_match(real[i]["address"], real[i]["place"]["address"])} for i in ids],
    ensure_ascii=False), encoding="utf-8")


def offline_run():
    calls = []

    def boom(*a, **k):
        calls.append(a[:1])
        raise AssertionError("eval cấm HTTP: %r" % (a[:1],))

    env = {k: v for k, v in os.environ.items() if k != "GOOGLE_MAPS_API_KEY"}
    out, err = io.StringIO(), None
    with mock.patch.object(h.enrich, "SCRIPT_DIR", root), mock.patch.object(h.enrich, "OUTPUT_DIR", root / "output"), \
            mock.patch("enrichment.google_maps.requests.post", side_effect=boom), mock.patch("requests.get", side_effect=boom), \
            mock.patch.object(sys, "argv", ["enrich.py", "--state", "HCMC", "--category", "venue", "--budget", "5.0"]), \
            mock.patch.dict(os.environ, env, clear=True), contextlib.redirect_stdout(out):
        try:
            rc = h.enrich.main()
        except SystemExit as e:
            rc = e.code
        except Exception as e:  # noqa: BLE001  lệnh enrich chết khi không có khoá = lệch spec, không phải lỗi eval
            rc, err = None, e
    if rc is None and err:
        c.fail("lệnh enrich venue chết khi chạy offline (không đặt GOOGLE_MAPS_API_KEY, mọi HTTP bị chặn): %s: %s" % (type(err).__name__, str(err)[:120]))
    return rc, out.getvalue(), calls


def review_rows():
    p = vd / "review-needed.csv"
    return list(csv.DictReader(open(p, encoding="utf-8-sig", newline=""))) if p.exists() else []


def snapshot():
    s = {}
    for cat in ("venue", "honeymoon"):
        for r in h.vendors_in(root, cat):
            s[(cat, r["id"])] = (bool(c.google_log(r)), bool(r.get("google_photos")), (r.get("contact") or {}).get("address"))
    return s, sorted(r.get("id") for r in review_rows())


bad = []
rc, out, calls = offline_run()
last = [l for l in out.strip().splitlines() if l.strip()][-1:] or [""]
if calls:
    bad.append("có %d lượt gọi HTTP" % len(calls))
if last[0].strip() != "GOOGLE_USAGE text_search=0 photo_details=0 photo_media=0":
    bad.append("dòng cuối stdout %r, mong GOOGLE_USAGE text_search=0 photo_details=0 photo_media=0 (rc=%r)" % (last[0][:90], rc))
au, rows = h.audit(root), review_rows()
for i, code in DEMOTE.items():
    for cat in ("venue", "honeymoon"):
        if cat == "honeymoon" and i not in ALSO_HONEYMOON:
            continue
        r = next((x for x in h.vendors_in(root, cat) if x["id"] == i), None)
        tag = "%s/%s (mong %s)" % (cat, i, code)
        if r is None:
            bad.append("%s: biến mất khỏi vendors.json" % tag); continue
        p = []
        if c.google_log(r): p.append("còn place_id")
        if r.get("google_photos"): p.append("còn google_photos")
        ct = r.get("contact") or {}
        if ct.get("address") != ct.get("address_source") or ct.get("address_source") != real[i]["address"]: p.append("contact.address=%r != address_source gốc" % (ct.get("address") or "")[:40])
        if any(x.get("source") == "google_maps" for x in (r.get("reviews") or []) + (r.get("top_reviews") or [])): p.append("còn reviews/top_reviews của Google")
        if r.get("merchant_description"): p.append("còn merchant_description")
        if r.get("geo_confidence") == "exact": p.append("còn geo_confidence=exact")
        if ct.get("phone") == G_PHONE or ct.get("website") == G_WEB: p.append("còn phone/website do Google ghi")
        if p: bad.append("%s: %s" % (tag, "; ".join(p)))
    a, mine = au.get(i) or {}, [x for x in rows if (x.get("id") or "").strip() == i]
    p = []
    if a.get("status") != "low_confidence" or a.get("reject_reason") != code: p.append("audit status=%r reject_reason=%r" % (a.get("status"), a.get("reject_reason")))
    if a.get("place_id"): p.append("audit còn place_id")
    if not (a.get("matched_name") and a.get("confidence") and a.get("formatted_address")): p.append("audit mất matched_name/confidence/formatted_address")
    if len(mine) != 1: p.append("review có %d dòng" % len(mine))
    else:
        fl = (mine[0].get("flags") or "").split("|")
        if "low_confidence_place" not in fl or code not in fl: p.append("flags=%r" % mine[0].get("flags"))
        if not (mine[0].get("google_matched_name") or "").strip() or not (mine[0].get("google_confidence") or "").strip(): p.append("review thiếu google_matched_name/google_confidence")
    if p: bad.append("audit/review %s (mong %s): %s" % (i, code, "; ".join(p)))
for i in KEEP:
    r = next((x for x in h.vendors_in(root, "venue") if x["id"] == i), None)
    a, mine = au.get(i) or {}, [x for x in rows if (x.get("id") or "").strip() == i]
    if r is None or not c.google_log(r) or not r.get("google_photos") or (r.get("contact") or {}).get("address") != real[i]["place"]["address"] \
            or a.get("status") not in ("ok", "enriched") or mine:
        bad.append("đối chứng %s bị đổi (place_id=%s, ảnh=%s, audit=%r, review=%d)" % (i, bool(r and c.google_log(r)), bool(r and r.get("google_photos")), a.get("status"), len(mine)))
before = snapshot()
rc2, out2, calls2 = offline_run()
if snapshot() != before or calls2:
    bad.append("chạy lần hai làm đổi dữ liệu hoặc gọi HTTP (idempotent bị phá)")
if bad:
    c.fail("%d lệch khi áp lại luật v4 offline:\n  " % len(bad) + "\n  ".join(bad[:int(os.environ.get("T106_SHOW", "25"))]))
c.ok("áp lại sáu cổng offline: %d vendor bị hạ về như chưa khớp (cả bản honeymoon), %d đối chứng giữ nguyên, 0 lượt Google, idempotent" % (len(DEMOTE), len(KEEP)))
