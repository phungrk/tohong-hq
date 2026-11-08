#!/usr/bin/env python3
"""T-113 adv-06 (tầng 3, thăm dò trần $30): đếm request đúng ở các chỗ dễ lọt.
(a) ảnh lấy từ kết quả Text Search (fetch_from_names) KHÔNG phát sinh Place Details ngầm: 0 dòng kind=details;
(b) retry 429/5xx của request ảnh: MỖI lần gửi một dòng GOOGLE_REQUEST, ghi TRƯỚC khi gửi (session giả đếm số lần gửi, so với số dòng tại thời điểm gửi);
(c) chạm trần giữa các lần retry: không gửi request vượt trần (BudgetExceeded trước khi gửi);
(d) usage.count_log trên một log trộn: run A (enrich, có GOOGLE_REQUEST, bị giết trước GOOGLE_USAGE), run B (refresh, chỉ GOOGLE_USAGE run=…), dòng kiểu T-106 không run=
    -> A đếm theo REQUEST, B theo USAGE cuối, T-106 cộng mọi dòng; không đếm đôi A khi A có cả USAGE.
Không gọi mạng."""
import os, sys, tempfile
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _gh as g

sys.path.insert(0, os.path.join(g.repo(), "tools", "scraper"))
from enrichment import usage as usg  # noqa: E402
from enrichment.google_photos import GooglePhotoFetcher  # noqa: E402

lines = []


class Resp:
    def __init__(self, code, body=None):
        self.status_code, self._b, self.text = code, body or {}, ""

    def json(self):
        return self._b


class Sess:
    def __init__(self, codes):
        self.codes, self.sent, self.lines_at_send, self.urls = list(codes), 0, [], []

    def get(self, url, headers=None, params=None, timeout=None):
        self.sent += 1
        self.lines_at_send.append(len(lines))
        self.urls.append(url)
        c = self.codes.pop(0) if self.codes else 200
        return Resp(c, {"photoUri": "https://lh3.googleusercontent.com/p/x=s800"} if c == 200 else {})


bad = []
# (a)+(b): 2 ảnh, ảnh đầu 429, 503 rồi 200; ảnh hai 200
led = usg.Ledger("rTEST", usg.Usage(), cap_usd=None, echo=lines.append)
s = Sess([429, 503, 200, 200])
f = GooglePhotoFetcher(api_key="k", max_photos=2, max_requests=None, session=s, sleep=lambda x: None, ledger=led)
r = f.fetch_from_names([{"name": "places/P/photos/a"}, {"name": "places/P/photos/b"}, {"name": "places/P/photos/c"}])
kinds = [l.split("kind=")[-1] for l in lines]
if "details" in kinds or any("photos/" not in u and ":" in u.split("/")[-1] for u in s.urls):
    bad.append("(a) ảnh từ Text Search phát sinh Place Details: %r" % kinds)
if len(lines) != s.sent:
    bad.append("(b) %d lần gửi nhưng %d dòng GOOGLE_REQUEST" % (s.sent, len(lines)))
if any(n < i + 1 for i, n in enumerate(s.lines_at_send)):
    bad.append("(b) có lần gửi trước khi dòng GOOGLE_REQUEST tương ứng được ghi: %r" % s.lines_at_send)
if r.get("status") != "ok" or len(r.get("photos") or []) != 2:
    bad.append("(a) mong 2 ảnh, thấy %r" % r)

# (c) trần: đã dùng sát trần net; mỗi ảnh $0,007. cap cho đúng 2 request ảnh nữa; ảnh đầu 429,429 rồi 200 -> request thứ 3 bị chặn TRƯỚC khi gửi
lines.clear()
u = usg.Usage()
u.ph = 950  # hết miễn phí hiệu dụng
led = usg.Ledger("rCAP", u, cap_usd=0.014 + 1e-12, echo=lines.append)
s = Sess([429, 429, 200, 200])
f = GooglePhotoFetcher(api_key="k", max_photos=2, max_requests=None, session=s, sleep=lambda x: None, ledger=led)
try:
    f.fetch_from_names([{"name": "places/P/photos/a"}, {"name": "places/P/photos/b"}])
except usg.BudgetExceeded:
    pass
if s.sent > 2 or led.est() > 0.014 + 1e-9:
    bad.append("(c) gửi %d request, ước tính %.4f > trần 0.014" % (s.sent, led.est()))

# (d) log trộn
with tempfile.TemporaryDirectory() as d:
    p = Path(d) / "20261109-000000-run-1-enrich.log"
    p.write_text("\n".join(
        ["GOOGLE_REQUEST run=rA kind=search"] * 7 + ["GOOGLE_REQUEST run=rA kind=media"] * 3 +
        ["GOOGLE_USAGE run=rB text_search=0 photo_details=2 photo_media=4",
         "GOOGLE_USAGE text_search=5 photo_details=0 photo_media=1",
         "GOOGLE_USAGE text_search=1 photo_details=0 photo_media=0"]) + "\n")
    c = usg.count_log(p)
    if c != {"ts": 13, "ph": 10, "geo": 0}:
        bad.append("(d) log trộn mong ts=13 ph=10, thấy %r" % c)
    p.write_text(p.read_text() + "GOOGLE_USAGE run=rA text_search=7 photo_details=0 photo_media=3\n")
    c2 = usg.count_log(p)
    if c2 != {"ts": 13, "ph": 10, "geo": 0}:
        bad.append("(d) thêm USAGE của rA làm đếm đôi: %r" % c2)
if bad:
    g.fail(" | ".join(bad))
g.ok("PASS ảnh từ Text Search 0 Place Details; retry mỗi lần gửi một dòng ghi trước; trần chặn trước khi gửi; log trộn đếm đúng, không đếm đôi")
