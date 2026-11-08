#!/usr/bin/env python3
"""T-104 · adv-05 (tầng 3, adversary, review v2 / PR tohong #70). Generator pool (tohong/tools/generate-vendor-pool.js) không được đưa vào pool
URL mà TRÌNH DUYỆT phân giải thành endpoint API Google hoặc mang tham số key, dù chuỗi viết lách bộ lọc regex.
Input phá (kiểm bằng `new URL()` của node, cùng bộ phân tích WHATWG như trình duyệt):
  `https://places%2Egoogleapis.com/...`, `https://places%2egoogleapis%2ecom/...`  → host places.googleapis.com (host được giải mã %)
  `https://places。googleapis.com/...` (dấu chấm ý văn), `https://places．googleapis.com/...` (chấm toàn khổ) → host places.googleapis.com (IDNA)
  `https://maps.googleapis.com/maps/api/place/photo?photoreference=A&%6Bey=<khoá giả>` → searchParams key = khoá
Mong đợi: không ảnh nào trong pool có hostname (sau WHATWG, bỏ dấu chấm cuối) là googleapis.com hoặc *.googleapis.com, và không ảnh nào có
tham số `key` sau giải mã. Cách sửa gợi ý: kiểm host đã phân tích (allowlist *.googleusercontent.com cho source google), không so chuỗi thô.
Khoá trong fixture là khoá giả, eval không in khoá. Chép generator vào thư mục tạm (không có edge/ → không chạy rewrite).
Repo tohong: TOHONG_REPO, rồi cwd, rồi ../tohong. Không tìm thấy generator có `google_photos` hoặc không có node: PASS "chưa áp dụng".
Mã thoát 0 = đạt."""
import json, os, shutil, subprocess, sys, tempfile

GEN = os.path.join("tools", "generate-vendor-pool.js")
cands = [os.environ.get("TOHONG_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, GEN))
             and "google_photos" in open(os.path.join(c, GEN), encoding="utf-8").read()), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy generator có google_photos)"); sys.exit(0)
if not shutil.which("node"): print("PASS chưa áp dụng (không có node)"); sys.exit(0)

FAKE = "AIza" + "X" * 35
uris = [
    "https://places%2Egoogleapis.com/v1/places/X/photos/Y/media?maxWidthPx=800",
    "https://places%2egoogleapis%2ecom/v1/places/X/photos/Y/media",
    "https://places。googleapis.com/v1/places/X/photos/Y/media",
    "https://places．googleapis.com/v1/places/X/photos/Y/media",
    "https://maps.googleapis.com/maps/api/place/photo?photoreference=A&%6Bey=" + FAKE,
]
vendors = [{"id": "adv_%02d" % i, "name": "Adv %d" % i, "categories": ["photography"], "city": "HCMC",
            "google_photos": [{"uri": u, "attributions": [{"name": "Tác giả", "uri": ""}], "fetched_at": "2026-11-08T00:00:00Z"}]}
           for i, u in enumerate(uris)]
CHECK = r"""
const fs = require('fs'); const src = fs.readFileSync(process.argv[2], 'utf8');
const pool = JSON.parse(src.slice(src.indexOf('= [') + 2, src.lastIndexOf(']') + 1));
const bad = [];
for (const v of pool) for (const p of v.photos || []) {
  let u; try { u = new URL(p.url); } catch { continue; }          // URL không phân tích được thì trình duyệt không tải
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'googleapis.com' || h.endsWith('.googleapis.com')) bad.push(v.id + ': host ' + h);
  else if (u.searchParams.has('key')) bad.push(v.id + ': tham số key');
}
console.log(JSON.stringify(bad));
"""
root = tempfile.mkdtemp(prefix="adv05-")
try:
    os.makedirs(os.path.join(root, "tools"))
    shutil.copy(os.path.join(repo, GEN), os.path.join(root, GEN))
    inp, out, chk = (os.path.join(root, n) for n in ("in.json", "out.js", "check.cjs"))
    json.dump(vendors, open(inp, "w", encoding="utf-8"), ensure_ascii=False)
    open(chk, "w", encoding="utf-8").write(CHECK)
    r = subprocess.run(["node", os.path.join(root, GEN), "--in", inp, "--out", out], capture_output=True, text=True, timeout=60)
    if r.returncode != 0 or not os.path.isfile(out):
        print("FAIL generator lỗi với fixture: %s" % (r.stderr or r.stdout)[-300:].replace(FAKE, "<khoá giả>")); sys.exit(1)
    c = subprocess.run(["node", chk, out], capture_output=True, text=True, timeout=60)
    if c.returncode != 0: print("FAIL không đọc được pool sinh ra: %s" % c.stderr[-200:]); sys.exit(1)
    bad = json.loads(c.stdout)
    if bad:
        print("FAIL %d/%d URL lách bộ lọc vào pool, trình duyệt sẽ gọi API Google: %s" % (len(bad), len(uris), "; ".join(bad))); sys.exit(1)
    print("PASS %d URL mã hoá/IDNA/%%-key đều bị loại khỏi pool" % len(uris))
finally:
    shutil.rmtree(root, True)
