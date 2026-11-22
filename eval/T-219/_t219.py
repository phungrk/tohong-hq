"""Helper dùng chung cho eval T-219 (P0 xe hoa: tìm vendor mới qua Maps + AI phân loại + Gemini grounding so AI Mode). Offline: Google Places và Gemini GIẢ
(eval/T-219/_fake), chạy ĐÚNG lệnh CLI `tools/scraper/discover_p0.py` như workflow trong bản sao tools/scraper của repo `tohong` (TOHONG_REPO, hoặc ../tohong; ADR-070:
tìm gốc tohong-hq bằng cách đi lên tới scripts/gate.py). Không eval nào gọi mạng. Mỗi eval in PASS hoặc FAIL <lý do>; thoát 0/1.
Hợp đồng (spec products/T-219-p0-xe-hoa-kham-pha-vendor.md): CLI, tên cờ, tên dòng in, tên file ra, khoá JSON của báo cáo; mọi quy tắc chọn mẫu / chấm điểm ở đây là bản
viết lại ĐỘC LẬP của quy tắc trong spec (không import code của repo sản phẩm)."""
import atexit, copy, csv, datetime, glob, hashlib, json, math, os, re, shutil, subprocess, sys, tempfile, unicodedata
from urllib.parse import urlparse

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
d = HERE
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
HQ = d
FAKE = os.path.join(HERE, "_fake")
PROMPT1A, PROMPT1C, PROMPT2 = [open(os.path.join(HERE, "prompts", n + ".txt"), encoding="utf-8", newline="").read() for n in ("1a", "1c", "2")]
MAPS_KEY = "AIzaSyP0MAPSFAKEKEY0000000000000000000"[:39]
GEM_KEY = "AIzaSyP0GEMINIFAKEKEY00000000000000000"[:39]
SENTINELS = ["10.123456", "106.654321", "REVIEWTEXT-SENTINEL", "+84 909 000 111", "sentinel-site.example"]
AREAS = ["Quận 1", "Quận 2", "Quận 3", "Quận 4", "Quận 5", "Quận 6", "Quận 7", "Quận 8", "Quận 9", "Quận 10", "Quận 11", "Quận 12", "Tân Bình", "Bình Thạnh", "Phú Nhuận", "Gò Vấp",
         "Tân Phú", "Bình Tân", "Thủ Đức", "Bình Chánh", "Hóc Môn", "Củ Chi", "Nhà Bè", "Cần Giờ"]
PHRASINGS = ["thuê xe hoa", "xe cưới", "cho thuê xe cưới", "dịch vụ xe hoa"]
CATS10 = ["photography", "venue", "decor", "attire", "makeup", "ceremony", "jewelry", "transport", "stationery", "honeymoon"]
CAT_NEW, CAT_VENUE = "transport", "venue"      # giá trị {category} của prompt 2 cho nhóm new / venue
NQ = len(PHRASINGS) * len(AREAS)                # 96 truy vấn
SEARCH_STD = (NQ, 4, 4)                          # (trang 1, trang 2, trang 3) của thế giới chuẩn: 4 truy vấn chứa 'Quận 7' có 3 trang => 104 lượt
ADDR = "%d Đường Mẫu, Quận 7, Thành phố Hồ Chí Minh"


def fail(msg):
    print("FAIL " + msg)
    sys.exit(1)


def done(bad, ok_msg):
    if bad:
        print("FAIL %d vi phạm, vd: %s" % (len(bad), " | ".join(str(b) for b in bad[:4])))
        sys.exit(1)
    print("PASS " + ok_msg)
    sys.exit(0)


def tohong():
    for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")):
        if c and os.path.isfile(os.path.join(c, "tools", "scraper", "enrich.py")):
            return os.path.abspath(c)
    fail("không tìm thấy repo tohong (đặt TOHONG_REPO=<đường dẫn>)")


def need_cli():
    """Mọi eval chạy CLI đều gọi hàm này đầu tiên: thiếu CLI = đỏ có lý do rõ (RED trên main), không phải lỗi."""
    if not os.path.isfile(os.path.join(tohong(), "tools", "scraper", "discover_p0.py")):
        fail("thiếu tools/scraper/discover_p0.py (CLI mà spec T-219 yêu cầu)")


def fold(s):
    s = unicodedata.normalize("NFD", (s or "").lower().replace("đ", "d"))
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()


def sha(s):
    return hashlib.sha1(str(s).encode("utf-8")).hexdigest()


# ---------------------------------------------------------------- bản sao scraper + chạy CLI
class Root:
    def __init__(self, files, removed=None):
        base = tempfile.mkdtemp(prefix="t219-")
        atexit.register(shutil.rmtree, base, True)
        self.base = base
        self.path = os.path.join(base, "scraper")
        shutil.copytree(os.path.join(tohong(), "tools", "scraper"), self.path, ignore=shutil.ignore_patterns("output", "run-logs", "__pycache__", "testdata*", "*.pyc", "p0-out"))
        self.out = os.path.join(self.path, "output", "HCMC")
        for cat, vs in files.items():
            os.makedirs(os.path.join(self.out, cat), exist_ok=True)
            json.dump({"vendors": copy.deepcopy(vs)}, open(os.path.join(self.out, cat, "vendors.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        for cat, rs in (removed or {}).items():
            json.dump(rs, open(os.path.join(self.out, cat, "removed_vendors.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        for rel, obj in (("manual_overrides.json", {"schema_version": 1, "overrides": []}), ("enrich-report.json", {"schema_version": 1, "vendors": []})):
            json.dump(obj, open(os.path.join(self.out, rel), "w", encoding="utf-8"))
        os.makedirs(os.path.join(self.path, "run-logs"), exist_ok=True)
        self.n = 0
        self.calls = []

    def data_tree(self):
        """{đường dẫn: băm} của mọi file dưới output/ (nơi dữ liệu vendor, enrich-report, pool nguồn)."""
        out = {}
        for dd, _, fs in os.walk(os.path.join(self.path, "output")):
            for f in fs:
                fp = os.path.join(dd, f)
                out[os.path.relpath(fp, self.path)] = hashlib.sha1(open(fp, "rb").read()).hexdigest()
        return out

    def all_files(self):
        out = {}
        for dd, _, fs in os.walk(self.path):
            if "__pycache__" in dd:
                continue
            for f in fs:
                fp = os.path.join(dd, f)
                out[os.path.relpath(fp, self.path)] = hashlib.sha1(open(fp, "rb").read()).hexdigest()
        return out

    def tee(self, out, run_id):
        """Giả lập bước workflow `... 2>&1 | tee run-logs/T-219/<ngày>-run-<id>-discover.log`: stdout+stderr của CLI LÀ log chạy (CLI không tự ghi file log)."""
        d = os.path.join(self.path, "run-logs", "T-219")
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, "%s-run-%s-discover.log" % (datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d"), run_id))
        open(p, "w", encoding="utf-8").write(out)
        return p

    def run(self, argv, fx, maps=True, gemini=True, run_id="777", env_extra=None, timeout=300, tee=None):
        """Chạy `python discover_p0.py <argv>` trong thư mục scraper. Trả (rc, stdout+stderr, calls mới). tee (mặc định: khi --stage measure và không --dry-run) ghi stdout thành log chạy như workflow."""
        need_cli()
        self.n += 1
        fxp, lg = os.path.join(self.base, "fx%d.json" % self.n), os.path.join(self.base, "calls%d.jsonl" % self.n)
        json.dump(fx, open(fxp, "w", encoding="utf-8"), ensure_ascii=False)
        env = {k: v for k, v in os.environ.items() if k not in ("GOOGLE_MAPS_API_KEY", "GEMINI_API_KEY", "PYTHONPATH", "PYTHONSTARTUP", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT")}
        env.update({"PYTHONPATH": FAKE, "FAKE_P0_FIXTURE": fxp, "FAKE_P0_LOG": lg, "FAKE_P0_KEYS": MAPS_KEY + "," + GEM_KEY, "PYTHONIOENCODING": "utf-8",
                    "PYTHONDONTWRITEBYTECODE": "1", "GITHUB_RUN_ID": run_id, "GITHUB_RUN_ATTEMPT": "1"})
        if maps:
            env["GOOGLE_MAPS_API_KEY"] = MAPS_KEY
        if gemini:
            env["GEMINI_API_KEY"] = GEM_KEY
        env.update(env_extra or {})
        try:
            p = subprocess.run([sys.executable, "discover_p0.py"] + argv, cwd=self.path, env=env, capture_output=True, text=True, timeout=timeout)
            rc, out = p.returncode, (p.stdout or "") + (p.stderr or "")
        except subprocess.TimeoutExpired:
            fail("discover_p0.py chạy quá %ds" % timeout)
        calls = [json.loads(l) for l in open(lg, encoding="utf-8")] if os.path.exists(lg) else []
        self.calls += calls
        self.cli_wrote_logs = self.log_files()
        if tee is None:
            tee = "--dry-run" not in argv and "report" not in argv
        if tee:
            self.tee(out, run_id)
        return rc, out, calls

    def read(self, rel, default=None):
        try:
            return json.load(open(os.path.join(self.path, rel), encoding="utf-8"))
        except (OSError, ValueError):
            return default

    def rows(self, rel):
        try:
            return list(csv.DictReader(open(os.path.join(self.path, rel), encoding="utf-8-sig", newline="")))
        except OSError:
            return None

    def log_files(self):
        return sorted(glob.glob(os.path.join(self.path, "run-logs", "*", "*.log")) + glob.glob(os.path.join(self.path, "run-logs", "*", "*.log.part")))


def n_kind(calls, kind, role=None):
    return sum(1 for c in calls if c["kind"] == kind and (role is None or c["role"] == role))


# ---------------------------------------------------------------- thế giới giả
def v_old(vid, name, addr, cats=("wedding_car",), log=None, website=None):
    c = {"address": addr, "address_source": addr}
    if website:
        c["website"] = website
    return {"id": vid, "name": name, "categories": list(cats), "city": "HCMC", "latitude": 10.77, "longitude": 106.7, "geo_confidence": "city_level",
            "contact": c, "enrichment_log": log or [], "reviews": []}


def n_pid(i):
    return "P%03d" % i


def cls(v, cat=None, reason=""):
    return {"is_wedding_vendor": v, "category": cat, "reason": reason}


def money(n):
    return "{:,}".format(n).replace(",", ".")


def PR(mn, mx, unit, url, quote=None):
    """Khối giá theo lược đồ prompt 2; quote mặc định chứa đúng số tiền (dạng 5.500.000đ)."""
    q = quote if quote is not None else ("Giá %sđ" % money(mn) if mx in (None, mn) else "Giá từ %sđ đến %sđ" % (money(mn), money(mx)))
    return {"min_vnd": mn, "max_vnd": mx, "unit": unit, "source_url": url, "quote": q}


def base(**kw):
    r = {"same_vendor": True, "still_operating": True, "category_correct": True, "description": None, "price": None, "capacity": None, "style_tags": [], "phone": None, "website": None, "notes": ""}
    r.update(kw)
    return r


def grid_reply(transport):
    """Phản hồi của prompt 1a: 10 hạng mục, mỗi hạng mục 4 từ khoá; transport do người gọi đưa."""
    g = {c: ["%s %d" % (c, i) for i in range(1, 5)] for c in CATS10}
    g["transport"] = transport
    return g


def world(nvenue=40, extra=0):
    """(files, removed, fixture, meta). Thế giới: 24 khu vực x 4 cách gọi = 96 truy vấn; chỉ truy vấn chứa 'Quận 7' có kết quả (3 trang) => đúng 96+4+4 = 104 lượt Text Search.
    Place mới P001..P049 (49), trùng: PE1 (place_id vendor xe hoa), PV1 (place_id của một venue: loại trùng mọi category), PR1 (place_id vendor đã gỡ),
    PD2 (tên + địa chỉ giống vendor E2), PR2 (tên + địa chỉ giống vendor đã gỡ); P049 trùng TÊN với E2 nhưng khác địa chỉ => KHÔNG trùng.
    Phân loại (prompt 1c): P001..P036 và P049 = true/transport (37); P037..P042 = false (6); P043..P045 = true/photography (3, studio ảnh do truy vấn xe cưới trả về);
    P046..P048 = "unsure" (3). Details chỉ cho true/transport (37): P001,P002 (9 đánh giá), P003 (3,9 sao), P004 (CLOSED_PERMANENTLY), P005 (địa chỉ Hà Nội) không đạt => 32 đạt ngưỡng."""
    E2A = "45 Lê Văn Sỹ, Phường 14, Quận 3, Thành phố Hồ Chí Minh"
    R2A = "9 Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh"
    places, classify, enrich = {}, {}, []
    allp = []
    for i in range(1, 50):
        pid = n_pid(i)
        types = ["car_rental"]
        if i <= 36 or i == 49:
            c, name = cls(True, "transport", "xe hoa %s" % pid), "Xe hoa Mẫu %02d" % i
        elif i <= 42:
            c, name, types = cls(False, None, "gara %s" % pid), "Garage sửa xe Mẫu %02d" % i, ["car_repair"]
        elif i <= 45:
            c, name, types = cls(True, "photography", "studio ảnh %s" % pid), "Studio Ảnh Mẫu %02d" % i, ["photographer"]
        else:
            c, name, types = cls("unsure", None, "không rõ %s" % pid), "Địa điểm Mẫu %02d" % i, ["point_of_interest"]
        if i == 49:
            name = "Xe Cưới Hoàng Gia"
        pl = {"name": name, "address": (ADDR % i), "status": "OPERATIONAL", "reviews": 20 + i, "rating": 4.5, "types": types}
        if i in (1, 2):
            pl["reviews"] = 9
        if i == 3:
            pl["rating"] = 3.9
        if i == 4:
            pl["status"] = "CLOSED_PERMANENTLY"
        if i == 5:
            pl["address"] = "5 Phố Mẫu, Quận Hoàn Kiếm, Hà Nội"
        places[pid] = pl
        classify[pid] = c
        allp.append(pid)
    places["PE1"] = {"name": "Thuê xe hoa An Phát", "address": "12 Nguyễn Văn Cừ, Phường 4, Quận 5, Thành phố Hồ Chí Minh", "reviews": 50}
    places["PV1"] = {"name": "Nhà hàng Cổ Điển", "address": "1 Đường Venue, Quận 1, Thành phố Hồ Chí Minh", "reviews": 50}
    places["PR1"] = {"name": "Xe cưới Đã Gỡ Một", "address": "3 Đường Gỡ, Quận 7, Thành phố Hồ Chí Minh", "reviews": 50}
    places["PD2"] = {"name": "Xe cưới Hoàng Gia", "address": E2A, "reviews": 50}
    places["PR2"] = {"name": "Dịch vụ xe Minh Tâm", "address": R2A, "reviews": 50}
    for j in range(extra):
        pid = "P%03d" % (100 + j)
        places[pid] = {"name": "Xe hoa Phụ %d" % j, "address": "%d Đường Phụ, Quận 7, Thành phố Hồ Chí Minh" % j, "status": "OPERATIONAL", "reviews": 30, "rating": 4.5, "types": ["car_rental"]}
        classify[pid] = {"omit": True} if j == 0 else cls("maybe", "transport", "phụ") if j == 1 else cls(True, "hoa", "phụ") if j == 2 else cls(True, "transport", "phụ %d" % j)
        allp.append(pid)
    dups = ["PE1", "PV1", "PR1", "PD2", "PR2"]
    for p in dups:
        classify[p] = cls(True, "transport", "không được tới đây")
    order = dups + allp          # 54 place, 20 / 20 / 14 chia 3 trang
    pages = [order[0:20], order[20:40], order[40:60]]
    # venue + vàng AI Mode. Vendor ở vị trí k=2 và k=7 của mẫu sha1: AI Mode KHÔNG có contact.website (website do marry cho, nằm ở contact.website của vendor).
    ids = ["V%02d" % i for i in range(1, nvenue + 1)]
    sample_ids = venue_sample(ids)
    pos = {v: k for k, v in enumerate(sample_ids)}
    venues, gold = [], {}
    for i in range(1, nvenue + 1):
        vid = "V%02d" % i
        k = pos.get(vid)
        ch = {"description": "Nhà hàng tiệc cưới sang trọng sảnh lớn trang trí hoa tươi số %d" % i, "capacity_min": 100, "capacity_max": 300 + i * 10, "capacity_unit": "guests",
              "contact.website": "https://gold%d.example/" % i, "contact.phone": "090000%04d" % i}
        if i % 4 != 0:
            ch["price_range"] = {"min_vnd": 5500000 + i * 100000, "max_vnd": 5500000 + i * 100000, "unit": "per_table", "price_source": "google_ai_mode", "note": "x"}
        marry = k in (2, 7)
        site = ch["contact.website"]
        if marry:
            ch.pop("contact.website")
            site = "https://marry-site-%s.example/" % vid
        log = [{"source": "rescrape_marry", "timestamp": "2026-06-24T00:00:00+00:00", "changes": {"description": "cũ"}},
               {"source": "google_ai_mode", "timestamp": "2026-11-20T12:39:55Z", "changes": ch}]
        if i == 1:
            log.append({"source": "google_maps", "timestamp": "2026-11-09T00:00:00Z", "place_id": "PV1", "address_match": True})
        venues.append(v_old(vid, "Nhà hàng Gold %02d" % i, "%d Đường Tiệc, Quận 1, Thành phố Hồ Chí Minh" % i, ("venue",), log, website=site))
        gold[vid] = ch
    car = [v_old("E1", "Thuê xe hoa An Phát", "12 Nguyễn Văn Cừ, Phường 4, Quận 5, Thành phố Hồ Chí Minh", log=[{"source": "google_maps", "timestamp": "2026-11-09T00:00:00Z", "place_id": "PE1", "address_match": True}]),
           v_old("E2", "Xe cưới Hoàng Gia", E2A)]
    removed = {"wedding_car": [{"removed_at": "2026-11-09T14:34:06Z", "reason": "no_match", "vendor": v_old("R1", "Xe cưới Đã Gỡ Một", "3 Đường Gỡ, Quận 7, Thành phố Hồ Chí Minh", log=[{"source": "google_maps", "place_id": "PR1"}])},
                                  {"removed_at": "2026-11-09T14:34:06Z", "reason": "no_match", "vendor": v_old("R2", "Dịch vụ xe Minh Tâm", R2A)}]}
    gem_new = {}
    for i in list(range(6, 37)) + [49]:
        pid = n_pid(i)
        resp = base(description="Dịch vụ xe hoa cưới số %d" % i, phone="09100%05d" % i)
        if i % 2 == 0:
            q = "Liên hệ để biết giá chi tiết" if i % 10 == 0 else None
            resp["price"] = PR(1500000 + i * 1000, 2500000, "per_trip" if i % 14 == 0 else "package", "https://other.net/gia" if i % 6 == 0 else "https://example.org/gia", q)
        if i == 16:
            resp["same_vendor"] = False
        if i == 20:
            resp["still_operating"] = "unknown"
        if i == 22:
            resp["category_correct"] = False
        gem_new[pid] = resp
        enrich.append({"match": places[pid]["name"], "resp": resp, "queries": ["q1 %d" % i, "q2 %d" % i, "q3 %d" % i], "chunks": [{"uri": "https://vertex.example/r/%d" % i, "title": "example.org"}]})
    gem_ven = {}
    for k, vid in enumerate(sample_ids):
        g = gold[vid]
        gp = g.get("price_range")
        r = base()
        m = k % 5
        if m == 0:
            r.update(price=PR(gp["min_vnd"], gp["max_vnd"], "per_person" if k == 25 else gp["unit"], "https://example.org/a") if gp else PR(6000000, 6000000, "per_table", "https://example.org/a"),
                     description=g["description"], capacity={"min": 100, "max": g["capacity_max"]}, phone="+84" + g["contact.phone"][1:], website="https://www.gold%s.example/menu" % vid[1:].lstrip("0"))
        elif m == 1:
            r.update(price=PR(int(gp["min_vnd"] * 1.08), int(gp["max_vnd"] * (1.3 if k >= 5 else 1.08)), "per_table", "https://example.org/b") if gp else None,
                     description=g["description"] + " thêm ý", capacity={"min": 100, "max": int(g["capacity_max"] * 1.05)}, phone=g["contact.phone"], website="https://khac.example/")
        elif m == 2:
            r.update(price=PR(int(gp["min_vnd"] * (0.7 if k >= 5 else 1.3)), int(gp["max_vnd"] * (1.08 if k >= 5 else 1.3)), "per_table", "https://example.org/c") if gp else None,
                     description="Địa điểm khác hẳn không liên quan tới mô tả vàng", capacity={"min": 100, "max": int(g["capacity_max"] * 1.5)}, website="https://khac.example/")
        elif m == 3:
            r.update(price=PR(7000000, 7000000, "per_table", "https://other.net/d"), phone=g["contact.phone"])
        else:
            r.update(price=PR(4000000, None, "per_table", "https://example.org/e"), description="Sảnh tiệc cưới sang trọng trang trí hoa tươi", capacity={"min": 100, "max": None})
        if k == 13:
            r["same_vendor"] = False
        if k == 8:
            r["still_operating"] = False
        if k == 9:
            r["category_correct"] = False
        gem_ven[vid] = r
        enrich.append({"match": "Nhà hàng Gold %s" % vid[1:], "resp": r, "queries": ["a %s" % vid, "b %s" % vid, "c %s" % vid], "chunks": [{"uri": "https://vertex.example/v/%s" % vid, "title": "example.org"}]})
    fx = {"places": places, "search": [{"match": "quan 7", "pages": pages}],
          "gemini": {"grid": grid_reply(PHRASINGS), "classify": classify, "enrich": enrich, "tokens_in": 10000, "tokens_out": 1000}}
    meta = {"places": places, "classify": classify, "gold": gold, "sample_ids": sample_ids, "gem_new": gem_new, "gem_ven": gem_ven, "dups": dups,
            "new_ids": allp, "qualified": [p for p in allp if classify[p].get("is_wedding_vendor") is True and classify[p].get("category") == "transport" and places[p]["reviews"] >= 10
                                           and places[p]["rating"] >= 4.0 and places[p]["status"] == "OPERATIONAL" and "Hà Nội" not in places[p]["address"]]}
    return {"wedding_car": car, "venue": venues}, removed, fx, meta


# ---------------------------------------------------------------- quy tắc trong spec, viết lại độc lập
def venue_sample(ids, n=30):
    return sorted(ids, key=lambda x: (sha(x), x))[:n]


def pick_new(meta, n=30):
    """Nhóm new (B5): trong số ứng viên đạt ngưỡng, sha1(place_id) tăng dần (hoà theo place_id), lấy n đầu."""
    return sorted(meta["qualified"], key=lambda p: (sha(p), p))[:n]


def samples_ref(ids, n=30):
    """Mẫu cho Capu (B4): đều theo sha1(place_id) trên MỌI ứng viên đã phân loại, tăng dần (hoà theo place_id), lấy n đầu."""
    return sorted(ids, key=lambda p: (sha(p), p))[:n]


def norm_class(c):
    """Chuẩn hoá một dòng phân loại của mô hình theo prompt 1c -> (is_wedding_vendor 'true'|'false'|'unsure', category|None, reason). c=None/omit: không trả."""
    if not c or c.get("omit"):
        return "unsure", None, "model_invalid"
    v, cat, rs = c.get("is_wedding_vendor"), c.get("category"), c.get("reason")
    rs = rs if isinstance(rs, str) else ""
    if v is True and cat in CATS10:
        return "true", cat, rs
    if v is False:
        return "false", None, rs
    if v == "unsure":
        return "unsure", None, rs
    return "unsure", None, "model_invalid"


def prompt2(name, address, website, category):
    return PROMPT2.replace("{name}", name).replace("{address}", address).replace("{website}", website).replace("{category}", category)


def prompt1c_text(items):
    """items: [(id, tên, [types], địa chỉ)] đã sắp theo place_id. Văn bản gửi = prompt 1c nguyên văn + dòng trống + mỗi place một dòng 'id | tên | types | địa chỉ'."""
    return PROMPT1C + "\n\n" + "\n".join(" | ".join([i, n, ", ".join(t), a]) for i, n, t, a in items)


def venue_website(v):
    """{website} của nhóm venue: contact.website của vendor TRỪ khi một dòng google_ai_mode trong enrichment_log có khoá contact.website (khi đó rỗng)."""
    for e in v.get("enrichment_log") or []:
        if e.get("source") == "google_ai_mode" and "contact.website" in (e.get("changes") or {}):
            return ""
    return (v.get("contact") or {}).get("website") or ""


def quote_has(quote, amount):
    """Quote có chứa số tiền (spec Hành vi 7): xét từng token số `\\d[\\d.,]*`: (a) bỏ hết '.' ',' thì bằng amount; (b) theo sau (cho phép khoảng trắng) là triệu|trieu|tr|m
    thì token đọc như số thập phân (',' thành '.'; không hợp lệ thì bỏ qua) x 1.000.000; là nghìn|nghin|ngàn|ngan|k thì x 1.000; làm tròn số nguyên bằng amount."""
    for m in re.finditer(r"(\d[\d.,]*)(?:\s*(triệu|trieu|tr|m|nghìn|nghin|ngàn|ngan|k)(?![^\W\d_]))?", quote or "", re.I):
        tkn, unit = m.group(1).rstrip(".,"), (m.group(2) or "").lower()
        if re.sub(r"[.,]", "", tkn) == str(amount):
            return True
        if unit:
            try:
                x = float(tkn.replace(",", "."))
            except ValueError:
                continue
            mult = 1000000 if unit in ("triệu", "trieu", "tr", "m") else 1000
            if int(round(x * mult)) == amount:
                return True
    return False


UNITS2 = ("package", "per_table")


def gate_price(pr, chunks, same_vendor=True):
    """Cổng nguồn của giá Gemini (spec Hành vi 7). Trả (giá chuẩn hoá | None, lý do rớt | None). Thứ tự kiểm: same_vendor_false, invalid_value, source_not_in_grounding, quote_missing_amount.
    pr None hoặc min_vnd null: không có giá, không phải rớt (lý do None)."""
    if not isinstance(pr, dict) or pr.get("min_vnd") is None:
        return None, None
    if same_vendor is False:
        return None, "same_vendor_false"
    mn, mx, unit, url, quote = pr.get("min_vnd"), pr.get("max_vnd"), pr.get("unit"), pr.get("source_url"), pr.get("quote")
    if not (isinstance(mn, int) and not isinstance(mn, bool) and 50000 <= mn <= 200000000 and unit in UNITS2):
        return None, "invalid_value"
    if mx is not None and not (isinstance(mx, int) and not isinstance(mx, bool) and mn <= mx <= 200000000):
        return None, "invalid_value"
    host = (urlparse(url or "").hostname or "").lower().removeprefix("www.")
    if not any(url == c.get("uri") or (host and host == (c.get("title") or "").lower().removeprefix("www.")) for c in chunks):
        return None, "source_not_in_grounding"
    if not (quote_has(quote, mn) and (mx is None or mx == mn or quote_has(quote, mx))):
        return None, "quote_missing_amount"
    return {"min_vnd": mn, "max_vnd": mx if mx is not None else mn, "unit": unit}, None


def _rel(a, b):
    return abs(a - b) <= 0.10 * max(a, b) + 1e-9


def tok(s):
    return {t for t in fold(s).split() if len(t) >= 3}


def phone_n(p):
    x = re.sub(r"\D", "", p or "")
    return ("0" + x[2:]) if x.startswith("84") else x


def host_n(u):
    return (urlparse(u if "//" in (u or "") else "//" + (u or "")).hostname or "").lower().removeprefix("www.")


def score(gem, ai, chunks):
    """gem: phản hồi Gemini thô (lược đồ prompt 2); ai: vàng AI Mode (khoá phẳng như enrichment_log). same_vendor=false: mọi trường Gemini coi như rỗng. Trả {trường: hạng mục}."""
    out = {}
    if gem.get("same_vendor") is False:
        gem = {"same_vendor": False}
    gp, _ = gate_price(gem.get("price"), chunks)
    ap = ai.get("price_range")
    ap = ap if ap and isinstance(ap.get("min_vnd"), int) and ap.get("unit") else None
    if gp and ap:
        out["price"] = "agree" if gp["unit"] == ap["unit"] and _rel(gp["min_vnd"], ap["min_vnd"]) and _rel(gp["max_vnd"], ap.get("max_vnd") or ap["min_vnd"]) else "disagree"
    else:
        out["price"] = "gemini_only" if gp else ("ai_mode_only" if ap else "both_missing")
    gc = gem.get("capacity") or {}
    gcap = {"min": gc.get("min"), "max": gc.get("max")}
    acap = {"min": ai.get("capacity_min"), "max": ai.get("capacity_max")}
    gh, ah = any(isinstance(v, int) and v > 0 for v in gcap.values()), any(isinstance(v, int) and v > 0 for v in acap.values())
    if gh and ah:
        k = "max" if gcap["max"] and acap["max"] else ("min" if gcap["min"] and acap["min"] else None)
        out["capacity"] = "agree" if k and _rel(gcap[k], acap[k]) else "disagree"
    else:
        out["capacity"] = "gemini_only" if gh else ("ai_mode_only" if ah else "both_missing")
    g2 = {"phone": phone_n(gem.get("phone")) or None, "website": host_n(gem.get("website")) or None}
    a2 = {"phone": phone_n(ai.get("contact.phone")) or None, "website": host_n(ai.get("contact.website")) or None}
    gh, ah = any(g2.values()), any(a2.values())
    if gh and ah:
        both = [f for f in g2 if g2[f] and a2[f]]
        out["contact"] = "disjoint" if not both else ("agree" if all(g2[f] == a2[f] for f in both) else "disagree")
    else:
        out["contact"] = "gemini_only" if gh else ("ai_mode_only" if ah else "both_missing")
    gd, ad = (gem.get("description") or ""), (ai.get("description") or "")
    gh, ah = len(gd) >= 40, len(ad) >= 40
    if gh and ah:
        a, b = tok(gd), tok(ad)
        out["description"] = "agree" if len(a & b) / max(1, len(a | b)) >= 0.25 else "disagree"
    else:
        out["description"] = "gemini_only" if gh else ("ai_mode_only" if ah else "both_missing")
    return out


FIELDS = ("price", "description", "capacity", "contact")
CATS = ("agree", "disagree", "gemini_only", "ai_mode_only", "both_missing", "disjoint")


def read_report(root, out_dir="p0-out/t"):
    return root.read(os.path.join(out_dir, "public", "p0-report.json"))


def std_args(out="p0-out/t", **kw):
    a = ["--state", "HCMC", "--category", "transport", "--stage", "measure", "--out", out, "--usage-root", "run-logs", "--month", "2026-11"]
    for k, v in kw.items():
        a += ["--" + k.replace("_", "-"), str(v)]
    return a


def full_run(extra=None, run_id="777", fx_patch=None, world_kw=None):
    """Chạy thật (Google/Gemini giả) toàn bộ P0 trên thế giới chuẩn. Trả (root, rc, out, calls, meta)."""
    files, removed, fx, meta = world(**(world_kw or {}))
    if fx_patch:
        fx_patch(fx, meta)
    r = Root(files, removed)
    rc, out, calls = r.run(std_args() + (extra or []), fx, run_id=run_id)
    return r, rc, out, calls, meta
