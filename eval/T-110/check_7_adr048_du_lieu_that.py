#!/usr/bin/env python3
"""T-110 tiêu chí 7: 4 quyết định ADR-048 đã áp vào DỮ LIỆU THẬT và pool. Chỉ đọc file/log, không gọi Google.
Spec: products/T-110-duyet-tay-venue.md, "Áp ADR-048 cho 4 venue". Cần TOHONG_REPO, TOHONG_BACK_REPO (mặc định ../tohong, ../tohong-back).
  Én (marry_d4380c0b3cf3) và Thiskyhall (marry_f8b40ba4ddef): vendors.json (venue) có enrichment_log[google_maps].place_id khớp place_id trong mục duyệt tay + manual_override=true,
    google_photos >= 1 ảnh (uri lh*.googleusercontent.com, có attributions), audit status enriched + manual_override=accept_place; pool tohong-back: >= 1 ảnh, MỌI ảnh source=google,
    host lh*.googleusercontent.com, mỗi ảnh có attribution.
  Tự Do (marry_e38f1e755f9c): không còn trong vendors.json của category nào; venue/removed_vendors.json có đúng 1 bản ghi (manual=true, reason bắt đầu 'manual_override: remove'); không có trong pool.
  Pergola (marry_2ee808943c08): còn trong vendors.json (venue), không place_id, không google_photos, không trong removed_vendors.json; dòng audit mới nhất có retry=true và
    manual_override=temporarily_closed; còn trong pool với >= 1 ảnh và không ảnh Google.
  Log chạy thật tools/scraper/run-logs/T-110/*.log: tổng GOOGLE_USAGE text_search <= 3 (resolve <= 2 + thử lại Pergola 1), photo_details <= 4, photo_media <= 4, tổng <= 9; không chứa khoá AIza….
  Nếu đặt T110_BASE_REF (mốc git của tohong-back trước PR): pool chỉ khác ở Én, Thiskyhall (photos/styles/tags) và Tự Do (bị gỡ); không vendor khác đổi.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import glob, json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t110 as t

c = t.c
EN, TD, PG, TH = "marry_d4380c0b3cf3", "marry_e38f1e755f9c", "marry_2ee808943c08", "marry_f8b40ba4ddef"
LH = re.compile(r"^https://lh\d+\.googleusercontent\.com/")
bad = []
root = os.path.join(c.tohong(), "tools", "scraper")
out = os.path.join(root, "output", "HCMC")
back = c.back()
pool = {p["id"]: p for p in c.load_pool(back)}


def load(rel, default):
    try:
        return json.load(open(os.path.join(out, rel), encoding="utf-8"))
    except (OSError, ValueError):
        return default


def vendors(cat):
    d = load(os.path.join(cat, "vendors.json"), {})
    return d.get("vendors", []) if isinstance(d, dict) else d


cats = sorted(os.path.basename(os.path.dirname(f)) for f in glob.glob(os.path.join(out, "*", "vendors.json")))
ov = {e.get("vendor_id"): e for e in (load(t.OVERRIDES, {}).get("overrides") or [])}
audit = {r.get("vendor_id"): r for r in load("venue/enrichment-audit.json", [])}
venue = {v["id"]: v for v in vendors("venue")}

for vid, nm in ((EN, "Én"), (TH, "Thiskyhall")):
    v, e, a = venue.get(vid), ov.get(vid) or {}, audit.get(vid) or {}
    g = t.glog(v) if v else None
    if not g or not g.get("place_id"):
        bad.append("%s: chưa có place_id" % nm); continue
    if g["place_id"] != e.get("place_id") or g["place_id"] != (e.get("resolved") or {}).get("place_id") or g.get("manual_override") is not True:
        bad.append("%s: place_id log %r không khớp mục duyệt tay %r hoặc thiếu manual_override" % (nm, g["place_id"], e.get("place_id")))
    ph = v.get("google_photos") or []
    if not ph or not all(LH.match(str(p.get("uri", ""))) and p.get("attributions") for p in ph):
        bad.append("%s: google_photos thiếu hoặc không phải lh*.googleusercontent.com có attributions" % nm)
    if a.get("status") != "enriched" or a.get("manual_override") != "accept_place":
        bad.append("%s: audit mong enriched + accept_place; thấy %r" % (nm, {k: a.get(k) for k in ("status", "manual_override")}))
    pp = pool.get(vid)
    if not pp or not pp.get("photos"):
        bad.append("%s: pool không có vendor hoặc không có ảnh" % nm)
    else:
        for p in pp["photos"]:
            if p.get("source") != "google" or not LH.match(str(p.get("url", ""))) or not str(p.get("attribution") or "").strip():
                bad.append("%s: ảnh trong pool không phải ảnh Google có attribution: %r" % (nm, {k: str(p.get(k))[:40] for k in ("source", "url", "attribution")})); break

for cat in cats:
    if any(v.get("id") == TD for v in vendors(cat)):
        bad.append("Tự Do còn trong %s/vendors.json" % cat)
rec = [x for x in load("venue/removed_vendors.json", []) if (x.get("vendor") or {}).get("id") == TD]
if len(rec) != 1 or rec[0].get("manual") is not True or not str(rec[0].get("reason", "")).startswith("manual_override: remove"):
    bad.append("Tự Do: venue/removed_vendors.json mong đúng 1 bản ghi manual=true, reason 'manual_override: remove…'; thấy %r" % [(x.get("manual"), x.get("reason")) for x in rec])
if TD in pool:
    bad.append("Tự Do còn trong pool tohong-back")

pv, pa = venue.get(PG), audit.get(PG) or {}
if pv is None:
    bad.append("Pergola biến mất khỏi venue/vendors.json (tạm đóng cửa không được gỡ)")
else:
    if t.has_pid(pv) or pv.get("google_photos"):
        bad.append("Pergola có place_id hoặc ảnh Google (ADR-048: không nhận lúc này)")
if any((x.get("vendor") or {}).get("id") == PG for cat in cats for x in load(os.path.join(cat, "removed_vendors.json"), [])):
    bad.append("Pergola nằm trong removed_vendors.json")
if pa.get("retry") is not True or pa.get("manual_override") != "temporarily_closed":
    bad.append("Pergola: dòng audit mong retry=true + manual_override=temporarily_closed; thấy %r" % {k: pa.get(k) for k in ("status", "retry", "manual_override")})
pp = pool.get(PG)
if not pp or not pp.get("photos") or any(p.get("source") == "google" or LH.match(str(p.get("url", ""))) for p in pp["photos"]):
    bad.append("Pergola trong pool: mong >= 1 ảnh minh hoạ và không ảnh Google")

logs = sorted(glob.glob(os.path.join(root, "run-logs", "T-110", "*.log")))
if not logs:
    bad.append("chưa có log chạy thật tools/scraper/run-logs/T-110/*.log")
tot = {"text_search": 0, "photo_details": 0, "photo_media": 0}
for lg in logs:
    txt = open(lg, encoding="utf-8", errors="replace").read()
    if re.search(r"AIza[0-9A-Za-z_\-]{35}", txt):
        bad.append("%s chứa chuỗi giống khoá Google" % os.path.basename(lg))
    ls = [l for l in txt.splitlines() if l.startswith("GOOGLE_USAGE")]
    if not ls:
        bad.append("%s thiếu dòng GOOGLE_USAGE" % os.path.basename(lg)); continue
    for k, v in re.findall(r"(\w+)=(\d+)", ls[-1]):
        if k in tot:
            tot[k] += int(v)
if logs and (tot["text_search"] > 3 or tot["photo_details"] > 4 or tot["photo_media"] > 4 or sum(tot.values()) > 9):
    bad.append("log chạy thật vượt hạn mức: %r (mong text_search <= 3, photo_details <= 4, photo_media <= 4, tổng <= 9)" % tot)

ref = os.environ.get("T110_BASE_REF")
if ref:
    try:
        old = subprocess.run(["git", "-C", back, "show", "%s:lib/vendorPool.generated.js" % ref], capture_output=True, text=True, check=True).stdout
        base = c.parse_pool(old)
    except Exception as ex:  # noqa: BLE001
        base = None
        bad.append("không đọc được pool ở mốc T110_BASE_REF=%s: %s" % (ref, str(ex)[:80]))
    if base is not None:
        b = {p["id"]: p for p in base}
        changed = {i for i in set(b) | set(pool) if b.get(i) != pool.get(i)}
        if changed != {EN, TH, TD}:
            bad.append("pool đổi ở %r (mong đúng Én, Thiskyhall, Tự Do)" % sorted(changed)[:5])
        for i in (EN, TH):
            if i in b and i in pool and {k: v for k, v in b[i].items() if k not in ("photos", "styles", "tags")} != {k: v for k, v in pool[i].items() if k not in ("photos", "styles", "tags")}:
                bad.append("%s: pool đổi trường ngoài photos/styles/tags" % i)
t.done(bad, "ADR-048 đã áp: Én và Thiskyhall có place_id + ảnh Google (dữ liệu và pool), Tự Do gỡ khỏi pool và lưu removed_vendors.json, Pergola giữ ảnh minh hoạ và được đánh dấu thử lại; log trong hạn mức")
