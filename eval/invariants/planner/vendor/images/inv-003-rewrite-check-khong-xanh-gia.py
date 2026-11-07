#!/usr/bin/env python3
"""Nguồn: T-052 (adversary, rút từ eval/T-052/adv-01-rewrite-pool-co-khoang-trang.py; spec products/T-051-tu-host-anh-vendor.md mục 19,
INV-001 (ii); Chief of Staff đồng ý 2026-11-03).
INV-003 · `rewrite --check` của công cụ ảnh vendor không bao giờ báo xanh giả, và `rewrite` thay đủ, với mọi pool là module ES hợp lệ
`export const GENERATED_VENDOR_POOL = <mảng JSON>;` bất kể cách định dạng JSON (gọn, có dấu cách, xuống dòng/thụt lề, escape \\uXXXX, \\/):
  (i)   còn lượt ảnh `photos[].url` có entry `ok` mà chưa là Pages URL  → `rewrite --check` thoát 1;
  (ii)  sau `rewrite`, không còn lượt ảnh nào có entry `ok` trỏ URL gốc, mọi lượt ảnh ok trỏ đúng `<baseUrl>/<file>`, và giá trị JSON
        của pool chỉ khác ở các URL đó (số vendor, các trường khác, khoá `url` ngoài `photos` giữ nguyên);
  (iii) sau `rewrite`, `rewrite --check` thoát 0; ảnh `failed`/chưa có trong manifest giữ URL gốc.
Không cần mạng: dựng pool và manifest giả trong thư mục tạm, chỉ gọi `rewrite`.
Chạy không tham số (gate.py: python3 -I). Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back.
Chưa có scripts/vendor-images/vendor-images.mjs: PASS "chưa áp dụng". Mã thoát 0 = đạt."""
import atexit, json, os, shutil, subprocess, sys, tempfile

cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "lib", "vendorPool.generated.js"))), None)
tool = os.path.join(repo, "scripts", "vendor-images", "vendor-images.mjs") if repo else None
if not tool or not os.path.isfile(tool):
    print("PASS chưa áp dụng (chưa có scripts/vendor-images/vendor-images.mjs trong tohong-back)"); sys.exit(0)

BASE = "https://tohong-img.pages.dev"
SRC = "https://www.marry.vn/images/detailed/1/"
def v(i, photos, **kw):
    d = {"id": f"marry_{i:012d}", "name": f'Vendor "{i}" \\ {{url}} [photos]', "description": 'mô tả "url": "' + SRC + 'a.jpg"',
         "photos": [{"url": u} for u in photos], "tags": ["a", "b"], "priceMin": 5}
    d.update(kw); return d
vendors = [
    v(1, [SRC + "a.jpg", SRC + "b.png", SRC + "lỗi.jpg"], website={"url": SRC + "a.jpg"}),
    v(2, [SRC + "Logo-công-nghệ-cưới.jpg", SRC + "a.jpg"]),
    v(3, [SRC + "mới-chưa-mirror.jpg"]),
    v(4, []),
]
entries = {
    SRC + "a.jpg": {"status": "ok", "file": "v/marry_000000000001-aaaaaaaaaaaa.webp", "width": 800, "height": 600, "bytes": 10},
    SRC + "b.png": {"status": "ok", "file": "v/marry_000000000001-bbbbbbbbbbbb.webp", "width": 300, "height": 200, "bytes": 10},
    SRC + "Logo-công-nghệ-cưới.jpg": {"status": "ok", "file": "v/marry_000000000002-cccccccccccc.webp", "width": 640, "height": 480, "bytes": 10},
    SRC + "lỗi.jpg": {"status": "failed", "reason": "http-404", "attempts": 1},
}
ok_map = {u: BASE + "/" + e["file"] for u, e in entries.items() if e["status"] == "ok"}
expected = json.loads(json.dumps(vendors))
for x in expected:
    for p in x["photos"]:
        p["url"] = ok_map.get(p["url"], p["url"])
n_ok_refs = sum(1 for x in vendors for p in x["photos"] if p["url"] in ok_map)

P = "// AUTO-GENERATED — do not edit manually.\nexport const GENERATED_VENDOR_POOL = "
formats = {
    "gọn": json.dumps(vendors, ensure_ascii=False, separators=(",", ":")),
    "dấu cách": json.dumps(vendors, ensure_ascii=False),
    "thụt lề": json.dumps(vendors, ensure_ascii=False, indent=2),
    "escape \\uXXXX": json.dumps(vendors, ensure_ascii=True),
    "escape \\/": json.dumps(vendors, ensure_ascii=False, separators=(",", ":")).replace("/", "\\/"),
}
tmp = tempfile.mkdtemp(prefix="inv003-")
atexit.register(shutil.rmtree, tmp, True)  # ADR-038: dọn thư mục tạm
man = os.path.join(tmp, "manifest.json")
json.dump({"version": 1, "baseUrl": BASE, "entries": entries}, open(man, "w", encoding="utf-8"), ensure_ascii=False)
def rw(pool, *extra):
    return subprocess.run(["node", tool, "rewrite", "--pool", pool, "--manifest", man, *extra], capture_output=True, text=True, timeout=60)
def load(pool):
    s = open(pool, encoding="utf-8").read()
    return json.loads(s[s.index("GENERATED_VENDOR_POOL = ") + len("GENERATED_VENDOR_POOL = "):s.rindex(";")])
bad = []
for name, js in formats.items():
    pool = os.path.join(tmp, "pool.js")
    open(pool, "w", encoding="utf-8").write(P + js + ";\n")
    c = rw(pool, "--check")
    if c.returncode != 1:
        bad.append(f"[{name}] --check thoát {c.returncode} dù còn {n_ok_refs} lượt ảnh ok chưa rewrite ({c.stdout.strip()[:100]})"); continue
    r = rw(pool)
    if r.returncode != 0:
        bad.append(f"[{name}] rewrite thoát {r.returncode}: {r.stderr.strip()[:100]}"); continue
    try:
        got = load(pool)
    except Exception as e:
        bad.append(f"[{name}] pool sau rewrite không đọc được: {str(e)[:80]}"); continue
    if got != expected:
        left = [p["url"] for x in got for p in x.get("photos", []) if p["url"] in ok_map]
        bad.append(f"[{name}] pool sau rewrite sai" + (f": {len(left)} lượt ảnh ok còn URL gốc" if left else ": đổi dữ liệu ngoài photos[].url hoặc URL sai"))
        continue
    c2 = rw(pool, "--check")
    if c2.returncode != 0:
        bad.append(f"[{name}] --check sau rewrite thoát {c2.returncode}")
if bad:
    print(f"FAIL {len(bad)}/{len(formats)} định dạng pool: " + " | ".join(bad)); sys.exit(1)
print(f"PASS rewrite --check không xanh giả, rewrite thay đủ trên {len(formats)} định dạng pool"); sys.exit(0)
