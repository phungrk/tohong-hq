#!/usr/bin/env python3
"""T-106 ràng buộc kế thừa (ADR-025, ADR-041; KHÔNG phải tiêu chí mới của Capu): pool sau T-106 so với mốc trên main của tohong-back chỉ khác ở
`photos` (và `styles`/`tags` theo lệnh tools/regen-pool-styles.sh) của vendor category=venue. Mọi trường khác của mọi vendor giữ nguyên (đặc biệt priceMin/priceMax:
ADR-025, 36 vendor lệch giá do tạo lại pool toàn phần), tập id không thêm; id mất chỉ khi nằm trong removed_vendors.json (place_id Google 404).
Vendor venue có photos đổi thì mọi ảnh mới đều source=google. styles == tags. Và bất biến planner/vendor/pool/inv-001 (styles khớp văn bản nguồn) vẫn đạt.
Tập "venue" (ADR-047) = vendor có category=venue trong pool HOẶC có id trong snapshot cố định eval/T-106/venue_address_snapshot.json (99 id, tohong@46b6bc4; KHÔNG đọc nguồn của nhánh đang kiểm), kể cả khi id đó cũng nằm ở nguồn khác (vd honeymoon). Vendor ngoài tập này không được đổi gì.
Mốc: T106_BASE_REF, mặc định merge-base(HEAD, origin/main) của tohong-back. Pool chưa đổi so với mốc => đỏ (chưa có ảnh Google venue). Cần: TOHONG_REPO, TOHONG_BACK_REPO."""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
t, b = c.tohong(), c.back()
def git(*a):
    return subprocess.run(["git", "-C", b, *a], capture_output=True, text=True)
ref = os.environ.get("T106_BASE_REF")
if not ref:
    m = git("merge-base", "HEAD", "origin/main")
    if m.returncode != 0:
        c.fail("không xác định được mốc so (không có origin/main); đặt T106_BASE_REF")
    ref = m.stdout.strip()
s = git("show", ref + ":lib/vendorPool.generated.js")
if s.returncode != 0:
    c.fail("không đọc được pool ở mốc %s" % ref)
old = {p["id"]: p for p in c.parse_pool(s.stdout)}
cur_list = c.load_pool(b)
cur = {p["id"]: p for p in cur_list}
gone = c.removed_ids(t)
venue_ids = set(c.load_address_snapshot())  # snapshot cố định, không đọc nguồn của nhánh đang kiểm (ADR-047)
def is_venue(p):
    return p.get("category") == "venue" or p.get("id") in venue_ids
added = [i for i in cur if i not in old]
if added:
    c.fail("pool thêm %d id mới so với mốc, vd %s" % (len(added), added[0]))
lost = [i for i in old if i not in cur and not (is_venue(old[i]) and i in gone)]
if lost:
    c.fail("pool mất %d vendor không phải venue-place_id-404, vd %s" % (len(lost), lost[0]))
changed = 0
for i, p in cur.items():
    q = old[i]
    diff = {k for k in set(p) | set(q) if p.get(k) != q.get(k)}
    if p.get("styles") != p.get("tags"):
        c.fail("%s: styles != tags" % i)
    if not diff:
        continue
    if not is_venue(p):
        c.fail("%s (category %s, id không có trong nguồn venue) đổi trường %s: chỉ venue được đổi" % (i, p.get("category"), sorted(diff)))
    extra = diff - {"photos", "styles", "tags"}
    if extra:
        c.fail("%s (venue) đổi trường ngoài photos/styles/tags: %s" % (i, sorted(extra)))
    if "photos" in diff:
        if not p["photos"] or any(x.get("source") != "google" for x in p["photos"]):
            c.fail("%s: photos đổi nhưng không phải toàn ảnh source=google" % i)
        changed += 1
if changed == 0:
    c.fail("pool chưa đổi so với mốc %s: chưa có vendor venue nào được thêm ảnh Google" % ref[:8])
inv = os.path.join(c.HQ, "eval", "invariants", "planner", "vendor", "pool", "inv-001-pool-khop-van-ban-nguon.py")
if os.path.isfile(inv):
    r = subprocess.run([sys.executable, "-I", inv], capture_output=True, text=True, env=dict(os.environ, TOHONG_REPO=t, TOHONG_BACK_REPO=b))
    if r.returncode != 0:
        c.fail("bất biến planner/vendor/pool/inv-001 đỏ: " + (r.stdout + r.stderr).strip()[:200])
c.ok("pool chỉ đổi photos/styles ở %d vendor venue so với %s; giá và mọi trường khác giữ nguyên; inv-001 pool đạt" % (changed, ref[:8]))
