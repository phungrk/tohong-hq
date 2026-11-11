"""Helper dùng chung cho eval T-126 (luật enrich: bỏ qua nơi Google có <= 1 đánh giá; áp ngược cho vendor đã nhận). KHÔNG eval nào gọi Google thật:
mọi lệnh CLI chạy trong bản sao tools/scraper của repo `tohong` (không có output/ thật), với Google GIẢ eval/T-126/_fake (bản của T-111 + số đánh giá + Place Details theo field mask).
Eval chạy ĐÚNG lệnh CLI mà spec T-126 định nghĩa, không gọi hàm nội bộ. Dùng lại hạ tầng T-110/T-111/T-120. Biến môi trường: TOHONG_REPO. In PASS hoặc FAIL <lý do>; thoát 0/1.
Thiếu cài đặt (cờ CLI chưa có) thì FAIL, không ERROR."""
import csv, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-120"))
sys.path.insert(0, HERE)
import _t120 as h  # noqa: E402

x, t = h.x, h.t
t.FAKE = os.path.join(HERE, "_fake")          # Google giả có số đánh giá (ghi đè Google giả của T-111)
APPLY = "--apply-review-rule"                  # cờ CLI (spec T-126, Hành vi 3): offline, 0 request
CONFIRM = "--confirm-review-count"             # cờ CLI (Hành vi 4): Place Details, mask chỉ userRatingCount
REPORT = "low-review-demoted.csv"              # báo cáo cho Capu (Hành vi 6)
CODE = "few_reviews"                           # reject_reason trong audit
MIN_REVIEWS = 2
FRESH_FROM = "2026-11-08"                      # dòng log google_maps từ ngày này = "đọc mới" (mask đầy đủ có userRatingCount, ADR-049/T-111)
NEW_TS, OLD_TS = "2026-11-09T14:30:00.000000", "2026-06-16T13:29:00.000000"
PD_USD = 0.020                                 # Place Details Enterprise, $/request (developers.google.com/maps/billing-and-pricing/pricing)
ADDR = "%d Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"
CITY = os.path.join("output", "HCMC")


def pl(name, addr, pid, n=None, status="OPERATIONAL", nphotos=2, details_status=None):
    """Nơi trên Google giả. n = số đánh giá (0/None: Google BỎ trường rating và userRatingCount)."""
    p = t.place(name, addr, status=status, nphotos=nphotos, pid=pid)
    p["n_reviews"] = n
    if details_status:
        p["details_status"] = details_status
    return p


def matched(vid, name, addr, cat, pid, ts, count, cats=None, manual=False):
    """Vendor ĐÃ nhận khớp Google (đọc ở thời điểm ts, số đánh giá đã lưu = count; None = log không có trường rating). Địa chỉ gốc = địa chỉ Google nên sáu cổng giữ nguyên nhận khớp."""
    v = t.vendor(vid, name, addr, tuple(h.DIR_CATEGORY.get(c, c) for c in (cats or [cat])))
    ch = {"address": addr, "geo": True, "geo_confidence": "exact"}
    if count is not None:
        ch["rating"] = 4.5
        ch["review_count"] = count
        v["reviews"] = [{"source": "google_maps", "rating": 4.5, "count": count, "last_updated": ts}]
    log = {"source": "google_maps", "timestamp": ts, "matched_name": name, "confidence": 1.0, "place_id": pid, "formatted_address": addr, "address_match": True, "changes": ch}
    if manual:
        log["manual_override"] = True
    v["enrichment_log"] = [log]
    v["google_photos"] = [{"photoUri": "https://lh3.googleusercontent.com/fixture/%s_%d" % (pid, k), "attributions": [{"displayName": "Tác giả %d" % k}]} for k in range(2)]
    v["geo_confidence"] = "exact"
    return v


def audit_row(v, pid, manual=False):
    log = t.glog(v)
    row = {"vendor_id": v["id"], "status": "enriched", "reason": "", "enriched_fields": {}, "matched_name": v["name"], "confidence": 1.0, "place_id": pid,
           "formatted_address": log["formatted_address"], "address_match": True}
    if manual:
        row["manual_override"] = "accept_place"
    return row


def seed(files, extra_audit=(), parent=None):
    """Dựng Root từ {category: [vendor]} và ghi dòng audit `enriched` cho mọi vendor đã có place_id."""
    root = t.Root(files, parent=parent)
    x.usage_logs(root, ts=0, details=0, media=0, baseline_photos=0, baseline_ts=0)
    for cat, vs in files.items():
        rows = [audit_row(v, t.pid_of(v), manual=bool((t.glog(v) or {}).get("manual_override"))) for v in vs if t.has_pid(v)] + [r for r in extra_audit if r.get("_cat") == cat]
        root.write(os.path.join(cat, "enrichment-audit.json"), [{k: val for k, val in r.items() if k != "_cat"} for r in rows])
    return root


def report_rows(root):
    """Mọi dòng low-review-demoted.csv ở mọi category dir."""
    rows = []
    for cat in sorted(os.listdir(root.out)):
        p = root.p(os.path.join(cat, REPORT))
        if os.path.isfile(p):
            rows += [dict(r, _cat=cat) for r in csv.DictReader(open(p, encoding="utf-8-sig", newline=""))]
    return rows


def audits(root, vid):
    return [(c, root.audit(c).get(vid)) for c in sorted(os.listdir(root.out)) if os.path.isdir(root.p(c)) and root.audit(c).get(vid)]


def demoted_state_ok(root, vid, want_review_count=None):
    """Vendor 'bị hạ vì ít review' đúng định nghĩa: ở lại vendors.json mọi file, không place_id/google_photos/phone-website Google, địa chỉ = địa chỉ gốc, audit low_confidence few_reviews
    + candidate_place_id + google_review_count; không nằm trong removed_vendors.json. Trả danh sách lỗi."""
    bad, seen = [], 0
    for cat in sorted(os.listdir(root.out)):
        if not os.path.isdir(root.p(cat)):
            continue
        v = root.vendor(vid, cat)
        if not v:
            continue
        seen += 1
        if t.has_pid(v) or v.get("google_photos"):
            bad.append("%s/%s còn place_id hoặc google_photos" % (cat, vid))
        if v["contact"].get("address") != v["contact"].get("address_source"):
            bad.append("%s/%s: contact.address không về địa chỉ gốc" % (cat, vid))
        if any(r.get("source") == "google_maps" for r in v.get("reviews") or []):
            bad.append("%s/%s: còn reviews của Google" % (cat, vid))
        a = root.audit(cat).get(vid) or {}
        if a.get("status") != "low_confidence" or a.get("reject_reason") != CODE or not a.get("candidate_place_id") or a.get("place_id"):
            bad.append("%s/%s audit mong low_confidence + %s + candidate_place_id, thấy %r" % (cat, vid, CODE, {k: a.get(k) for k in ("status", "reject_reason", "candidate_place_id", "place_id")}))
        if want_review_count is not None and a.get("google_review_count") != want_review_count:
            bad.append("%s/%s: google_review_count mong %r, thấy %r" % (cat, vid, want_review_count, a.get("google_review_count")))
        if any((e.get("vendor") or {}).get("id") == vid for e in root.removed(cat)):
            bad.append("%s/%s bị gỡ (remove) vì ít review: không được" % (cat, vid))
    if not seen:
        bad.append("%s biến mất khỏi mọi vendors.json (chỉ ẩn ảnh Google, không gỡ vendor)" % vid)
    return bad


def kept_state_ok(root, vid, pid):
    bad = []
    for cat in sorted(os.listdir(root.out)):
        if os.path.isdir(root.p(cat)) and root.vendor(vid, cat):
            v = root.vendor(vid, cat)
            if t.pid_of(v) != pid or not v.get("google_photos"):
                bad.append("%s/%s mong giữ place_id %s và ảnh Google, thấy %r / %d ảnh" % (cat, vid, pid, t.pid_of(v), len(v.get("google_photos") or [])))
    return bad


def ids_with_pid(root):
    out = set()
    for cat in os.listdir(root.out):
        if os.path.isdir(root.p(cat)):
            out |= {v["id"] for v in root.vendors(cat) if t.has_pid(v)}
    return out


def mask_of(calls, kind):
    return sorted({c.get("mask", "") for c in calls if c["kind"] == kind})
