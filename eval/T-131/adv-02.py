#!/usr/bin/env python3
"""T-131 adv-02 (adversary, Code Gate tầng 3, v2). Biên của rewrite manifest khi vendor bị hạ (applyImageManifest khi added.length || photosDemoted).
Dữ liệu tổng hợp, không mạng, thư mục tạm. Ca:
  G  không vendor thêm, không vendor hạ: pool ra byte-giống lần chạy khi không có công cụ ảnh (rewrite không đụng gì).
  H  có vendor hạ, có công cụ nhưng KHÔNG có manifest.json: thoát 0, bỏ qua rewrite, ảnh = URL marry gốc.
  I  có vendor hạ, manifest entries rỗng: thoát 0, pool byte-giống ca H (rewrite không đổi byte nào).
  J  có vendor hạ, manifest có ok: URL ok -> Pages, failed giữ gốc; vendor khác (đã là Pages URL) không đổi; chạy lần 2 trên kết quả: bất động.
  K  manifest hỏng (không phải JSON): generator thoát khác 0 (không im lặng để URL gốc).
Env TOHONG_REPO, TOHONG_BACK_REPO. In PASS hoặc FAIL <ca>: <lý do>. Mã 0 = đạt."""
import json, os, shutil, subprocess, sys, tempfile
T = os.environ.get("TOHONG_REPO", "/home/user/tohong"); B = os.environ.get("TOHONG_BACK_REPO", "/home/user/tohong-back")
GEN = os.path.join(T, "tools", "generate-vendor-pool.js"); IMG = os.path.join(B, "scripts", "vendor-images", "vendor-images.mjs")
if not os.path.isfile(GEN) or not os.path.isfile(IMG): print("FAIL thiếu generator hoặc vendor-images.mjs"); sys.exit(1)
HDR = "// AUTO-GENERATED\nexport const GENERATED_VENDOR_POOL = "
BASEURL = "https://tohong-img.pages.dev"
def pv(i, photos): return {"id": i, "name": i, "category": "venue", "catLabel": "x", "catIcon": "x", "description": "d", "styles": [], "priceMin": 1, "priceMax": 2,
                           "city": "HCMC", "rating": 4, "reviewCount": 3, "photos": photos, "availability": [1], "tags": [], "isVerified": True}
G1 = {"url": "https://lh3.googleusercontent.com/p/OLD=w800", "source": "google", "attribution": "A"}
PAGES = {"url": BASEURL + "/v/k.webp", "source": "marry"}
base_dem = [pv("v_dem", [G1]), pv("v_mir", [PAGES])]
base_nodem = [pv("v_mir", [PAGES]), pv("v_keep", [G1])]
src = {"vendors": [{"id": "v_dem", "categories": ["venue"], "style_tags": [], "enrichment_log": [], "portfolio_urls": ["https://www.marry.vn/a.jpg", "https://www.marry.vn/b.jpg"]},
                   {"id": "v_mir", "categories": ["venue"], "style_tags": [], "enrichment_log": []},
                   {"id": "v_keep", "categories": ["venue"], "style_tags": [], "enrichment_log": [{"source": "google_maps", "place_id": "P"}]}]}
MAN_OK = {"baseUrl": BASEURL, "entries": {"https://www.marry.vn/a.jpg": {"status": "ok", "file": "v/a.webp"}, "https://www.marry.vn/b.jpg": {"status": "failed"},
                                          BASEURL + "/v/k.webp": {"status": "ok", "file": "v/zzz.webp"}}}
SRC_G = {"vendors": [v for v in src["vendors"] if v["id"] != "v_dem"]}
bad = []
def setup(tool, man, sv=None):
    W = tempfile.mkdtemp(); os.makedirs(os.path.join(W, "tools")); shutil.copy(GEN, os.path.join(W, "tools"))
    d = os.path.join(W, "edge", "scripts", "vendor-images"); os.makedirs(d)
    if tool: shutil.copy(IMG, d)
    if man is not None: open(os.path.join(d, "manifest.json"), "w").write(man if isinstance(man, str) else json.dumps(man))
    json.dump(sv or src, open(os.path.join(W, "src.json"), "w")); return W
def run(W, base, again=False):
    out = os.path.join(W, "p.js")
    if not again: open(out, "w").write(HDR + json.dumps(base) + ";\n")
    r = subprocess.run(["node", os.path.join(W, "tools", "generate-vendor-pool.js"), "--styles-only", "--prune", "--photos-for", "all",
                        "--in", os.path.join(W, "src.json"), "--base", out, "--out", out], capture_output=True, text=True, cwd=W)
    s = open(out).read()
    return r.returncode, s, {v["id"]: v for v in json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])}
Ws = []
try:
    W = setup(False, None, SRC_G); Ws.append(W); _, g0, _ = run(W, base_nodem)
    W = setup(True, MAN_OK, SRC_G); Ws.append(W); rc, g1, _ = run(W, base_nodem)
    if rc or g1 != g0: bad.append("G: không thêm/không hạ mà pool đổi byte (rc=%d)" % rc)
    W = setup(True, None); Ws.append(W); rc, h, hb = run(W, base_dem)
    if rc or [p["url"] for p in hb["v_dem"]["photos"]] != ["https://www.marry.vn/a.jpg", "https://www.marry.vn/b.jpg"]: bad.append("H: rc=%d photos=%s" % (rc, hb["v_dem"]["photos"]))
    W = setup(True, {"baseUrl": BASEURL, "entries": {}}); Ws.append(W); rc, i_, _ = run(W, base_dem)
    if rc or i_ != h: bad.append("I: manifest rỗng mà pool khác ca H (rc=%d)" % rc)
    W = setup(True, MAN_OK); Ws.append(W); rc, j1, jb = run(W, base_dem)
    if rc or [p["url"] for p in jb["v_dem"]["photos"]] != [BASEURL + "/v/a.webp", "https://www.marry.vn/b.jpg"]: bad.append("J: rc=%d photos=%s" % (rc, jb["v_dem"]["photos"]))
    if jb["v_mir"]["photos"] != [PAGES]: bad.append("J: vendor đã là Pages URL bị đổi: %s" % jb["v_mir"]["photos"])
    rc2, j2, _ = run(W, None, again=True)
    if rc2 or j2 != j1: bad.append("J: chạy lần 2 không bất động (rc=%d)" % rc2)
    W = setup(True, "{không phải json"); Ws.append(W); rc, _, _ = run(W, base_dem)
    if rc == 0: bad.append("K: manifest hỏng mà generator thoát 0")
finally:
    for W in Ws: shutil.rmtree(W, ignore_errors=True)
if bad: print("FAIL " + " | ".join(bad)); sys.exit(1)
print("PASS 5 ca (G-K) đạt"); sys.exit(0)
