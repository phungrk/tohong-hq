#!/usr/bin/env python3
"""T-222 eval đối kháng 03 (tầng 3, offline, tự chứa): loạt input biên cho dòng P0_HTTP_ERROR (spec T-221 v3 mục 1-2), mỗi ca phải ra ĐÚNG một dòng, không lộ khoá, không lộ giá trị đã gửi,
không sập và không đổi hành vi dừng/tiếp tục:
 ký tự đặc biệt regex trong truy vấn; giá trị đã gửi chồng lấn nhau; message 200 000 ký tự (giá trị ở cuối và sát mốc 300); `error` là list/chuỗi/số/bool; message là bool/list/dict;
 thân JSON có byte không phải UTF-8; JSON lồng 100 000 tầng; khoá nằm trong URL được nhắc lại (`...?key=AIza…`, `&key=`), Bearer + NBSP/CRLF; khoá và truy vấn trong header Content-Type
 của thân không phải JSON; place_id viết hoa trong `places/<id>`; thân None.
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
spec = importlib.util.spec_from_file_location("discover_p0_adv03", os.path.join(repo, "tools", "scraper", "discover_p0.py"))
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
KEY = "AIza" + "SyQ_adv03-0123456789abcdefghijklmno"[:35]
assert len(KEY) == 39


class Raw(Resp):
    def __init__(self, status, raw, ct="application/json"):
        self.status_code = status; self.content = raw; self.headers = {"Content-Type": ct} if ct is not None else {}
        self.text = (raw or b"").decode("utf-8", "replace")


LINE = re.compile(r"^P0_HTTP_ERROR kind=(gemini|text_search|details) status=\d{3} reason=\S* message=.*$")
Q1 = "xe hoa (Hà Nội) [VIP] .* $50+ ^cưới? a|b \\d"
Q2 = "Hoàng Gia Đẹp"
PID = "ChIJxYz-AbC_123456789"
E = lambda msg, st="INVALID_ARGUMENT": json.dumps({"error": {"code": 400, "status": st, "message": msg}}, ensure_ascii=False).encode()
cases = [
    ("regex đặc biệt", "s", Q1, Raw(400, E("bad query %s / %s" % (Q1, Q1.upper()))), [Q1], None),
    ("chồng lấn", "g", ["Hoàng Gia Đẹp Lắm", "Đẹp Lắm Quận 1", "Gia"], Raw(400, E("x Hoàng Gia Đẹp Lắm Quận 1 y")), ["Hoàng Gia Đẹp Lắm", "Đẹp Lắm Quận 1"], None),
    ("message 200k, giá trị cuối", "s", Q2, Raw(400, E("A" * 200000 + " " + Q2)), [Q2], None),
    ("giá trị vắt qua mốc 300", "s", Q2, Raw(400, E("B" * 293 + " " + Q2 + " tail")), [Q2, "Hoàng"], None),
    ("error list", "s", Q2, Raw(400, json.dumps({"error": [Q2]}).encode()), [Q2], "empty"),
    ("error chuỗi", "s", Q2, Raw(400, json.dumps({"error": Q2}).encode()), [Q2], "empty"),
    ("error số", "s", Q2, Raw(400, b'{"error": 7}'), [Q2], "empty"),
    ("error bool", "s", Q2, Raw(400, b'{"error": true}'), [Q2], "empty"),
    ("message bool", "d", PID, Raw(404, json.dumps({"error": {"status": "NOT_FOUND", "message": True, "x": PID}}).encode()), [PID], "msgempty"),
    ("message list", "d", PID, Raw(404, json.dumps({"error": {"status": "NOT_FOUND", "message": [PID]}}).encode()), [PID], "msgempty"),
    ("message dict", "d", PID, Raw(404, json.dumps({"error": {"status": "NOT_FOUND", "message": {"m": PID}}}).encode()), [PID], "msgempty"),
    ("byte không UTF-8", "s", "Nhà hàng Gold", Raw(400, b'{"error":{"status":"X","message":"Nh\xe0 h\xe0ng Gold \xff\xfe ' + PID.encode() + b'"}}'), ["Nhà hàng Gold"], None),
    ("JSON lồng sâu", "s", Q2, Raw(400, b"[" * 100000 + b"]" * 100000), [Q2], "nonjson"),
    ("khoá trong URL nhắc lại", "d", PID, Raw(404, E("GET https://places.googleapis.com/v1/places/%s?fields=id&key=%s failed; retry ?KEY=%s" % (PID.upper(), KEY, KEY[:20]), "NOT_FOUND")), [PID], None),
    ("Bearer NBSP/CRLF", "s", Q2, Raw(401, E("auth Bearer\u00a0tok.abc-123 and BEARER\r\n  ya29.zzz_9 x-goog-api-key: " + KEY, "UNAUTHENTICATED")), [Q2], None),
    ("khoá + truy vấn trong Content-Type", "s", Q2, Raw(502, b"<html>bad gateway</html>", ct="text/html; key=%s; q=%s; Bearer\tTOK.1" % (KEY, Q2)), [Q2, "bad gateway"], "nonjson"),
    ("thân None", "d", PID, Raw(500, None, ct=None), [PID], "nonjson"),
]
for tag, kind, sent, resp, vals, want in cases:
    if kind == "s":
        call = lambda c, q=sent: c.search(q)
    elif kind == "d":
        call = lambda c, p=sent: c.details(p)
    else:
        call = lambda c, s=sent: c.gemini("prompt " + " | ".join(s), True, sent=s)
    try:
        es = run(call, resp)
    except Exception as e:  # noqa: BLE001
        bad.append("%s: sập %r" % (tag, e)); continue
    if len(es) != 1 or not LINE.match(es[0]):
        bad.append("%s: cần đúng 1 dòng hợp lệ, có %r" % (tag, [l[:120] for l in es])); continue
    l = es[0]
    if KEY in l or KEY[:12] in l or "tok.abc" in l or "ya29" in l or "TOK.1" in l or "maps-key-not" in l or "gem-key-not" in l:
        bad.append("%s: lộ khoá: %r" % (tag, l[:200]))
    body = norm(l.split(" reason=", 1)[-1])
    for v in vals:
        if norm(v) in body:
            bad.append("%s: lộ %r: %r" % (tag, v[:20], l[:200]))
    msg = l.split(" message=", 1)[1]
    if want == "empty" and not l.endswith(" reason= message="):
        bad.append("%s: error không phải đối tượng phải ra reason= message= rỗng: %r" % (tag, l[:160]))
    if want == "msgempty" and msg != "":
        bad.append("%s: message không phải chuỗi phải rỗng: %r" % (tag, l[:160]))
    if want == "nonjson" and not re.match(r"^non_json_body bytes=\d+ content_type=", msg):
        bad.append("%s: thân không phải JSON phải ra non_json_body: %r" % (tag, l[:160]))
    if want is None and len(msg) > 300:
        bad.append("%s: message dài hơn 300: %d" % (tag, len(msg)))
if bad:
    print("FAIL " + " | ".join(bad)); sys.exit(1)
print("PASS %d ca biên (regex, chồng lấn, 200k ký tự, mốc 300, error/message kiểu lạ, byte hỏng, lồng sâu, khoá trong URL/Bearer NBSP-CRLF/Content-Type, thân None): một dòng, không lộ" % len(cases))
