#!/usr/bin/env python3
"""T-104 · adv-03 (tầng 3, adversary). GooglePhotoFetcher (tohong/tools/scraper/enrichment/google_photos.py) không được nhận photoUri trỏ về
endpoint API của Google (FR-001: "không bao giờ đặt URL endpoint ... vào pool").
Input phá: Photo media trả `photoUri` là `https://maps.googleapis.com/maps/api/place/photo?...&key=<khoá giả>` hoặc
`https://PLACES.googleapis.com/...` (hoa). Code hiện chỉ so `"places.googleapis.com" in uri` (phân biệt hoa thường, không biết endpoint cũ).
Mong đợi: fetcher bỏ ảnh đó (không có trong `photos`), như với places.googleapis.com; chấp nhận ảnh lh3.googleusercontent.com bình thường.
Cách đo: nạp google_photos.py trực tiếp (importlib, không nạp package enrichment), session giả, không gọi mạng. Khoá giả, không in khoá.
Repo tohong: TOHONG_REPO, rồi cwd, rồi ../tohong. Không tìm thấy file hoặc thiếu thư viện requests: PASS "chưa áp dụng". Mã thoát 0 = đạt."""
import importlib.util, json, os, sys

REL = os.path.join("tools", "scraper", "enrichment", "google_photos.py")
cands = [os.environ.get("TOHONG_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, REL))), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy google_photos.py)"); sys.exit(0)
try:
    import requests  # noqa: F401
except ImportError:
    print("PASS chưa áp dụng (thiếu requests)"); sys.exit(0)
spec = importlib.util.spec_from_file_location("adv03_google_photos", os.path.join(repo, REL))
gp = importlib.util.module_from_spec(spec); spec.loader.exec_module(gp)

FAKE = "AIza" + "X" * 35
class Resp:
    def __init__(self, status, body): self.status_code, self._b, self.text = status, body, json.dumps(body)
    def json(self): return self._b
class Sess:
    def __init__(self, uri): self.uri = uri
    def get(self, url, headers=None, params=None, timeout=None):
        if url.endswith("/media"): return Resp(200, {"name": "p/1", "photoUri": self.uri})
        return Resp(200, {"photos": [{"name": "places/X/photos/1", "authorAttributions": [{"displayName": "Tác giả", "uri": ""}]}]})

bad = [
    "https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=AbC&key=" + FAKE,
    "https://PLACES.googleapis.com/v1/places/X/photos/1/media?key=" + FAKE,
]
fails = []
for u in bad:
    f = gp.GooglePhotoFetcher(api_key="k", max_photos=1, session=Sess(u), sleep=lambda s: None)
    res = f.fetch("ChIJX")
    got = [p.get("uri", "") for p in res.get("photos") or []]
    if any("googleapis.com" in g.lower() for g in got):
        fails.append(u.split("?")[0])
ok = gp.GooglePhotoFetcher(api_key="k", max_photos=1, session=Sess("https://lh3.googleusercontent.com/a=s800"), sleep=lambda s: None).fetch("ChIJX")
if ok.get("status") != "ok":
    fails.append("ảnh lh3 hợp lệ bị bỏ: %s" % ok.get("error"))
if fails:
    print("FAIL fetcher nhận photoUri trỏ về API Google: %s" % "; ".join(fails)); sys.exit(1)
print("PASS fetcher loại photoUri googleapis (cũ, hoa thường), nhận lh3")
