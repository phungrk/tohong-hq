"""Helper dùng chung cho eval T-110 (duyệt tay venue của Capu). KHÔNG eval nào gọi Google thật: mọi lệnh CLI chạy trong thư mục scraper tạm
(bản sao tools/scraper của repo `tohong`, không có output/ thật), với Google GIẢ nạp qua PYTHONPATH (eval/T-110/_fake/sitecustomize.py).
Eval chạy ĐÚNG lệnh CLI như workflow (enrich.py, resolve_overrides.py, refresh_photos.py), nên không phụ thuộc cài đặt bên trong.
Biến môi trường: TOHONG_REPO (repo tohong), TOHONG_BACK_REPO (tohong-back, chỉ check_7). Mỗi eval in PASS hoặc FAIL <lý do>; thoát 0/1."""
import atexit, copy, csv, hashlib, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-106"))
import _common as c  # noqa: E402  (tohong(), back(), address_match, reject_reason, in_province …)

FAKE = os.path.join(HERE, "_fake")
DECISION = "decisions/2026-11-08-adr-048-capu-duyet-tay-4-venue.md"
OVERRIDES = "manual_overrides.json"
ENRICH = ["enrich.py", "--state", "HCMC", "--category", "venue", "--budget", "5.0"]
RESOLVE = ["resolve_overrides.py", "--state", "HCMC"]
REFRESH = ["refresh_photos.py", "--input", "output/HCMC/venue/vendors.json", "--max-photos", "2", "--min-age-days", "25", "--max-requests", "6"]
ALLOWED = {"accept_place", "remove", "temporarily_closed", "reject_match"}


def fail(msg):
    print("FAIL " + msg)
    sys.exit(1)


def done(bad, ok_msg):
    if bad:
        print("FAIL %d vi phạm, vd: %s" % (len(bad), " | ".join(bad[:4])))
        sys.exit(1)
    print("PASS " + ok_msg)
    sys.exit(0)


class Root:
    """Bản sao tools/scraper có output/HCMC/<category>/ tạm. `.path` là thư mục scraper (cwd của lệnh CLI)."""

    def __init__(self, files, parent=None):
        src = os.path.join(c.tohong(), "tools", "scraper")
        base = tempfile.mkdtemp(prefix="t110-")
        atexit.register(shutil.rmtree, base, True)
        self.base = base
        self.path = os.path.join(base, "tools", "scraper") if parent == "repo" else os.path.join(base, "scraper")
        shutil.copytree(src, self.path, ignore=shutil.ignore_patterns("output", "run-logs", "__pycache__", "testdata*", "*.pyc"))
        self.out = os.path.join(self.path, "output", "HCMC")
        for cat, vs in files.items():
            os.makedirs(os.path.join(self.out, cat), exist_ok=True)
            self.write(os.path.join(cat, "vendors.json"), {"vendors": copy.deepcopy(vs)})
        self.calls = []
        self._n = 0

    def p(self, rel):
        return os.path.join(self.out, rel)

    def write(self, rel, obj):
        os.makedirs(os.path.dirname(self.p(rel)), exist_ok=True)
        with open(self.p(rel), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)

    def read(self, rel, default=None):
        try:
            return json.load(open(self.p(rel), encoding="utf-8"))
        except (OSError, ValueError):
            return default

    def vendors(self, cat="venue"):
        d = self.read(os.path.join(cat, "vendors.json"), {})
        return d.get("vendors", []) if isinstance(d, dict) else d

    def vendor(self, vid, cat="venue"):
        return next((v for v in self.vendors(cat) if v.get("id") == vid), None)

    def audit(self, cat="venue"):
        return {r.get("vendor_id"): r for r in self.read(os.path.join(cat, "enrichment-audit.json"), [])}

    def removed(self, cat="venue"):
        return self.read(os.path.join(cat, "removed_vendors.json"), [])

    def review(self, cat="venue"):
        p = self.p(os.path.join(cat, "review-needed.csv"))
        return {(r.get("id") or "").strip(): r for r in csv.DictReader(open(p, encoding="utf-8-sig", newline=""))} if os.path.exists(p) else {}

    def set_overrides(self, entries, **top):
        doc = {"schema_version": 1, "overrides": entries}
        doc.update(top)
        self.write(OVERRIDES, doc)

    def overrides(self):
        return self.read(OVERRIDES, {})

    def tree(self):
        """{đường dẫn tương đối: băm byte} của mọi file trong output/ (để so 'không đổi')."""
        out = {}
        for d, _, fs in os.walk(os.path.join(self.path, "output")):
            for f in fs:
                fp = os.path.join(d, f)
                out[os.path.relpath(fp, self.out)] = hashlib.sha1(open(fp, "rb").read()).hexdigest()
        return out

    def run(self, argv, fixture, key=True, timeout=180):
        """Chạy `python <argv>` trong thư mục scraper. Trả (rc, stdout+stderr, calls mới của lần này)."""
        self._n += 1
        fx = os.path.join(self.base, "fx%d.json" % self._n)
        lg = os.path.join(self.base, "calls%d.jsonl" % self._n)
        json.dump(fixture, open(fx, "w", encoding="utf-8"), ensure_ascii=False)
        env = {k: v for k, v in os.environ.items() if k not in ("GOOGLE_MAPS_API_KEY", "PYTHONPATH", "PYTHONSTARTUP")}
        env.update({"PYTHONPATH": FAKE, "FAKE_GOOGLE_FIXTURE": fx, "FAKE_GOOGLE_LOG": lg, "PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1"})
        if key:
            env["GOOGLE_MAPS_API_KEY"] = "fake-not-a-key"
        if not os.path.isfile(os.path.join(self.path, argv[0])):
            fail("thiếu tools/scraper/%s (CLI mà spec T-110 yêu cầu)" % argv[0])
        try:
            p = subprocess.run([sys.executable] + argv, cwd=self.path, env=env, capture_output=True, text=True, timeout=timeout)
            rc, out = p.returncode, (p.stdout or "") + (p.stderr or "")
        except subprocess.TimeoutExpired:
            fail("%s chạy quá %ds" % (" ".join(argv[:1]), timeout))
        calls = [json.loads(l) for l in open(lg, encoding="utf-8")] if os.path.exists(lg) else []
        self.calls += calls
        return rc, out, calls


def n_kind(calls, *kinds):
    return sum(1 for x in calls if x["kind"] in kinds)


def usage(out):
    """Dòng GOOGLE_USAGE cuối cùng của stdout -> dict, hoặc None."""
    import re
    ls = [l for l in out.splitlines() if l.startswith("GOOGLE_USAGE")]
    if not ls:
        return None
    return {k: int(v) for k, v in re.findall(r"(\w+)=(\d+)", ls[-1])}


def vendor(i, name, addr, cats=("venue",)):
    return {"id": i, "name": name, "categories": list(cats), "city": "HCMC", "latitude": 10.77, "longitude": 106.7, "geo_confidence": "city_level",
            "contact": {"address": addr, "address_source": addr}, "enrichment_log": [], "reviews": []}


def place(name, addr, status="OPERATIONAL", lat=10.78, lng=106.70, nphotos=3, pid=None):
    return {"name": name, "address": addr, "status": status, "lat": lat, "lng": lng,
            "photos": [{"name": "places/%s/photos/p%d" % (pid or "X", k), "widthPx": 800, "heightPx": 600,
                        "authorAttributions": [{"displayName": "Tác giả %d" % k, "uri": "https://maps.google.com/contrib/%d" % k}]} for k in range(nphotos)]}


def fixture(places, search=(), links=None, deny=False):
    pl = {}
    for pid, p in places.items():
        q = copy.deepcopy(p)
        for ph in q.get("photos") or []:
            ph["name"] = ph["name"].replace("places/X/", "places/%s/" % pid)
        pl[pid] = q
    return {"places": pl, "search": [{"match": m, "ids": ids} for m, ids in search], "links": links or {}, "deny": deny}


def entry(vid, action, **kw):
    e = {"vendor_id": vid, "action": action, "reason": "Capu duyệt tay (fixture eval)", "approved_by": "capu", "approved_on": "2026-11-08", "decision": DECISION}
    if action == "accept_place":
        e.update({"maps_link": None, "place_id": None})
    e.update(kw)
    return e


def resolved(pid, p, frm="place_id"):
    return {"place_id": pid, "name": p["name"], "formatted_address": p["address"], "business_status": p.get("status", "OPERATIONAL"),
            "resolved_at": "2026-11-08T15:00:00Z", "resolved_from": frm}


def accept_with_snapshot(vid, pid, p):
    return entry(vid, "accept_place", place_id=pid, resolved=resolved(pid, p))


def glog(rec):
    for e in reversed(rec.get("enrichment_log") or []):
        if e.get("source") == "google_maps" and e.get("place_id"):
            return e
    return None


def has_pid(rec):
    return bool(rec and glog(rec))


def pid_of(rec):
    g = glog(rec) if rec else None
    return g["place_id"] if g else None


def inv_scripts(*nums):
    import glob
    out = []
    for n in nums:
        out += sorted(glob.glob(os.path.join(HQ, "eval", "invariants", "planner", "vendor", "images", "inv-%03d-*.py" % n)))
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Kịch bản "sáu cổng" dùng chung cho check_2, 3, 8, 9. Mỗi vendor bị MỘT cổng từ chối khi không có duyệt tay (bằng chứng: lần chạy đối chứng).
# ---------------------------------------------------------------------------------------------------------------------
CLOSED_Y = vendor("t110_closedY", "Nhà hàng Đã Đóng Y", "7 Nguyễn Huệ, Quận 1, Thành phố Hồ Chí Minh")
SCEN = {
    # id: (tên vendor, địa chỉ gốc, (place_id, tên Google, địa chỉ Google), mã cổng mong đợi khi KHÔNG duyệt tay)
    "t110_A": ("Nhà hàng Alpha", "10 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh", ("PA", "Hội trường Zeta", "55 Lê Lợi, Bến Thành, Hồ Chí Minh"), "low_score"),
    "t110_B": ("Nhà hàng Beta", "10 Hai Bà Trưng, Quận 1, Thành phố Hồ Chí Minh", ("PB", "Nhà hàng Beta Garden", "88 Pasteur, Bến Nghé, Hồ Chí Minh"), "address_conflict"),
    "t110_C": ("Nhà hàng Gamma", "Khu đô thị Sala, Thủ Đức, Thành phố Hồ Chí Minh", ("PC", "Nhà hàng Gamma Garden", "Tầng 2, Phường Bến Nghé, Hồ Chí Minh"), "address_unconfirmed"),
    "t110_D": ("Nhà hàng Delta", "7 Nguyễn Huệ, Quận 1, Thành phố Hồ Chí Minh", ("PD", "Nhà hàng Deltaa", "Tòa nhà Delta, Phường Bến Nghé, Hồ Chí Minh"), "same_address_as_closed"),
    "t110_E": ("Hội trường Sao Mai", "100 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh", ("PE", "Epsilon Palace", "100 Lê Lợi, Bến Thành, Hồ Chí Minh"), "low_score"),
}
# F nhận khớp tự động khi đứng một mình (qua G1-G5), nhưng chung place_id PE với E (địa chỉ gốc khác): khi E được duyệt tay thì F bị G6 hạ.
F = ("t110_F", "Epsilon Palace", "Khu đô thị Sala, Thủ Đức, Thành phố Hồ Chí Minh", ("PE", "Epsilon Palace", "100 Lê Lợi, Bến Thành, Hồ Chí Minh"))
# Z: địa chỉ gốc trùng X (X bị Capu loại). Khi X là nhà hàng đóng cửa Google (CLOSED_PERMANENTLY) thì Z bị G4; khi X chỉ bị Capu loại thì Z phải được nhận.
X = vendor("t110_X", "Nhà hàng Tự Do Test", "275A Phạm Ngũ Lão, Quận 1, Thành phố Hồ Chí Minh")
Z = ("t110_Z", "Nhà hàng Zulu", "275A Phạm Ngũ Lão, Quận 1, Thành phố Hồ Chí Minh", ("PZ", "Nhà hàng Zulu", "Tòa nhà Zulu, Phường Bến Thành, Hồ Chí Minh"))
# R: nhận khớp tự động đúng (đối chứng) rồi Capu reject_match; R2 đã có place_id + ảnh từ trước rồi bị reject_match.
R = ("t110_R", "Nhà hàng Romeo", "20 Pasteur, Quận 1, Thành phố Hồ Chí Minh", ("PR", "Nhà hàng Romeo", "20 Pasteur, Bến Nghé, Hồ Chí Minh"))
R2 = ("t110_R2", "Nhà hàng Sierra", "30 Pasteur, Quận 1, Thành phố Hồ Chí Minh", ("PR2", "Nhà hàng Sierra", "30 Pasteur, Bến Nghé, Hồ Chí Minh"))


def scen_places():
    pl = {}
    for vid, (n, a, (pid, pn, pa), _) in SCEN.items():
        pl[pid] = place(pn, pa)
    for (vid, n, a, (pid, pn, pa)) in (F, Z, R, R2):
        pl[pid] = place(pn, pa)
    pl.update(scen_places_extra())
    return pl


def scen_search_rules():
    """Luật Text Search giả theo TÊN vendor (truy vấn chứa tên). Tên F 'Epsilon Palace' không trùng tên E 'Hội trường Sao Mai'."""
    rules = [(v[0], [v[2][0]]) for v in SCEN.values()]
    rules += [(F[1], [F[3][0]]), (Z[1], [Z[3][0]]), (Z2[1], [Z2[3][0]]), (R[1], [R[3][0]]), (R2[1], [R2[3][0]])]
    return rules


def prematched(vid, name, addr, g):
    """Vendor đã nhận khớp tự động từ trước (place_id + ảnh Google), như dữ liệu #72."""
    v = vendor(vid, name, addr)
    v["contact"]["address"] = g[2]
    v["google_photos"] = [{"uri": "https://lh3.googleusercontent.com/old-" + vid, "attributions": [{"name": "t"}], "fetched_at": "2026-11-08T04:00:00Z"}]
    v["enrichment_log"] = [{"source": "google_maps", "timestamp": "2026-11-08T04:03:36", "matched_name": g[1], "confidence": 1.0, "place_id": g[0],
                            "formatted_address": g[2], "address_match": c.address_match(addr, g[2]), "changes": {"address": g[2]}}]
    return v


# Z2: địa chỉ gốc trùng W, W là bản ghi bị gỡ vì lý do KHÔNG phải Google báo CLOSED_PERMANENTLY (kiểu T-111 no_match): không vào tập G4.
W = vendor("t110_W", "Nhà hàng Whiskey", "88 Nguyễn Trãi, Quận 5, Thành phố Hồ Chí Minh")
Z2 = ("t110_Z2", "Nhà hàng Zebra", "88 Nguyễn Trãi, Quận 5, Thành phố Hồ Chí Minh", ("PZ2", "Nhà hàng Zebra", "Tòa nhà Zebra, Phường 1, Hồ Chí Minh"))


def scen_places_extra():
    return {Z2[3][0]: place(Z2[3][1], Z2[3][2])}


def scen_vendors(with_x_in_vendors, reverse=False):
    vs = [vendor(i, n, a) for i, (n, a, _, _) in SCEN.items()]
    vs.append(vendor(F[0], F[1], F[2]))
    vs.append(vendor(Z[0], Z[1], Z[2]))
    vs.append(vendor(Z2[0], Z2[1], Z2[2]))
    vs.append(prematched(R[0], R[1], R[2], R[3]))
    vs.append(prematched(R2[0], R2[1], R2[2], R2[3]))
    if with_x_in_vendors:
        vs.append(copy.deepcopy(X))
    return list(reversed(vs)) if reverse else vs


def scen_audit_rows():
    return [{"vendor_id": vid, "status": "enriched", "matched_name": gg[1], "confidence": 1.0, "place_id": gg[0],
             "formatted_address": gg[2], "address_match": c.address_match(addr, gg[2])} for vid, addr, gg in ((R[0], R[2], R[3]), (R2[0], R2[2], R2[3]))]


def scen_removed(x_in_removed):
    rows = [closed_record(CLOSED_Y), {"removed_at": "2026-11-08T04:04:01Z", "reason": "T-111: no_match sau hai lần thử", "vendor": copy.deepcopy(W)}]
    if x_in_removed:
        rows.append(closed_record(X))
    return rows


def closed_record(v):
    return {"removed_at": "2026-11-08T04:04:01Z", "reason": "google business CLOSED_PERMANENTLY", "vendor": copy.deepcopy(v)}


def pool_ids(root):
    """Chạy build_pool.py (pool cho matcher) trong thư mục scraper tạm; trả tập id vendor trong pool. Offline."""
    rc, out, _ = root.run(["build_pool.py", "--out", "output/pool-vendors.json"], fixture({}, [], deny=True), key=False)
    try:
        d = json.load(open(os.path.join(root.path, "output", "pool-vendors.json"), encoding="utf-8"))
    except (OSError, ValueError):
        fail("build_pool.py không ghi được output/pool-vendors.json (rc=%r): %s" % (rc, out[-120:]))
    return {v.get("id") for v in d.get("vendors", [])}


def name_sim(a, b):
    """Số đo tên của pipeline (GoogleMapsEnricher._name_similarity): SequenceMatcher trên tên bỏ dấu, chữ thường, chỉ a-z0-9 và khoảng trắng; làm tròn 3."""
    import re, unicodedata
    from difflib import SequenceMatcher

    def n(s):
        s = unicodedata.normalize("NFD", s.lower())
        s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
        return re.sub(r"[^a-z0-9 ]", "", s).strip()
    return round(SequenceMatcher(None, n(a), n(b)).ratio(), 3)


def premise_sim_below(a, b, limit):
    v = name_sim(a, b)
    if v >= limit:
        fail("fixture hỏng: độ giống tên %r/%r = %s >= %s" % (a, b, v, limit))
