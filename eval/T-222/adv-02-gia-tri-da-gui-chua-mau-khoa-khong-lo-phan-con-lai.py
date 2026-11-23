#!/usr/bin/env python3
"""T-222 eval đối kháng 02 (tầng 3, offline, tự chứa): website đã gửi có chứa `key=` trong chuỗi truy vấn (vd `https://<miền>/dat-xe?key=...`) và Google nhắc lại nó trong error.message.
Bước che khoá (2b) chạy trước 2e nên chỉ phần `key=...` bị thay, phần còn lại của website (miền, đường dẫn) ra log đọc được, trái câu BẮT BUỘC của spec T-221 v3 mục 1
("không bao giờ chứa ... website ... của vendor/place đã gửi") và câu cuối mục 2 ("không giá trị nào ở (e) còn trong dòng", hiểu theo nghĩa phần nhận diện của website).
Cùng kiểu cho tên vendor có chữ `Bearer <từ>` hoặc địa chỉ có `key=`: phần còn lại của giá trị không được lộ.
Hàm phát hiện: miền + đường dẫn của website và phần chữ còn lại của tên/địa chỉ không được còn trong dòng (NFC + casefold + gộp trắng).
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
spec = importlib.util.spec_from_file_location("discover_p0_adv02", os.path.join(repo, "tools", "scraper", "discover_p0.py"))
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
SITE = "https://xehoa-hoanggia-saigon.vn/dat-xe?key=uudai2026"
NAME = "Xe Hoa Bearer Gold Hoàng Gia"
ADDR = "88 Lê Lợi, Quận 1 key=lo-B"
err = lambda msg: Resp(400, {"error": {"code": 400, "status": "INVALID_ARGUMENT", "message": msg}})
call = lambda c: c.gemini("tên: %s · địa chỉ: %s · website: %s" % (NAME, ADDR, SITE), True, sent=[NAME, ADDR, SITE])
for tag, msg, frags in (("website có key=", "Cannot fetch %s for grounding." % SITE, ["xehoa-hoanggia-saigon.vn", "dat-xe"]),
                        ("tên có Bearer", "Unknown entity %s." % NAME, ["xe hoa", "hoàng gia"]),
                        ("địa chỉ có key=", "Address %s not found." % ADDR, ["88 lê lợi, quận 1"])):
    try:
        es = run(call, err(msg))
    except Exception as e:  # noqa: BLE001
        bad.append("%s: lỗi khi chạy %r" % (tag, e)); continue
    if len(es) != 1:
        bad.append("%s: cần đúng 1 dòng P0_HTTP_ERROR, có %d" % (tag, len(es))); continue
    body = norm(es[0].split(" message=", 1)[-1])
    for f in frags:
        if norm(f) in body:
            bad.append("%s: phần %r của giá trị đã gửi còn trong dòng: %r" % (tag, f, es[0][:160]))
if bad:
    print("FAIL " + " | ".join(bad)); sys.exit(1)
print("PASS website/tên/địa chỉ đã gửi có chứa mẫu khoá (key=, Bearer) không để lộ phần còn lại khi Google nhắc lại")
