#!/usr/bin/env python3
"""T-222 eval đối kháng 04 (tầng 3, offline, tự chứa): cách sửa v2 (NFC + mảnh quanh dấu che khoá) không để lộ và không che thừa tới mức hỏng dòng chẩn đoán (spec T-221 v3 mục 1-2, tiêu chí 1).
 (a) Google nhắc lại tên ở dạng NFD VIẾT HOA khi đã gửi NFC thường (và ngược lại): bị che;
 (b) giá trị đã gửi có mảnh quanh dấu che ngắn hơn 2 ký tự (`A key=1 B`, `x Bearer y`): mảnh 1 ký tự KHÔNG thành mẫu che, chữ lành `Billing Account` vẫn nguyên;
 (c) lô thật kiểu P0 (tên/địa chỉ tiếng Việt, website có `?key=`, tên có `Bearer`) + Gemini 402 kiểu Google: `reason=FAILED_PRECONDITION` và cụm `billing`/`402`/`project` vẫn đọc được, phần nhận diện website không lộ;
 (d) mảnh rơi đúng vào ranh giới cắt 300: không còn đoạn nào >= 4 ký tự của giá trị đã gửi.
Ghi nhận (không kiểm): dạng tương thích NFKC (chữ toàn độ rộng, ligature) không được che; pool thật không có chuỗi nào khác nhau giữa NFC và NFKC (đã đo 2026-11-23).
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
spec = importlib.util.spec_from_file_location("discover_p0_adv04", os.path.join(repo, "tools", "scraper", "discover_p0.py"))
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
G = lambda msg, st="INVALID_ARGUMENT", code=400: Resp(code, {"error": {"code": code, "status": st, "message": msg}})


def line(sent, resp):
    es = run(lambda c: c.gemini("prompt", True, sent=sent), resp)
    if len(es) != 1:
        bad.append("cần đúng 1 dòng, có %d" % len(es)); return ""
    return es[0]


N = "Nhà hàng Tiệc cưới Hoàng Gia"
for tag, sent, echo in (("NFC thường -> NFD hoa", [N], U.normalize("NFD", N.upper())), ("NFD -> NFC hoa", [U.normalize("NFD", N)], N.upper())):
    l = line(sent, G("bad entity %s here" % echo))
    if norm(N) in norm(l):
        bad.append("(a) %s: lộ tên: %r" % (tag, l[:160]))
l = line(["A key=1 B", "x Bearer y", "Q key=abc"], G("Billing Account is closed for project 123.", "FAILED_PRECONDITION", 402))
if "message=Billing Account is closed for project 123." not in l or "reason=FAILED_PRECONDITION" not in l:
    bad.append("(b) mảnh < 2 ký tự không được thành mẫu che: %r" % l[:200])
SITE = "https://xehoa-anphat.vn/lien-he?key=vip2026"
sent = ["ChIJabcDEF123", "Thuê xe hoa An Phát", "12 Nguyễn Huệ, Quận 1", "ChIJzzz999", "Xe Cưới Bearer Gold", "45 Lê Lợi, Quận 3", SITE]
msg = ("Your project has been denied access because billing is not enabled (HTTP 402). Enable billing for project 1234567 in Cloud Console. "
       "Context: Thuê xe hoa An Phát, %s" % SITE)
l = line(sent, G(msg, "FAILED_PRECONDITION", 402))
if "kind=gemini status=402 reason=FAILED_PRECONDITION" not in l:
    bad.append("(c) reason 402 không còn đọc được: %r" % l[:200])
for w in ("denied access because billing is not enabled", "402", "project 1234567", "Cloud Console"):
    if w not in l:
        bad.append("(c) che thừa làm mất %r: %r" % (w, l[:240]))
for w in ("xehoa-anphat.vn", "lien-he", "thuê xe hoa an phát"):
    if w in norm(l):
        bad.append("(c) lộ %r: %r" % (w, l[:240]))
V = "Trung tâm Tiệc cưới key=zz Hoàng Gia Đẹp Lộng Lẫy"
for pad in range(270, 300, 3):
    l = line([V], G("Z" * pad + " " + V + " tail"))
    mm = l.split(" message=", 1)[-1].replace("Z", "")
    nm = norm(mm)
    for part in ("Trung tâm Tiệc cưới", "Hoàng Gia Đẹp Lộng Lẫy"):
        p = norm(part)
        for i in range(len(p) - 3):
            if p[i:i + 4].strip() == p[i:i + 4] and p[i:i + 4] in nm:
                bad.append("(d) pad=%d lộ mảnh %r: %r" % (pad, p[i:i + 4], mm[-60:])); break
if bad:
    print("FAIL " + " | ".join(bad[:8])); sys.exit(1)
print("PASS NFC/NFD + hoa thường bị che; mảnh < 2 ký tự không che thừa; dòng 402 vẫn đọc được với lô có mẫu khoá; không mảnh nào lộ sát mốc 300")
