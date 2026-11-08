#!/usr/bin/env python3
"""T-111 tiêu chí 5 ("không hiển thị trên app" đo được = không có trong pool) + lỗi công cụ pool của T-109. OFFLINE, không Google.
Dựng repo `tohong` tạm (tools/scraper bản thật + tools/generate-vendor-pool.js + tools/regen-pool-styles.sh bản thật, output fixture) và một tohong-back tạm có pool nền 6 vendor,
rồi chạy ĐÚNG lệnh `bash tools/regen-pool-styles.sh --back <tohong-back tạm> --photos-for all`:
  P_match (category attire, có place_id + 2 ảnh Google)   -> ở lại pool, photos thay bằng đúng 2 ảnh Google (source=google, host lh*.googleusercontent.com, có attribution), giá giữ nguyên.
  P_venue (venue, có ảnh Google)                          -> như trên (venue vẫn được xử lý).
  P_plain (không đụng tới)                                -> ở lại, ảnh marry giữ nguyên, giá giữ nguyên.
  P_temp (tạm đóng cửa, định nghĩa T-110 Hành vi 6: dòng audit có closed_state="temporarily_closed" VÀ retry=true, còn trong vendors.json) -> KHÔNG có trong pool.
  P_tlow (ứng viên CLOSED_TEMPORARILY bị cổng từ chối: status low_confidence NHƯNG vẫn closed_state + retry) -> KHÔNG có trong pool (T-110 nguồn ii; B2 của T-111-D1).
  P_gone (đã remove: có trong removed_vendors.json, không còn trong vendors.json, còn trong pool nền) -> KHÔNG có trong pool; lệnh thoát 0 (lỗi T-109: trước đây thoát 1).
  P_low (low_confidence thường, không closed_state)       -> Ở LẠI pool (không remove).
Sau đó: (a) P_temp được nhận khớp (audit enriched, có place_id + ảnh) rồi chạy lại -> P_temp QUAY LẠI pool; (b, kiểm hồi quy của `--prune` do T-110/T-112 làm; T-111 chỉ dùng lại, T-112 cũng phải đạt) gọi trực tiếp `node tools/generate-vendor-pool.js --styles-only` KHÔNG kèm --prune
trên pool nền còn vendor đã mất khỏi nguồn -> vẫn thoát 1 (an toàn mặc định, không xoá pool âm thầm); (c) nguồn rỗng (0 vendor) với --prune -> từ chối (thoát khác 0), pool không đổi;
(d) INV-012 và INV-013 xanh trên pool tạm. Spec: products/T-111-enrich-toan-bo-vendor.md, "Pool". In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, re, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
bad = []
repo = t.c.tohong()
for need in ("tools/generate-vendor-pool.js", "tools/regen-pool-styles.sh"):
    if not os.path.isfile(os.path.join(repo, need)):
        t.fail("thiếu %s trong repo tohong" % need)


def gv(i, name, cat, n, photos=False):
    v = x.V(i, name, n, (cat,))
    v["style_tags"] = []
    v["description"] = "Mô tả %s" % name
    if photos:
        v["google_photos"] = [{"uri": "https://lh3.googleusercontent.com/%s/%d" % (i, k), "attributions": [{"name": "Tác giả %d" % k}], "fetched_at": "2026-11-08T00:00:00Z"} for k in range(2)]
        v["enrichment_log"] = [{"source": "google_maps", "timestamp": "2026-11-08T04:03:36", "matched_name": name, "confidence": 1.0, "place_id": "PID_" + i,
                                "formatted_address": x.GADDR % n, "address_match": True, "changes": {}}]
    return v


def poolv(i, name, cat, n):
    return {"id": i, "name": name, "category": cat, "catLabel": "x", "catIcon": "x", "description": "d", "styles": [], "priceMin": 7 + n, "priceMax": 20 + n, "city": "HCMC", "rating": 4.5, "reviewCount": 3,
            "photos": [{"url": "https://www.marry.vn/images/%s.jpg" % i, "source": "marry"}], "availability": list(range(1, 13)), "tags": [], "isVerified": True}


mk = {"venue": [gv("P_venue", "Nhà hàng Pvenue", "venue", 1, True), gv("P_temp", "Nhà hàng Ptemp", "venue", 2), gv("P_low", "Nhà hàng Plow", "venue", 3),
                gv("P_tlow", "Nhà hàng Ptlow", "venue", 7)],
      "wedding_attire": [gv("P_match", "Áo cưới Pmatch", "attire", 4, True), gv("P_plain", "Áo cưới Pplain", "attire", 5)]}
r = t.Root(mk, parent="repo")
os.makedirs(os.path.join(r.base, "tools"), exist_ok=True)
for f in ("generate-vendor-pool.js", "regen-pool-styles.sh"):
    shutil.copy(os.path.join(repo, "tools", f), os.path.join(r.base, "tools", f))
os.makedirs(os.path.join(r.base, "tools", "scraper", "output"), exist_ok=True)
open(os.path.join(r.base, "tools", "scraper", "output", "vendors.json"), "w").write('{"vendors": []}')
gone = gv("P_gone", "Nhà hàng Pgone", "venue", 6)
r.write("venue/removed_vendors.json", [{"removed_at": "2026-11-08T10:00:00Z", "reason": "no_match sau thử tên rút gọn", "vendor": gone}])
r.write("venue/enrichment-audit.json", [
    {"vendor_id": "P_temp", "status": "temporarily_closed", "retry": True, "closed_state": "temporarily_closed", "matched_name": "Nhà hàng Ptemp", "confidence": 1.0, "candidate_place_id": "PT"},
    {"vendor_id": "P_tlow", "status": "low_confidence", "reject_reason": "low_score", "retry": True, "closed_state": "temporarily_closed", "matched_name": "Khác", "confidence": 0.2, "candidate_place_id": "PTL"},
    {"vendor_id": "P_low", "status": "low_confidence", "reject_reason": "low_score", "matched_name": "Khác", "confidence": 0.2, "candidate_place_id": "PL"}])
back = os.path.join(r.base, "back")
os.makedirs(os.path.join(back, "lib"))
base_pool = [poolv("P_venue", "Nhà hàng Pvenue", "venue", 1), poolv("P_temp", "Nhà hàng Ptemp", "venue", 2), poolv("P_low", "Nhà hàng Plow", "venue", 3),
             poolv("P_match", "Áo cưới Pmatch", "attire", 4), poolv("P_plain", "Áo cưới Pplain", "attire", 5), poolv("P_gone", "Nhà hàng Pgone", "venue", 6),
             poolv("P_tlow", "Nhà hàng Ptlow", "venue", 7)]
PF = os.path.join(back, "lib", "vendorPool.generated.js")


def write_pool(items):
    open(PF, "w", encoding="utf-8").write("// AUTO-GENERATED\nexport const GENERATED_VENDOR_POOL = " + json.dumps(items, ensure_ascii=False) + ";\n")


def read_pool():
    s = open(PF, encoding="utf-8").read()
    return {v["id"]: v for v in json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])}


def regen(extra=()):
    p = subprocess.run(["bash", "tools/regen-pool-styles.sh", "--back", back, "--photos-for", "all"] + list(extra), cwd=r.base, capture_output=True, text=True, timeout=300)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


write_pool(base_pool)
rc, o = regen()
if rc != 0:
    t.fail("regen-pool-styles.sh --photos-for all thoát %d (lỗi T-109: pool nền còn vendor đã gỡ phải được gỡ, không thoát lỗi): %s" % (rc, o.strip().splitlines()[-1:] or ""))
P = read_pool()
for gone_id in ("P_gone", "P_temp", "P_tlow"):
    if gone_id in P:
        bad.append("%s vẫn có trong pool (%s)" % (gone_id, "đã remove" if gone_id == "P_gone" else "tạm đóng cửa: closed_state + retry"))
for keep in ("P_venue", "P_match", "P_plain", "P_low"):
    if keep not in P:
        bad.append("%s phải ở lại pool" % keep)
if not bad:
    for gid in ("P_match", "P_venue"):
        ph = P[gid]["photos"]
        if len(ph) != 2 or not all(p["source"] == "google" and re.match(r"^https://lh\d+\.googleusercontent\.com/", p["url"]) and (p.get("attribution") or "").strip() for p in ph):
            bad.append("%s: mong đúng 2 ảnh source=google, host lh*.googleusercontent.com, có attribution; thấy %r" % (gid, ph))
    if P["P_plain"]["photos"] != base_pool[4]["photos"] or P["P_low"]["photos"] != base_pool[2]["photos"]:
        bad.append("vendor không có ảnh Google phải giữ ảnh cũ")
    for b in base_pool:
        if b["id"] in P and (P[b["id"]]["priceMin"], P[b["id"]]["priceMax"], P[b["id"]]["rating"]) != (b["priceMin"], b["priceMax"], b["rating"]):
            bad.append("%s: giá/rating bị đổi" % b["id"])
for inv in t.inv_scripts(12, 13):
    p = subprocess.run([sys.executable, "-I", inv], cwd=t.HQ, env=dict(os.environ, TOHONG_BACK_REPO=back), capture_output=True, text=True)
    if p.returncode != 0 or "chưa áp dụng" in p.stdout:
        bad.append("%s trên pool tạm: %s" % (os.path.basename(inv), (p.stdout or p.stderr).strip()[:140]))
# (a) quay lại
_vs = r.vendors("venue")   # đọc một lần, sửa trên CHÍNH danh sách sẽ ghi xuống (r.vendor() trả bản đọc lại từ file)
v = next(x_ for x_ in _vs if x_["id"] == "P_temp")
v["google_photos"] = [{"uri": "https://lh3.googleusercontent.com/P_temp/0", "attributions": [{"name": "A"}], "fetched_at": "2026-11-09T00:00:00Z"}]
v["enrichment_log"] = [{"source": "google_maps", "timestamp": "2026-11-09T04:03:36", "matched_name": "Nhà hàng Ptemp", "confidence": 1.0, "place_id": "PID_T", "formatted_address": x.GADDR % 2, "address_match": True, "changes": {}}]
r.write("venue/vendors.json", {"vendors": _vs})
ar = [a for a in r.read("venue/enrichment-audit.json") if a["vendor_id"] != "P_temp"] + [{"vendor_id": "P_temp", "status": "enriched", "place_id": "PID_T", "reopened": True, "matched_name": "Nhà hàng Ptemp", "confidence": 1.0}]
r.write("venue/enrichment-audit.json", ar)
rc, o = regen()
if rc != 0 or "P_temp" not in read_pool():
    bad.append("(a) hết trạng thái tạm đóng (được nhận khớp) mà P_temp không quay lại pool (rc=%d)" % rc)
elif read_pool()["P_temp"]["photos"][0]["source"] != "google":
    bad.append("(a) P_temp quay lại pool phải mang ảnh Google")
# (b) không --prune
write_pool(base_pool)
r.run  # giữ tham chiếu
r.write("venue/vendors.json", {"vendors": [vv for vv in r.vendors("venue")]})
env = dict(os.environ)
scr = os.path.join(r.base, "tools", "scraper")
subprocess.run([sys.executable, "build_pool.py", "--out", "output/pool-vendors.json"], cwd=scr, capture_output=True, text=True)
p = subprocess.run(["node", "tools/generate-vendor-pool.js", "--styles-only", "--base", PF, "--out", PF], cwd=r.base, capture_output=True, text=True)
if p.returncode == 0 and "P_gone" not in open(PF, encoding="utf-8").read():
    bad.append("(b) --styles-only không kèm --prune đã xoá vendor khỏi pool âm thầm")
elif p.returncode == 0:
    pass
# (c) nguồn rỗng
write_pool(base_pool)
before = open(PF, encoding="utf-8").read()
for c in os.listdir(r.out):
    if os.path.isfile(r.p(c + "/vendors.json")):
        r.write(c + "/vendors.json", {"vendors": []})
rc, o = regen()
if rc == 0 or open(PF, encoding="utf-8").read() != before:
    bad.append("(c) nguồn rỗng + --prune phải bị từ chối (thoát khác 0) và pool không đổi (rc=%d)" % rc)
t.done(bad, "regen-pool-styles.sh --photos-for all: vendor đã remove và vendor tạm đóng cửa không có trong pool (thoát 0), vendor tạm đóng quay lại khi được nhận khớp, vendor low_confidence ở lại, ảnh Google 2 tấm có ghi công cho mọi category, giá giữ nguyên, INV-012/013 xanh; không --prune thì không xoá âm thầm; nguồn rỗng bị từ chối")
