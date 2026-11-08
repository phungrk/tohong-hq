#!/usr/bin/env python3
"""T-104 · adv-01 (tầng 3, adversary). Generator pool (tohong/tools/generate-vendor-pool.js) không được sinh ảnh Google thiếu ghi công.
Input phá: vendor có `google_photos` mà Google trả authorAttributions rỗng, hoặc chỉ có `uri` (displayName rỗng → google_photos.py ghi name ""),
hoặc displayName chỉ là khoảng trắng, hoặc thiếu hẳn khoá `attributions`. Đây là dữ liệu google_photos.py sinh được hợp lệ
(_media giữ attribution khi có displayName HOẶC uri).
Mong đợi: pool sinh ra vẫn đạt INV-013 (mọi ảnh Google có attribution không rỗng sau strip) — generator phải bỏ ảnh đó hoặc ghi công thay thế
(vd "Google Maps"), không được để ảnh Google trơn. Lý do: front #64 PhotoCredit trả null khi không có attribution → ảnh Google hiện không ghi công.
Cách đo: chép generator của tohong vào thư mục tạm (không có edge/ → không chạy rewrite), sinh pool từ fixture, chạy INV-013 trên pool đó.
Repo tohong: TOHONG_REPO, rồi cwd, rồi ../tohong. Không tìm thấy generator có `google_photos` hoặc không có node: PASS "chưa áp dụng".
Mã thoát 0 = đạt."""
import json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
INV = os.path.join(HERE, "..", "invariants", "planner", "vendor", "images", "inv-013-anh-google-co-ghi-cong.py")
GEN = os.path.join("tools", "generate-vendor-pool.js")
cands = [os.environ.get("TOHONG_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, GEN))
             and "google_photos" in open(os.path.join(c, GEN), encoding="utf-8").read()), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy generator có google_photos)"); sys.exit(0)
if not shutil.which("node"): print("PASS chưa áp dụng (không có node)"); sys.exit(0)

def vendor(i, attrs):
    p = {"uri": "https://lh3.googleusercontent.com/grass-cs/adv%02d=s4800-w800" % i, "width": 800, "height": 600, "fetched_at": "2026-11-08T00:00:00Z"}
    if attrs is not None: p["attributions"] = attrs
    return {"id": "adv_%02d" % i, "name": "Adv %d" % i, "categories": ["photography"], "city": "HCMC", "google_photos": [p]}

cases = [
    [],                                                            # Google trả authorAttributions rỗng
    [{"name": "", "uri": "https://maps.google.com/maps/contrib/1"}],  # chỉ có uri
    [{"name": "   ", "uri": ""}],                                  # displayName khoảng trắng
    None,                                                          # thiếu khoá attributions
]
root = tempfile.mkdtemp(prefix="adv01-")
try:
    gen, back = os.path.join(root, "gen"), os.path.join(root, "back")   # generator + input tách khỏi repo giả mà INV quét
    os.makedirs(os.path.join(gen, "tools")); os.makedirs(os.path.join(back, "lib"))
    shutil.copy(os.path.join(repo, GEN), os.path.join(gen, GEN))
    inp = os.path.join(gen, "in.json"); out = os.path.join(back, "lib", "vendorPool.generated.js")
    json.dump([vendor(i, a) for i, a in enumerate(cases)], open(inp, "w", encoding="utf-8"))
    r = subprocess.run(["node", os.path.join(gen, GEN), "--in", inp, "--out", out], capture_output=True, text=True, timeout=60)
    if r.returncode != 0 or not os.path.isfile(out):
        print("FAIL generator lỗi với fixture: %s" % (r.stderr or r.stdout)[-300:]); sys.exit(1)
    env = dict(os.environ, TOHONG_BACK_REPO=back)
    v = subprocess.run([sys.executable, "-I", INV], capture_output=True, text=True, env=env, timeout=60)
    print(v.stdout.strip())
    sys.exit(0 if v.returncode == 0 else 1)
finally:
    shutil.rmtree(root, True)
