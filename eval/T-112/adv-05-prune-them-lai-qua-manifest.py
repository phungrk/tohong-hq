#!/usr/bin/env python3
"""T-112 adv-05 (adversary, tầng 3). Bất biến INV-001 (eval/invariants/planner/vendor/images/inv-001-…): URL gốc đã có entry `ok` trong manifest ảnh
không được nằm trong pool (phải là URL Pages). Sinh pool đầy đủ áp `rewrite` của manifest; nhưng `--styles-only --prune` (mới ở T-112, regen-pool-styles.sh
LUÔN truyền) THÊM LẠI vendor có trong nguồn mà chưa có trong pool nền (vendor hết tạm đóng cửa như Pergola, vendor `--restore` như Tự Do) bằng toPoolVendor
rồi thoát trước bước rewrite -> vendor thêm lại mang URL marry.vn gốc dù ảnh đã mirror (marry.vn đã chết: ảnh hỏng trên app).
Input phá (OFFLINE, không mạng): pool nền có B, nguồn có B và X (X vừa hết tạm đóng cửa, portfolio_urls=[U]); manifest có U status ok -> file x.webp.
Chạy `node tools/generate-vendor-pool.js --styles-only --prune --in <nguồn> --base <pool> --out <pool>` trong bản sao repo có edge/scripts/vendor-images/.
Mong: X được thêm lại và pool đạt INV-001 (không còn U; nếu có URL Pages thì trỏ entry ok). Cần TOHONG_REPO, TOHONG_BACK_REPO (công cụ rewrite).
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, shutil, subprocess, sys, tempfile, atexit
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-106"))
import _common as c

tmp = tempfile.mkdtemp(prefix="t112-adv05-")
atexit.register(shutil.rmtree, tmp, True)
os.makedirs(os.path.join(tmp, "tools"))
shutil.copy(os.path.join(c.tohong(), "tools", "generate-vendor-pool.js"), os.path.join(tmp, "tools"))
img = os.path.join(tmp, "edge", "scripts", "vendor-images")
os.makedirs(img)
os.makedirs(os.path.join(tmp, "edge", "lib"))
shutil.copy(os.path.join(c.back(), "scripts", "vendor-images", "vendor-images.mjs"), img)
U = "https://www.marry.vn/images/detailed/adv05/x.jpg"
BASE = "https://vendor-images.example.pages.dev"
json.dump({"baseUrl": BASE, "entries": {U: {"status": "ok", "file": "v/x.webp"}}}, open(os.path.join(img, "manifest.json"), "w"))
B = {"id": "t112_B", "name": "Nhà hàng B", "category": "venue", "photos": [{"url": BASE + "/v/x.webp", "source": "marry"}], "styles": [], "tags": []}
pool = os.path.join(tmp, "edge", "lib", "vendorPool.generated.js")
open(pool, "w").write("// AUTO-GENERATED — do not edit manually.\nexport const GENERATED_VENDOR_POOL = %s;\n" % json.dumps([B]))
src = {"vendors": [{"id": "t112_B", "name": "Nhà hàng B", "categories": ["venue"], "style_tags": ["sang trọng"], "portfolio_urls": [U]},
                   {"id": "t112_X", "name": "Nhà hàng X", "categories": ["venue"], "style_tags": [], "portfolio_urls": [U], "city": "HCMC"}]}
srcp = os.path.join(tmp, "pool-vendors.json")
json.dump(src, open(srcp, "w"), ensure_ascii=False)
p = subprocess.run(["node", os.path.join(tmp, "tools", "generate-vendor-pool.js"), "--styles-only", "--prune", "--in", srcp, "--base", pool, "--out", pool],
                   cwd=tmp, capture_output=True, text=True, timeout=120)
if p.returncode != 0:
    print("FAIL generator thoát %d: %s" % (p.returncode, (p.stdout + p.stderr)[-200:])); sys.exit(1)
s = open(pool, encoding="utf-8").read()
vs = json.loads(s[s.index("= ") + 2:s.rindex(";")])
ids = [v["id"] for v in vs]
bad = []
if "t112_X" not in ids:
    bad.append("--prune không thêm lại X (có trong nguồn, chưa có trong pool nền)")
for v in vs:
    for ph in v.get("photos", []):
        if ph.get("url") == U:
            bad.append("%s: pool còn URL gốc %s dù manifest có entry ok (INV-001 ii)" % (v["id"], U))
        elif ph.get("url", "").startswith(BASE + "/") and ph["url"][len(BASE) + 1:] != "v/x.webp":
            bad.append("%s: URL Pages không có entry ok" % v["id"])
if bad:
    print("FAIL " + " | ".join(bad)); sys.exit(1)
print("PASS vendor được --prune thêm lại cũng qua rewrite manifest (INV-001)")
