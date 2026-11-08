#!/usr/bin/env python3
"""T-104 · adv-02 (tầng 3, adversary). Generator pool (tohong/tools/generate-vendor-pool.js) không được đưa URL API Places dạng khác vào pool.
Input phá: `google_photos[].uri` là endpoint Place Photo cũ `https://maps.googleapis.com/maps/api/place/photo?...&key=<khoá>` (ví dụ ai đó dán
tay vào vendors.json, hoặc API đổi), hoặc URL googleapis bất kỳ mang `key=`. Generator hiện chỉ lọc chuỗi `places.googleapis.com`.
Mong đợi: pool sinh ra vẫn đạt INV-012 (không URL API Places, không `key=`, không chuỗi khoá) — generator phải loại các ảnh đó.
Khoá trong fixture là khoá giả (AIza + 35 chữ X), eval không in khoá.
Cách đo: chép generator vào thư mục tạm (không có edge/ → không chạy rewrite), sinh pool từ fixture, chạy INV-012 trên pool đó.
Repo tohong: TOHONG_REPO, rồi cwd, rồi ../tohong. Không tìm thấy generator có `google_photos` hoặc không có node: PASS "chưa áp dụng".
Mã thoát 0 = đạt."""
import json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
INV = os.path.join(HERE, "..", "invariants", "planner", "vendor", "images", "inv-012-pool-khong-url-places-api.py")
GEN = os.path.join("tools", "generate-vendor-pool.js")
cands = [os.environ.get("TOHONG_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, GEN))
             and "google_photos" in open(os.path.join(c, GEN), encoding="utf-8").read()), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy generator có google_photos)"); sys.exit(0)
if not shutil.which("node"): print("PASS chưa áp dụng (không có node)"); sys.exit(0)

FAKE = "AIza" + "X" * 35
uris = [
    "https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=AbC&key=" + FAKE,
    "https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=AbC",
    "https://PLACES.GOOGLEAPIS.COM/v1/places/X/photos/Y/media?maxWidthPx=800",
]
vendors = [{"id": "adv_%02d" % i, "name": "Adv %d" % i, "categories": ["photography"], "city": "HCMC",
            "google_photos": [{"uri": u, "attributions": [{"name": "Tác giả", "uri": ""}], "fetched_at": "2026-11-08T00:00:00Z"}]}
           for i, u in enumerate(uris)]
root = tempfile.mkdtemp(prefix="adv02-")
try:
    gen, back = os.path.join(root, "gen"), os.path.join(root, "back")   # generator + input tách khỏi repo giả mà INV quét
    os.makedirs(os.path.join(gen, "tools")); os.makedirs(os.path.join(back, "lib"))
    shutil.copy(os.path.join(repo, GEN), os.path.join(gen, GEN))
    inp = os.path.join(gen, "in.json"); out = os.path.join(back, "lib", "vendorPool.generated.js")
    json.dump(vendors, open(inp, "w", encoding="utf-8"))
    r = subprocess.run(["node", os.path.join(gen, GEN), "--in", inp, "--out", out], capture_output=True, text=True, timeout=60)
    if r.returncode != 0 or not os.path.isfile(out):
        print("FAIL generator lỗi với fixture: %s" % (r.stderr or r.stdout)[-300:].replace(FAKE, "<khoá giả>")); sys.exit(1)
    env = dict(os.environ, TOHONG_BACK_REPO=back)
    v = subprocess.run([sys.executable, "-I", INV], capture_output=True, text=True, env=env, timeout=60)
    print(v.stdout.strip().replace(FAKE, "<khoá giả>"))
    sys.exit(0 if v.returncode == 0 else 1)
finally:
    shutil.rmtree(root, True)
