#!/usr/bin/env python3
"""T-131 adv-01 (adversary, Code Gate tầng 3). Bộ đối kháng cho nhánh gỡ ảnh Google của vendor bị hạ trong
tools/generate-vendor-pool.js --styles-only --prune --photos-for. Dữ liệu tổng hợp, không gọi mạng, không đụng repo thật:
chép generator (và edge/scripts/vendor-images/vendor-images.mjs của tohong-back) vào thư mục tạm, chạy trên pool nền + nguồn dựng tay.
Ca:
  A  vendor bị hạ (nguồn không place_id, không google_photos) mà portfolio marry đã mirror ok trong manifest:
     pool không được chứa URL gốc có entry ok (INV-001 ii) — ảnh về photosOf phải qua rewrite như vendor thêm lại.
  B  --photos-for venue không đụng vendor bị hạ ở category photography (ảnh giữ nguyên).
  C  vendor còn place_id, nguồn tạm hết ảnh: giữ ảnh cũ (đúng spec).
  D  vendor bị hạ ở một bản category nhưng bản category khác còn place_id+ảnh (bản gộp của build_pool): nhận ảnh Google mới.
  E  vendor bị hạ, không portfolio: photos = [] (không bịa nguồn).
  F  chạy hai lần liên tiếp (lần 2 lấy pool lần 1 làm nền) cho kết quả byte-giống nhau; trường khác ảnh/styles/tags không đổi.
Env: TOHONG_REPO (worktree tohong), TOHONG_BACK_REPO. In PASS hoặc FAIL <ca>: <lý do>. Mã 0 = đạt."""
import json, os, shutil, subprocess, sys, tempfile
T = os.environ.get("TOHONG_REPO", "/home/user/tohong"); B = os.environ.get("TOHONG_BACK_REPO", "/home/user/tohong-back")
GEN = os.path.join(T, "tools", "generate-vendor-pool.js"); IMG = os.path.join(B, "scripts", "vendor-images", "vendor-images.mjs")
if not os.path.isfile(GEN) or not os.path.isfile(IMG): print("FAIL thiếu generator hoặc vendor-images.mjs"); sys.exit(1)
HDR = "// AUTO-GENERATED\nexport const GENERATED_VENDOR_POOL = "
G = lambda n: {"url": "https://lh3.googleusercontent.com/p/OLD%s=w800" % n, "source": "google", "attribution": "Tác giả %s" % n}
def pv(i, cat, photos): return {"id": i, "name": i, "category": cat, "catLabel": "x", "catIcon": "x", "description": "d " + i, "styles": [], "priceMin": 1, "priceMax": 2,
                                 "city": "HCMC", "rating": 4.5, "reviewCount": 9, "photos": photos, "availability": [1], "tags": [], "isVerified": True}
PID = [{"source": "google_maps", "place_id": "ChIJkeep"}]
NEWG = [{"uri": "https://lh3.googleusercontent.com/p/NEW=w800", "attributions": [{"name": "Mới"}]}]
base = [pv("v_dem_mirror", "venue", [G(1), G(2)]), pv("v_dem_photo", "photography", [G(3)]), pv("v_keep", "venue", [G(4)]),
        pv("v_cross", "venue", [G(5)]), pv("v_dem_empty", "venue", [G(6)]), pv("v_plain", "venue", [{"url": "https://www.marry.vn/images/plain.jpg", "source": "marry"}])]
src = [{"id": "v_dem_mirror", "categories": ["venue"], "style_tags": ["sang_trong"], "enrichment_log": [{"source": "google_maps", "status": "few_reviews"}],
        "portfolio_urls": ["https://www.marry.vn/images/m1.jpg", "https://www.marry.vn/images/m2.jpg"]},
       {"id": "v_dem_photo", "categories": ["photography"], "style_tags": [], "enrichment_log": [], "portfolio_urls": ["https://www.marry.vn/images/p1.jpg"]},
       {"id": "v_keep", "categories": ["venue"], "style_tags": [], "enrichment_log": PID, "google_photos": []},
       {"id": "v_cross", "categories": ["venue", "photography"], "style_tags": [], "enrichment_log": PID, "google_photos": NEWG},
       {"id": "v_dem_empty", "categories": ["venue"], "style_tags": [], "enrichment_log": [{"source": "google_maps", "status": "low_confidence"}]},
       {"id": "v_plain", "categories": ["venue"], "style_tags": [], "enrichment_log": []}]
man = {"baseUrl": "https://tohong-img.pages.dev", "entries": {"https://www.marry.vn/images/m1.jpg": {"status": "ok", "file": "v/m1.webp"},
                                                             "https://www.marry.vn/images/m2.jpg": {"status": "failed"}}}
def load(p): s = open(p, encoding="utf-8").read(); return s, json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])
W = tempfile.mkdtemp(); bad = []
try:
    os.makedirs(os.path.join(W, "tools")); os.makedirs(os.path.join(W, "edge", "scripts", "vendor-images"))
    shutil.copy(GEN, os.path.join(W, "tools")); shutil.copy(IMG, os.path.join(W, "edge", "scripts", "vendor-images"))
    json.dump(man, open(os.path.join(W, "edge", "scripts", "vendor-images", "manifest.json"), "w"))
    json.dump({"vendors": src}, open(os.path.join(W, "src.json"), "w"))
    def run(cat, out, basef):
        data = json.load(open(basef)) if basef.endswith(".json") else load(basef)[1]
        open(out, "w").write(HDR + json.dumps(data) + ";\n")
        r = subprocess.run(["node", os.path.join(W, "tools", "generate-vendor-pool.js"), "--styles-only", "--prune", "--photos-for", cat,
                            "--in", os.path.join(W, "src.json"), "--base", out, "--out", out], capture_output=True, text=True, cwd=W)
        if r.returncode: print("FAIL generator thoát %d: %s" % (r.returncode, (r.stderr or r.stdout)[-300:])); sys.exit(1)
        return load(out)
    json.dump(base, open(os.path.join(W, "base.json"), "w"))
    s1, p1 = run("all", os.path.join(W, "p1.js"), os.path.join(W, "base.json")); by = {v["id"]: v for v in p1}
    urls = [x["url"] for x in by["v_dem_mirror"]["photos"]]
    if any(man["entries"].get(u, {}).get("status") == "ok" for u in urls):
        bad.append("A: vendor bị hạ về ảnh portfolio nhưng URL đã mirror ok còn ở dạng gốc (INV-001 ii): %s" % urls)
    if any(x.get("source") == "google" for x in by["v_dem_mirror"]["photos"]): bad.append("A: còn ảnh Google")
    if by["v_keep"]["photos"] != [G(4)]: bad.append("C: vendor còn place_id mất ảnh cũ: %s" % by["v_keep"]["photos"])
    if [x["url"] for x in by["v_cross"]["photos"]] != ["https://lh3.googleusercontent.com/p/NEW=w800"]: bad.append("D: %s" % by["v_cross"]["photos"])
    if by["v_dem_empty"]["photos"] != []: bad.append("E: %s" % by["v_dem_empty"]["photos"])
    for v in base:
        o = by[v["id"]]
        for k in v:
            if k not in ("photos", "styles", "tags") and v[k] != o[k]: bad.append("F: %s.%s đổi" % (v["id"], k))
    _, pb = run("venue", os.path.join(W, "pb.js"), os.path.join(W, "base.json")); byb = {v["id"]: v for v in pb}
    if byb["v_dem_photo"]["photos"] != [G(3)]: bad.append("B: --photos-for venue đụng vendor photography: %s" % byb["v_dem_photo"]["photos"])
    shutil.copy(os.path.join(W, "p1.js"), os.path.join(W, "p2.js"))
    s2, _ = run("all", os.path.join(W, "p2.js"), os.path.join(W, "p2.js"))
    s1b, _ = run("all", os.path.join(W, "p1b.js"), os.path.join(W, "base.json"))
    if s1 != s1b: bad.append("F: hai lần chạy cùng đầu vào khác nhau")
    if s1 != s2: bad.append("F: chạy lần 2 trên kết quả lần 1 không bất động")
finally:
    shutil.rmtree(W, ignore_errors=True)
if bad: print("FAIL " + " | ".join(bad)); sys.exit(1)
print("PASS 6 ca (A-F) đạt"); sys.exit(0)
