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


# ---------------------------------------------------------------------------------------------------------------------
# address_match: ĐỊNH NGHĨA CHUẨN của T-106 (Hành vi 3 trong products/T-106-enrich-venue.md). Engineering cài đặt lại trong
# tohong/tools/scraper/enrichment/ phải cho đúng kết quả của hàm này trên eval/T-106/address_pairs.json; check_5 tính lại bằng hàm này.
# Không dùng quận/huyện: Google (sau sáp nhập) trả địa chỉ hai cấp "<số + đường>, <phường mới>, Hồ Chí Minh", không có quận.
# ---------------------------------------------------------------------------------------------------------------------
import unicodedata

_NUM = r"[a-z]?\d+(?:[a-z]\d*)?(?:/[a-z0-9]+)*"
_NUM_FIRST = re.compile(r"^(?:so\s+)?(" + _NUM + r"(?:\s*-\s*" + _NUM + r")*)(?:\s+(.+))?$")
_NUM_ONLY = re.compile(r"^(?:so\s+)?(" + _NUM + r"(?:\s*-\s*" + _NUM + r")*)$")
_STREET_PREFIX = re.compile(r"^(?:duong|d\.|dai lo|pho)\s+")
_ADMIN_CUT = re.compile(r"\s(?:quan|huyen|phuong|thanh pho|tphcm|tp|q|p)(?=[\s.\d]|$).*$")
MIN_STREET_LEN = 4


def _fold(s):
    s = unicodedata.normalize("NFD", (s or "").replace("đ", "d").replace("Đ", "D"))
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn").lower()
    s = re.sub(r"[–—‑]", "-", s)
    s = re.sub(r"\([^)]*\)", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _main(token):
    """'309b' -> '309b'; '588/c2' -> '588'; '03' -> '3' (phần trước dấu '/' đầu tiên, bỏ số 0 đầu)."""
    t = token.split("/")[0].strip()
    m = re.match(r"^([a-z]?)(\d+)(.*)$", t)
    return (m.group(1) + str(int(m.group(2))) + m.group(3)) if m else t


def _street_key(s):
    s = _ADMIN_CUT.sub("", " " + s.strip()).strip()
    s = _STREET_PREFIX.sub("", s)
    return re.sub(r"[^a-z0-9]", "", s)


def parse_address(addr):
    """(tập số nhà chính, khoá tên đường) hoặc None. Luật (A1..A6):
    A1 chuẩn hoá: bỏ dấu (đ->d), chữ thường, '–'/'—' -> '-', bỏ nội dung trong ngoặc đơn, gộp khoảng trắng; tách theo dấu phẩy.
    A2 duyệt các đoạn từ trái sang, lấy đoạn ĐẦU TIÊN có dạng 'số nhà + tên đường' (cho phép tiền tố 'Số '), nghĩa là bắt đầu bằng số nhà
       (chữ+số, vd 309b, 588/c2, c17, 215e4; khoảng '45 - 47', '01-02-02a' = nhiều số) rồi tới chữ. Đoạn bắt đầu bằng 'Lầu/Tầng/Tòa nhà/tên toà nhà' không có dạng này nên bị bỏ qua.
    A3 nếu đoạn chỉ có số nhà (vd '137/27A') thì tên đường là đoạn kế tiếp, miễn đoạn đó không bắt đầu bằng chữ số.
    A4 số nhà chính của một token = phần trước '/' đầu tiên, bỏ số 0 đầu ('03'->'3', '588/c2'->'588'); khoảng cho ra tập các số nhà chính.
    A5 tên đường: bỏ MỘT tiền tố trong {duong, d., dai lo, pho}; cắt từ từ khoá hành chính {quan, huyen, phuong, thanh pho, tphcm, tp, q, p} trở đi; rồi bỏ mọi ký tự không phải chữ/số (nên 'quoc lo 1 k' = 'quoc lo 1k'; 'Đ. số 14' = 'Đường số 14').
    A6 không tìm được đoạn nào theo A2/A3 hoặc tên đường < 4 ký tự -> None."""
    segs = [x.strip() for x in _fold(addr).split(",") if x.strip()]
    for i, seg in enumerate(segs):
        m = _NUM_FIRST.match(seg)
        if m and m.group(2):
            street = m.group(2)
        elif _NUM_ONLY.match(seg) and i + 1 < len(segs) and not re.match(r"^\d", segs[i + 1]):
            m, street = _NUM_ONLY.match(seg), segs[i + 1]
        else:
            continue
        key = _street_key(street)
        if len(key) < MIN_STREET_LEN:
            continue
        nums = {_main(t) for t in re.split(r"\s*-\s*", m.group(1))}
        return nums, key
    return None


def address_match(vendor_addr, google_addr):
    """True khi cả hai địa chỉ parse được (parse_address), hai khoá tên đường BẰNG nhau, và hai tập số nhà chính GIAO nhau. Còn lại False."""
    a, b = parse_address(vendor_addr), parse_address(google_addr)
    return bool(a and b and a[1] == b[1] and (a[0] & b[0]))


def accept_match(confidence, addr_match):
    """Luật nhận khớp (Hành vi 2): confidence >= 0,6, hoặc confidence >= 0,4 VÀ address_match."""
    return (confidence or 0) >= 0.6 or ((confidence or 0) >= 0.4 and addr_match is True)
