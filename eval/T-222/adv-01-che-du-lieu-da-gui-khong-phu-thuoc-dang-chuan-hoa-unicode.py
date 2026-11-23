#!/usr/bin/env python3
"""T-222 eval đối kháng 01 (tầng 3, offline, tự chứa): dòng P0_HTTP_ERROR không được chứa truy vấn/tên/địa chỉ đã gửi khi Google nhắc lại chúng ở DẠNG CHUẨN HOÁ UNICODE KHÁC
(NFC <-> NFD, "Unicode dựng sẵn" <-> "Unicode tổ hợp"). Hai dạng hiển thị y hệt nhau, ai cũng đọc lại được, nên thuộc câu BẮT BUỘC của spec T-221 v3 mục 1:
"không bao giờ chứa place_id, tên, địa chỉ, website hay truy vấn ... ở BẤT KỲ dạng mã hoá nào đọc lại được".
Bằng chứng thực tế: tools/scraper/output/HCMC/venue/vendors.json có 4 chuỗi tên/địa chỉ không ở dạng NFC, đều của venue có google_ai_mode (đầu vào của prompt enrich).
Ca: (a) Text Search gửi truy vấn NFD, Google trả message NFC; (b) gửi NFC, Google trả NFD; (c) Gemini (enrich) gửi tên/địa chỉ NFD, message nhắc lại NFC.
Hàm phát hiện chuẩn hoá NFC + casefold + gộp trắng trước khi tìm. Không mạng: requests.post/get bị thay bằng phản hồi giả.
Repo: $TOHONG_REPO hoặc ../tohong cạnh tohong-hq. Chạy: python3 -I <file>."""
import contextlib, importlib.util, io, json, os, re, sys, unicodedata as U

d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(d, "..", "tohong")) if c and os.path.isfile(os.path.join(c, "tools", "scraper", "discover_p0.py"))), None)
if not repo:
    print("FAIL không thấy tools/scraper/discover_p0.py (đặt TOHONG_REPO)"); sys.exit(1)
sys.dont_write_bytecode = True
os.environ.pop("GEMINI_API_KEY", None); os.environ.pop("GOOGLE_MAPS_API_KEY", None)
sys.path.insert(0, os.path.join(repo, "tools", "scraper"))
spec = importlib.util.spec_from_file_location("discover_p0_adv01", os.path.join(repo, "tools", "scraper", "discover_p0.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Resp:
    def __init__(self, status, body):
        self.status_code = status
        self.content = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.headers = {"Content-Type": "application/json; charset=UTF-8"}
        self.text = self.content.decode("utf-8")

    def json(self):
        return json.loads(self.content)


class Led:
    def __init__(self):
        self.n = {"gemini": 0}; self.stops = []

    def gate(self, kind): return None
    def charge(self, kind): self.n[kind] = self.n.get(kind, 0) + 1
    def stop(self, r): self.stops.append(r); m.out("P0_STOP " + r)
    def gemini_response(self, *a): pass


def run(call, resp):
    m.requests.post = lambda *a, **k: resp
    m.requests.get = lambda *a, **k: resp
    cl = m.Client(Led(), "maps-key-not-used-1234", "gem-key-not-used-5678", "gemini-x")
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        call(cl)
    return [l for l in buf.getvalue().splitlines() if l.startswith("P0_HTTP_ERROR")]


def norm(s):
    return re.sub(r"\s+", " ", U.normalize("NFC", s)).casefold().strip()


bad = []
NAME = "Trung tâm Hội nghị Tiệc cưới Hoàng Gia Đẹp"
ADDR = "Số 12 Đường Nguyễn Thị Minh Khai, Phường Đa Kao, Quận 1"
Q = "thuê xe hoa cưới trọn gói Hà Nội"
err = lambda msg: Resp(400, {"error": {"code": 400, "status": "INVALID_ARGUMENT", "message": msg}})

cases = [
    ("search: gửi NFD, Google trả NFC", lambda c: c.search(U.normalize("NFD", Q)), err("Bad textQuery \"%s\"." % U.normalize("NFC", Q)), [Q]),
    ("search: gửi NFC, Google trả NFD", lambda c: c.search(U.normalize("NFC", Q)), err("Bad textQuery \"%s\"." % U.normalize("NFD", Q)), [Q]),
    ("gemini enrich: gửi NFD, Google trả NFC",
     lambda c: c.gemini("tên: %s · địa chỉ: %s" % (U.normalize("NFD", NAME), U.normalize("NFD", ADDR)), True, sent=[U.normalize("NFD", NAME), U.normalize("NFD", ADDR), ""]),
     err("Cannot ground %s at %s." % (U.normalize("NFC", NAME), U.normalize("NFC", ADDR))), [NAME, ADDR]),
]
for tag, call, resp, vals in cases:
    try:
        es = run(call, resp)
    except Exception as e:  # noqa: BLE001
        bad.append("%s: lỗi khi chạy %r" % (tag, e)); continue
    if len(es) != 1:
        bad.append("%s: cần đúng 1 dòng P0_HTTP_ERROR, có %d" % (tag, len(es))); continue
    body = norm(es[0].split(" message=", 1)[-1])
    for v in vals:
        if norm(v) in body:
            bad.append("%s: giá trị đã gửi %r còn đọc được trong dòng: %r" % (tag, v[:24] + "…", es[0][:160]))
if bad:
    print("FAIL " + " | ".join(bad)); sys.exit(1)
print("PASS truy vấn/tên/địa chỉ đã gửi bị che cả khi Google nhắc lại ở dạng chuẩn hoá Unicode khác (NFC/NFD)")
