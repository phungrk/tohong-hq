#!/usr/bin/env python3
"""Bản nháp bất biến T-126 (đề xuất INV-029, vùng planner/vendor/images; spec products/T-126-bo-qua-nhan-khop-it-review.md, Hành vi 1-3).
INV-029 · Vendor đang giữ nhận khớp Google (place_id) thì nơi đó có >= 2 đánh giá Google, trừ khi Capu duyệt tay.
Với mọi vendor ở tools/scraper/output/HCMC/*/vendors.json có enrichment_log[google_maps] (mới nhất) có place_id, TRỪ bản ghi manual_override=true hoặc có mục accept_place cùng vendor_id
trong manual_overrides.json (Capu thắng, ADR-048):
  số đánh giá đã biết = audit.google_review_count (dòng audit ở bất kỳ category file có id, nếu có) | reviews[source=google_maps].count | enrichment_log.changes.review_count (khi có rating);
  (i) nếu đã biết thì phải >= 2;
  (ii) nếu KHÔNG biết (log không có rating): vi phạm khi timestamp của dòng log >= 2026-11-08 (lần đọc có userRatingCount trong mask; Google bỏ trường khi 0 đánh giá); log cũ hơn: chưa đo được, không tính.
Lý do: cặp đôi không thấy trên app ảnh/địa chỉ Google của một nơi chỉ có 0-1 đánh giá (không đáng tin: ý định Capu 2026-11-11, 2 vendor trong tohong#83).
Đỏ hôm nay trên tohong origin/main (62ee2f8) và trên PR #83; xanh sau khi lần áp ngược T-126 (--apply-review-rule rồi --confirm-review-count) được merge (dữ liệu, ADR-028).
Repo: TOHONG_REPO, rồi ../tohong cạnh tohong-hq. Không thấy dữ liệu: PASS "chưa áp dụng". Không gọi Google. Chạy không tham số (python3 -I). In PASS hoặc FAIL <lý do>. Thoát 0/1."""
import glob, json, os, sys

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FRESH = "2026-11-08"
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if c and os.path.isdir(os.path.join(c, "tools", "scraper", "output", "HCMC"))), None)
if not repo:
    print("PASS chưa áp dụng (không thấy dữ liệu repo tohong)")
    sys.exit(0)
out = os.path.join(repo, "tools", "scraper", "output", "HCMC")


def load(p, default):
    try:
        return json.load(open(p, encoding="utf-8"))
    except (OSError, ValueError):
        return default


ov = load(os.path.join(out, "manual_overrides.json"), {})
accepted = {e.get("vendor_id") for e in (ov.get("overrides") if isinstance(ov, dict) else []) or [] if e.get("action") == "accept_place"}
audit_count = {}
for f in glob.glob(os.path.join(out, "*", "enrichment-audit.json")):
    for r in load(f, []):
        if r.get("google_review_count") is not None and r.get("vendor_id"):
            audit_count[r["vendor_id"]] = r["google_review_count"]
seen, bad = set(), []
for f in sorted(glob.glob(os.path.join(out, "*", "vendors.json"))):
    d = load(f, {})
    for v in (d.get("vendors", d) if isinstance(d, dict) else d):
        lg = [e for e in v.get("enrichment_log") or [] if e.get("source") == "google_maps" and e.get("place_id")]
        vid = v.get("id")
        if not lg or vid in seen:
            continue
        seen.add(vid)
        e = lg[-1]
        if e.get("manual_override") or vid in accepted:
            continue
        gr = [r for r in v.get("reviews") or [] if r.get("source") == "google_maps" and r.get("count") is not None]
        n = audit_count.get(vid)
        if n is None and gr:
            n = gr[-1]["count"]
        if n is None and "rating" in (e.get("changes") or {}):
            n = (e["changes"]).get("review_count", 0)
        if n is None:
            if (e.get("timestamp") or "")[:10] >= FRESH:
                bad.append("%s %s: không có rating (0 đánh giá) mà giữ place_id %s" % (vid, (v.get("name") or "")[:30], e["place_id"]))
        elif n < 2:
            bad.append("%s %s: %d đánh giá mà giữ place_id %s" % (vid, (v.get("name") or "")[:30], n, e["place_id"]))
if bad:
    print("FAIL %d vendor giữ nhận khớp Google với < 2 đánh giá, vd: %s" % (len(bad), " | ".join(bad[:3])))
    sys.exit(1)
print("PASS %d vendor giữ nhận khớp Google, đều >= 2 đánh giá (hoặc Capu duyệt tay)" % len(seen))
