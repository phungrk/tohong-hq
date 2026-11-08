"""Helper dùng chung cho eval T-106 (enrich Google Maps cho vendor venue). KHÔNG eval nào gọi Google: chỉ đọc file/log.
Biến môi trường:
  TOHONG_REPO       repo `tohong` (có tools/scraper/enrich.py). Mặc định: ../tohong cạnh tohong-hq.
  TOHONG_BACK_REPO  repo `tohong-back` (có lib/vendorPool.generated.js). Mặc định: ../tohong-back.
  T106_LOG_DIR      thư mục log chạy thật. Mặc định: $TOHONG_REPO/tools/scraper/run-logs/T-106
  T106_MONTH        tháng tính hạn mức, dạng YYYY-MM. Mặc định 2026-11 (tháng của việc này).
  T106_PHOTOS_BASELINE  số request SKU Photos đã dùng trong tháng TRƯỚC T-106. Mặc định 606 (Capu, console 2026-11-08, brief T-106).
  T106_BASE_REF     mốc git của tohong-back để so pool (check_6). Mặc định: merge-base(HEAD, origin/main); nhớ `git fetch origin main` trước.
Mỗi eval in PASS hoặc FAIL <lý do>; mã thoát 0/1. Chạy bằng python3 -I (đã tự thêm thư mục này vào sys.path)."""
import glob, json, os, re, sys

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
VENUE_DIR = os.path.join("tools", "scraper", "output", "HCMC", "venue")
LH3 = re.compile(r"^https://lh\d+\.googleusercontent\.com/")


def fail(msg):
    print("FAIL " + msg)
    sys.exit(1)


def ok(msg):
    print("PASS " + msg)
    sys.exit(0)


def _repo(env, marker, sibling):
    for c in (os.environ.get(env), os.path.join(HQ, "..", sibling)):
        if c and os.path.isfile(os.path.join(c, marker)):
            return os.path.abspath(c)
    fail("không tìm thấy repo %s (đặt %s=<đường dẫn>; đã thử ../%s)" % (sibling, env, sibling))


def tohong():
    return _repo("TOHONG_REPO", os.path.join("tools", "scraper", "enrich.py"), "tohong")


def back():
    return _repo("TOHONG_BACK_REPO", os.path.join("lib", "vendorPool.generated.js"), "tohong-back")


def parse_pool(text):
    return json.loads(text[text.index("= [") + 2 : text.rindex("]") + 1])


def load_pool(back_root):
    return parse_pool(open(os.path.join(back_root, "lib", "vendorPool.generated.js"), encoding="utf-8").read())


def venue_pool(pool):
    return [p for p in pool if p.get("category") == "venue"]


def load_records(root):
    """id -> [record,...] từ mọi tools/scraper/output/HCMC/*/vendors.json (một business có thể nằm ở nhiều category)."""
    out = {}
    for f in sorted(glob.glob(os.path.join(root, "tools", "scraper", "output", "HCMC", "*", "vendors.json"))):
        d = json.load(open(f, encoding="utf-8"))
        for v in (d.get("vendors", []) if isinstance(d, dict) else d):
            out.setdefault(v.get("id"), []).append(v)
    return out


def removed_ids(root):
    ids = set()
    for f in glob.glob(os.path.join(root, "tools", "scraper", "output", "HCMC", "*", "removed_vendors.json")):
        for r in json.load(open(f, encoding="utf-8")):
            ids.add((r.get("vendor") or {}).get("id"))
    return ids


def google_log(rec):
    """Entry enrichment_log[source=google_maps] mới nhất có place_id (cùng định nghĩa place_id_of của google_photos.py)."""
    for e in reversed(rec.get("enrichment_log") or []):
        if e.get("source") == "google_maps" and e.get("place_id"):
            return e
    return None


def record_google_log(recs):
    for r in recs or []:
        e = google_log(r)
        if e:
            return e
    return None


def google_photos_of(pool_vendor):
    return [p for p in pool_vendor.get("photos", []) if p.get("source") == "google"]
