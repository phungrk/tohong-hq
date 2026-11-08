"""Thư viện dùng chung cho eval T-105 (enrich venue bằng Google Places Text Search).

Nguyên tắc an toàn: KHÔNG BAO GIỜ gọi Google. Mọi lần chạy công cụ đều trỏ `--base-url` về một máy chủ giả trên 127.0.0.1
do chính eval dựng. Khoá dùng là chuỗi giả TESTKEY_*, không phải khoá thật. Eval chỉ biết công cụ qua giao diện dòng lệnh trong
spec (products/T-105-enrich-venue-google-places.md, mục "Giao diện công cụ"), không biết cách cài đặt bên trong.

Repo chứa công cụ: biến môi trường TOHONG_REPO, mặc định /home/user/tohong (phải ở nhánh main mới nhất).
"""
import copy, http.server, json, os, shutil, subprocess, sys, tempfile, threading, urllib.parse
from pathlib import Path

HQ = Path(__file__).resolve().parents[2]
REPO = Path(os.environ.get("TOHONG_REPO") or "/home/user/tohong")
TOOL = REPO / "tools" / "scraper" / "enrich_venue_places.py"
GENERATOR = REPO / "tools" / "generate-vendor-pool.js"
SPEC = HQ / "products" / "T-105-enrich-venue-google-places.md"
KEY = "TESTKEY_NOT_A_REAL_KEY_0123456789"
ALLOWED_MASK = {"places.id", "places.displayName", "places.formattedAddress", "places.location",
                "places.businessStatus", "places.photos"}          # không rating/phone/website/reviews: tránh nhảy bậc giá
SEARCH_USD, MEDIA_USD = 0.035, 0.007
LH3 = "https://lh3.googleusercontent.com/grass-cs/"


def fail(msg):
    print("FAIL " + msg); sys.exit(1)


def need_tool():
    if not TOOL.is_file():
        fail(f"chưa có công cụ {TOOL} (giao diện: spec T-105, mục Giao diện công cụ)")


# ---------- fixture ----------
def vendor(vid, name, address, place_id=None):
    v = {"id": vid, "name": name, "city": "HCMC", "contact": {"address": address}, "reviews": [], "portfolio_urls": ["https://www.marry.vn/x.jpg"],
         "enrichment_log": [{"source": "rescrape_marry", "timestamp": "2026-06-24T00:00:00+00:00", "changes": {}}]}
    if place_id:
        v["enrichment_log"].append({"source": "google_maps", "timestamp": "2026-11-07T00:00:00+00:00", "place_id": place_id})
    return v


def place(pid, name, addr, status="OPERATIONAL", photos=None):
    p = {"id": pid, "name": f"places/{pid}", "displayName": {"text": name, "languageCode": "vi"}, "formattedAddress": addr, "businessStatus": status}
    if photos is not None:
        p["photos"] = photos
    return p


def photo(pid, ph, authors=("Tác Giả A",)):
    return {"name": f"places/{pid}/photos/{ph}", "widthPx": 4000, "heightPx": 3000,
            "authorAttributions": [{"displayName": a, "uri": "https://maps.google.com/maps/contrib/1"} for a in authors]}


def main_fixture():
    """9 venue. Kỳ vọng ghi trong EXPECT. Điểm tên đã tính cách ngưỡng 0,80 ít nhất 0,08 (không nằm sát biên)."""
    V = [
        vendor("v1", "Nhà hàng Hoa Sen", "12 Nguyễn Huệ, Quận 1, Thành phố Hồ Chí Minh"),
        vendor("v2", "Gala Center", "Đường Nguyễn Hữu Thọ, Quận 7, Thành phố Hồ Chí Minh"),
        vendor("v3", "Riverside Palace", "360D Bến Vân Đồn, Quận 4, Thành phố Hồ Chí Minh"),
        vendor("v4", "Cung Điện Hoa", "88 Lý Thường Kiệt, Quận 10, Thành phố Hồ Chí Minh"),
        vendor("v5", "Phương Đông Palace", "5 Trần Hưng Đạo, Quận 5, Thành phố Hồ Chí Minh"),
        vendor("v6", "Phuong Dong Palace", "5 Tran Hung Dao, Quận 5, Thành phố Hồ Chí Minh"),
        vendor("v7", "Nhà hàng Đồng Khởi", "30 Đồng Khởi, Quận 1, Thành phố Hồ Chí Minh"),
        vendor("v8", "Sen Vàng", "1 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh", place_id="ChIJ_CO_SAN"),
        vendor("v9", "Dịch vụ lá đỏ", "Tam đông. Hóc  mon, Thành phố Hồ Chí Minh"),
        vendor("v10", "PARKROYAL Saigon", "309B – 311 Nguyễn Văn Trỗi, P.1, Quận Tân Bình, Thành phố Hồ Chí Minh(028) 3842 1111Điện thoạiSĐThttps://www.panpacific.com/vi/Website"),
    ]
    HCM = ", Thành phố Hồ Chí Minh"
    rules = [
        # v1: ba ứng viên: cùng tên khác quận (loại), đúng tên đúng quận (nhận), tên gần giống đúng quận nhưng điểm tên thấp (loại)
        {"name": "Nhà hàng Hoa Sen", "district": "Quận 1", "places": [
            place("PL_V1_Q3", "Nhà hàng Hoa Sen", "200 Võ Văn Tần, Quận 3" + HCM, photos=[photo("PL_V1_Q3", "x", ("Sai",))]),
            place("PL_V1_OK", "Nhà hàng Hoa Sen", "12 Nguyễn Huệ, Quận 1" + HCM,
                  photos=[photo("PL_V1_OK", "p1", ("Nguyễn Văn A", "Trần B")), photo("PL_V1_OK", "p2", ("Lê C",)), photo("PL_V1_OK", "p3", ("D",))]),
            place("PL_V1_SPA", "Hoa Sen Spa", "40 Pasteur, Quận 1" + HCM)]},
        # v2: hai chi nhánh cùng tên cùng quận, địa chỉ venue không có số nhà → mơ hồ
        {"name": "Gala Center", "district": "Quận 7", "places": [
            place("PL_V2_A", "Gala Center", "5 Nguyễn Lương Bằng, Quận 7" + HCM, photos=[photo("PL_V2_A", "a")]),
            place("PL_V2_B", "Gala Center", "99 Phạm Văn Nghị, Quận 7" + HCM, photos=[photo("PL_V2_B", "b")])]},
        # v3: hai chi nhánh cùng tên cùng quận, địa chỉ venue có số nhà+đường → chọn đúng bằng địa chỉ. Ảnh: q1 thiếu ghi công, q3 trả URI sai host
        {"name": "Riverside Palace", "district": "Quận 4", "places": [
            place("PL_V3_OTHER", "Riverside Palace", "20 Tôn Đản, Quận 4" + HCM, photos=[photo("PL_V3_OTHER", "z")]),
            place("PL_V3_OK", "Riverside Palace", "360D Bến Vân Đồn, Quận 4" + HCM,
                  photos=[{"name": "places/PL_V3_OK/photos/q1", "authorAttributions": []}, photo("PL_V3_OK", "q2", ("Phạm E",)), photo("PL_V3_OK", "q3", ("G",))])]},
        # v4: Google chỉ trả chỗ khác tên (điểm tên thấp)
        {"name": "Cung Điện Hoa", "district": "Quận 10", "places": [
            place("PL_V4_X", "Trung tâm Hội nghị Anh Đào", "10 Sư Vạn Hạnh, Quận 10" + HCM, photos=[photo("PL_V4_X", "x")])]},
        # v5 và v6: hai bản ghi venue cùng phân giải về MỘT place_id → cả hai bị loại
        {"name": "Phương Đông Palace", "district": "Quận 5", "places": [place("PL_DUP", "Phương Đông Palace", "5 Trần Hưng Đạo, Quận 5" + HCM, photos=[photo("PL_DUP", "d")])]},
        {"name": "Phuong Dong Palace", "district": "Quận 5", "places": [place("PL_DUP", "Phương Đông Palace", "5 Trần Hưng Đạo, Quận 5" + HCM, photos=[photo("PL_DUP", "d")])]},
        # v7: đã đóng cửa
        {"name": "Nhà hàng Đồng Khởi", "district": "Quận 1", "places": [place("PL_V7_CLOSED", "Nhà hàng Đồng Khởi", "30 Đồng Khởi, Quận 1" + HCM, status="CLOSED_PERMANENTLY", photos=[photo("PL_V7_CLOSED", "c")])]},
        # v10: địa chỉ bẩn (dính số điện thoại, website); khớp, Google không có ảnh
        {"name": "PARKROYAL Saigon", "district": "Tân Bình", "places": [place("PL_V10_OK", "PARKROYAL Saigon", "309B-311 Nguyễn Văn Trỗi, Phường 1, Tân Bình" + HCM)]},
    ]
    media = {
        "places/PL_V1_OK/photos/p1": LH3 + "AAA_p1=s4800-w800", "places/PL_V1_OK/photos/p2": LH3 + "AAA_p2=s4800-w800",
        "places/PL_V1_OK/photos/p3": LH3 + "AAA_p3=s4800-w800",
        "places/PL_V3_OK/photos/q2": LH3 + "BBB_q2=s4800-w800",
        "places/PL_V3_OK/photos/q3": "https://places.googleapis.com/v1/places/PL_V3_OK/photos/q3/media?maxWidthPx=800&key=LEAK",
    }
    return V, rules, media


# expected theo id: (status, reason hoặc None, place_id hoặc None)
EXPECT = {
    "v1": ("matched", None, "PL_V1_OK"), "v2": ("ambiguous", "multiple_candidates", None), "v3": ("matched", None, "PL_V3_OK"),
    "v4": ("no_match", None, None), "v5": ("ambiguous", "duplicate_place_id", None), "v6": ("ambiguous", "duplicate_place_id", None),
    "v7": ("closed", None, None), "v8": ("skipped", "has_place_id", None), "v9": ("skipped", "no_locality", None),
    "v10": ("matched", None, "PL_V10_OK"),
}
MAIN_SEARCH, MAIN_MEDIA = 8, 4                      # v1 2 ảnh, v3 2 lượt (q1 không ghi công nên không gọi media)
MAIN_MEDIA_MAX = MAIN_SEARCH * 2


# ---------- máy chủ giả ----------
class Fake:
    def __init__(self, rules, media, key=KEY, status_for=None):
        self.rules, self.media, self.key, self.status_for = rules, media, key, status_for or {}
        self.search, self.media_calls, self.violations, self.hits = [], [], [], 0
        self._attempts = {}
        outer = self

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def _send(self, code, obj):
                b = json.dumps(obj, ensure_ascii=False).encode()
                self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
            def _auth(self):
                if urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("key"):
                    outer.violations.append("khoá API nằm trong URL (phải ở header X-Goog-Api-Key)")
                if self.headers.get("X-Goog-Api-Key") != outer.key:
                    self._send(403, {"error": {"code": 403, "status": "PERMISSION_DENIED"}}); return False
                return True
            def do_POST(self):
                outer.hits += 1
                if not self._auth(): outer.search.append({"q": None, "denied": True}); return
                n = int(self.headers.get("Content-Length") or 0); body = json.loads(self.rfile.read(n) or b"{}")
                q = body.get("textQuery", ""); mask = set((self.headers.get("X-Goog-FieldMask") or "").split(","))
                if not urllib.parse.urlparse(self.path).path.endswith("/v1/places:searchText"): self._send(404, {}); return
                if not mask or not mask <= ALLOWED_MASK:
                    outer.violations.append(f"field mask ngoài danh sách rẻ: {sorted(mask - ALLOWED_MASK) or 'rỗng'}")
                outer.search.append({"q": q})
                for r in outer.rules:
                    if r["name"] in q:
                        if r["district"] not in q: outer.violations.append(f"query '{q}' thiếu quận '{r['district']}'")
                        k = r["name"]; outer._attempts[k] = outer._attempts.get(k, 0) + 1
                        code = outer.status_for.get(k)
                        if code: self._send(code, {"error": {"code": code}}); return
                        self._send(200, {"places": r["places"]}); return
                self._send(200, {})
            def do_GET(self):
                outer.hits += 1
                if not self._auth(): outer.media_calls.append({"denied": True}); return
                u = urllib.parse.urlparse(self.path); qs = urllib.parse.parse_qs(u.query)
                if not u.path.endswith("/media"): self._send(404, {}); return
                name = u.path[len("/v1/"):-len("/media")]
                if qs.get("skipHttpRedirect") != ["true"] or not qs.get("maxWidthPx"):
                    outer.violations.append("media thiếu skipHttpRedirect=true hoặc maxWidthPx")
                outer.media_calls.append({"name": name})
                if name in outer.media: self._send(200, {"name": name + "/media", "photoUri": outer.media[name]})
                else: self._send(404, {"error": {"code": 404}})

        self.srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.srv.server_address[1]}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def close(self): self.srv.shutdown(); self.srv.server_close()
    @property
    def requests(self): return len(self.search) + len(self.media_calls)


GUARD = r'''
import runpy, socket, sys
def _no(*a, **k):
    open(sys.argv[1], "a").write("NET\n"); raise OSError("eval: cấm mạng")
for n in ("connect", "connect_ex"): setattr(socket.socket, n, _no)
socket.create_connection = _no; socket.getaddrinfo = _no
tool = sys.argv[2]; sys.argv = [tool] + sys.argv[3:]
runpy.run_path(tool, run_name="__main__")
'''


class Box:
    """Thư mục tạm: vendors.json đầu vào, đầu ra, báo cáo."""
    def __init__(self, vendors):
        self.d = Path(tempfile.mkdtemp(prefix="t105-"))
        self.inp, self.out, self.report = self.d / "venue" / "vendors.json", self.d / "out.json", self.d / "report.jsonl"
        self.inp.parent.mkdir(); self.vendors = vendors
        self.inp.write_text(json.dumps({"vendors": vendors}, ensure_ascii=False, indent=2), encoding="utf-8")
        (self.d / "guard.py").write_text(GUARD)

    def run(self, args, base_url=None, key=KEY, guard=False, timeout=90, extra_env=None):
        env = {"PATH": os.environ.get("PATH", ""), "HOME": str(self.d), "NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost",
               "TOHONG_BACKOFF_SCALE": "0", "PYTHONIOENCODING": "utf-8"}
        if key: env["GOOGLE_MAPS_API_KEY"] = key
        env.update(extra_env or {})
        a = ["--input", str(self.inp), "--out", str(self.out), "--report", str(self.report)] + list(args)
        if base_url: a += ["--base-url", base_url]
        cmd = [sys.executable, str(self.d / "guard.py"), str(self.d / "net.log"), str(TOOL)] + a if guard else [sys.executable, str(TOOL)] + a
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env, cwd=str(self.d))
        r.net = (self.d / "net.log").exists()
        return r

    def out_vendors(self):
        if not self.out.exists(): return None
        d = json.loads(self.out.read_text(encoding="utf-8")); return d["vendors"] if isinstance(d, dict) else d

    def rep(self):
        if not self.report.exists(): return None
        return {j["id"]: j for j in (json.loads(l) for l in self.report.read_text(encoding="utf-8").splitlines() if l.strip())}

    def done(self): shutil.rmtree(self.d, ignore_errors=True)


def kv(stdout, tag):
    """Dòng cuối bắt đầu bằng `tag ` → dict. VD 'RESULT matched=3 stopped=null'."""
    line = [l for l in stdout.splitlines() if l.startswith(tag + " ")]
    if not line: return None
    return dict(p.split("=", 1) for p in line[-1].split()[1:] if "=" in p)


def place_id_of(v):
    for e in reversed(v.get("enrichment_log") or []):
        if e.get("source") == "google_maps" and e.get("place_id"): return e["place_id"]
    return None


def standard_run(args=("--approved-max-usd", "1.00")):
    need_tool()
    V, rules, media = main_fixture()
    fk = Fake(rules, media); box = Box(V)
    try:
        r = box.run(list(args), base_url=fk.url)
        return V, fk, box, r, kv(r.stdout, "RESULT")
    except Exception:
        box.done(); fk.close(); raise
